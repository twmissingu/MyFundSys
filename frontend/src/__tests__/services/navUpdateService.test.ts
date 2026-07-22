import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockIsSupabaseConfigured = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockFetchFundNav = vi.hoisted(() => vi.fn());
const mockFetchFundHistory = vi.hoisted(() => vi.fn());

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: mockIsSupabaseConfigured,
  supabase: { from: mockFrom },
}));

vi.mock('../../services/fundApi', () => ({
  fetchFundNav: mockFetchFundNav,
  fetchFundHistory: mockFetchFundHistory,
}));

import {
  canDeleteTransaction,
  getFundAvailableShares,
  addTransactionWithHoldingUpdate,
  removeTransactionWithHoldingUpdate,
  removeHoldingWithTransactions,
  processPendingTransactions,
} from '../../services/navUpdateService';
import type { Transaction } from '../../types';

// ---- 工具函数 ----

function makeBuyTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx_001',
    fundId: 'fund_001',
    fundCode: '000001',
    fundName: '华夏成长混合',
    type: 'buy',
    date: '2024-01-10',
    amount: 1000,
    price: 1.0,
    shares: 1000,
    status: 'completed',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSellTx(overrides: Partial<Transaction> = {}): Transaction {
  return makeBuyTx({ type: 'sell', amount: 500, price: 1.5, shares: 333.33, id: 'tx_002', ...overrides });
}

function makeAddTxPayload(overrides: Partial<Omit<Transaction, 'id' | 'createdAt'>> = {}): Omit<Transaction, 'id' | 'createdAt'> {
  return {
    fundId: 'fund_001',
    fundCode: '000001',
    fundName: '华夏成长混合',
    type: 'buy',
    date: '2024-01-10',
    amount: 1000,
    price: 1.0,
    shares: 1000,
    status: 'completed',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReset();
  mockFetchFundNav.mockReset();
  mockFetchFundHistory.mockReset();
  mockIsSupabaseConfigured.mockReturnValue(true);
  (window as any).__pendingTransactionsProcessing = false;
});

// ============================================
// canDeleteTransaction
// ============================================

describe('canDeleteTransaction', () => {
  it('交易不存在时返回不可删除', () => {
    const txs = [makeBuyTx({ id: 'tx1' })];
    const result = canDeleteTransaction(txs, 'nonexistent');
    expect(result.canDelete).toBe(false);
    expect(result.reason).toBe('交易不存在');
  });

  it('卖出交易可以直接删除', () => {
    const txs = [makeSellTx({ id: 'tx1' })];
    const result = canDeleteTransaction(txs, 'tx1');
    expect(result.canDelete).toBe(true);
  });

  it('买入未被卖出可以删除', () => {
    const txs = [makeBuyTx({ id: 'tx1', shares: 1000 })];
    const result = canDeleteTransaction(txs, 'tx1');
    expect(result.canDelete).toBe(true);
  });

  it('买入被部分卖出不可删除', () => {
    const txs = [
      makeBuyTx({ id: 'tx1', shares: 1000, price: 1.0 }),
      makeSellTx({ id: 'tx2', shares: 300, price: 1.2 }),
    ];
    const result = canDeleteTransaction(txs, 'tx1');
    expect(result.canDelete).toBe(false);
    expect(result.reason).toContain('300.00');
  });

  it('买入被完全卖出不可删除', () => {
    const txs = [
      makeBuyTx({ id: 'tx1', shares: 1000, price: 1.0 }),
      makeSellTx({ id: 'tx2', shares: 1000, price: 1.2 }),
    ];
    const result = canDeleteTransaction(txs, 'tx1');
    expect(result.canDelete).toBe(false);
    expect(result.reason).toContain('1000.00');
  });

  it('多笔卖出匹配后检查', () => {
    const txs = [
      makeBuyTx({ id: 'tx1', shares: 1000, price: 1.0 }),
      makeSellTx({ id: 'tx2', shares: 200, price: 1.2 }),
      makeSellTx({ id: 'tx3', shares: 300, price: 1.3 }),
    ];
    const result = canDeleteTransaction(txs, 'tx1');
    expect(result.canDelete).toBe(false);
    expect(result.reason).toContain('500.00');
  });

  it('多笔买入排序后匹配卖出', () => {
    const txs = [
      makeBuyTx({ id: 'tx1', shares: 500, price: 1.0, date: '2024-01-01' }),
      makeBuyTx({ id: 'tx2', shares: 500, price: 2.0, date: '2024-02-01' }),
      makeSellTx({ id: 'tx3', shares: 300, price: 1.5 }),
    ];
    const result = canDeleteTransaction(txs, 'tx1');
    expect(result.canDelete).toBe(false);
    expect(result.reason).toContain('300.00');
  });
});

// ============================================
// getFundAvailableShares（防超卖）
// ============================================
describe('getFundAvailableShares', () => {
  it('返回指定基金多批次可用份额之和', () => {
    const txs = [
      makeBuyTx({ id: 'b1', shares: 100 }),
      makeBuyTx({ id: 'b2', shares: 50 }),
    ];
    expect(getFundAvailableShares(txs, '000001')).toBe(150);
  });

  it('扣除已卖出份额', () => {
    const txs = [
      makeBuyTx({ id: 'b1', shares: 100 }),
      makeSellTx({ id: 's1', shares: 30 }),
    ];
    expect(getFundAvailableShares(txs, '000001')).toBe(70);
  });

  it('不计入在途买入（pending）', () => {
    const txs = [
      makeBuyTx({ id: 'b1', shares: 100, status: 'pending' }),
      makeBuyTx({ id: 'b2', shares: 50, status: 'completed' }),
    ];
    expect(getFundAvailableShares(txs, '000001')).toBe(50);
  });

  it('无持仓返回 0（用于检测超卖）', () => {
    expect(getFundAvailableShares([], '000001')).toBe(0);
  });

  it('只统计指定基金，忽略其他基金', () => {
    const txs = [
      makeBuyTx({ id: 'b1', fundCode: '000001', shares: 100 }),
      makeBuyTx({ id: 'b2', fundCode: '000099', shares: 200 }),
    ];
    expect(getFundAvailableShares(txs, '000001')).toBe(100);
  });
});

// ============================================
// addTransactionWithHoldingUpdate
// ============================================

describe('addTransactionWithHoldingUpdate', () => {
  it('Supabase 未配置时抛出错误', async () => {
    mockIsSupabaseConfigured.mockReturnValue(false);

    await expect(
      addTransactionWithHoldingUpdate(makeAddTxPayload())
    ).rejects.toThrow('Supabase 未配置');
  });

  it('插入成功返回 transactionId', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'new-tx-id' }, error: null }),
        }),
      }),
    });

    const result = await addTransactionWithHoldingUpdate(makeAddTxPayload());
    expect(result.transactionId).toBe('new-tx-id');
    expect(result.holdingUpdated).toBe(true);
  });

  it('插入失败抛出错误', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    });

    await expect(
      addTransactionWithHoldingUpdate(makeAddTxPayload())
    ).rejects.toThrow('插入交易记录失败: DB error');
  });

  it('插入成功但未返回数据抛出错误', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    await expect(
      addTransactionWithHoldingUpdate(makeAddTxPayload())
    ).rejects.toThrow('插入交易记录成功但未返回数据');
  });

  it('pending 状态不标记 holdingUpdated', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'new-tx-id' }, error: null }),
        }),
      }),
    });

    const result = await addTransactionWithHoldingUpdate(makeAddTxPayload({ status: 'pending' }));
    expect(result.holdingUpdated).toBe(false);
  });

  it('卖出超过持仓时抛出错误（H5 服务层守卫）', async () => {
    const existingBuy = {
      id: 'b1', fund_code: '000001', fund_name: 'f', type: 'buy',
      date: '2024-01-10', amount: 100, nav: 1, shares: 100, fee: 0,
      status: 'completed', created_at: '',
    };
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [existingBuy], error: null }) })),
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: 'new' }, error: null }) })) })),
    }));

    await expect(
      addTransactionWithHoldingUpdate(makeAddTxPayload({ type: 'sell', shares: 150, price: 1.5, amount: 225 }))
    ).rejects.toThrow('超过当前持仓');
  });

  it('卖出不超过持仓时通过（H5 服务层守卫正向）', async () => {
    const existingBuy = {
      id: 'b1', fund_code: '000001', fund_name: 'f', type: 'buy',
      date: '2024-01-10', amount: 100, nav: 1, shares: 100, fee: 0,
      status: 'completed', created_at: '',
    };
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [existingBuy], error: null }) })),
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: 'new-tx-id' }, error: null }) })) })),
    }));

    const result = await addTransactionWithHoldingUpdate(makeAddTxPayload({ type: 'sell', shares: 50, price: 1.5, amount: 75 }));
    expect(result.transactionId).toBe('new-tx-id');
  });
});

// ============================================
// removeTransactionWithHoldingUpdate
// ============================================

describe('removeTransactionWithHoldingUpdate', () => {
  it('正常删除', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'grid_executions') {
        // 非网格交易：grid_executions 查询返回空
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      // transactions：select + delete
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'tx1', fund_code: '000001', type: 'buy' }, error: null }),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    });

    await expect(removeTransactionWithHoldingUpdate('tx1')).resolves.toBeUndefined();
  });

  it('交易不存在直接返回', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    });

    await expect(removeTransactionWithHoldingUpdate('tx-unknown')).resolves.toBeUndefined();
  });

  it('删除失败抛出错误', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'grid_executions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'tx1', type: 'buy' }, error: null }),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: 'db error' } }),
        }),
      };
    });

    await expect(removeTransactionWithHoldingUpdate('tx1')).rejects.toThrow('删除交易失败: db error');
  });

  it('删除网格卖出交易：回补买入 execution 的 remaining_shares（修复 K）', async () => {
    const updateSpy = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    // 共享的 maybeSingle：两次 grid_executions 查询依次返回卖出 exec、买入 exec
    const geMaybeSingle = vi.fn()
      .mockResolvedValueOnce({ data: { id: 'ge_sell', action: 'sell', executed_shares: 300, transaction_id: 'txSell' }, error: null })
      .mockResolvedValueOnce({ data: { remaining_shares: 200, executed_shares: 1000 }, error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'grid_executions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ maybeSingle: geMaybeSingle }),
          }),
          update: updateSpy,
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'txSell', type: 'sell', shares: 300, grid_execution_id: 'ge_buy' },
                error: null,
              }),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };
    });

    await removeTransactionWithHoldingUpdate('txSell');

    // 买入 execution 的 remaining_shares 应被回补：200 + 300 = 500（不超过 executed 1000）
    const restoreCall = updateSpy.mock.calls.find(c => c[0]?.remaining_shares != null);
    expect(restoreCall?.[0].remaining_shares).toBeCloseTo(500, 4);
  });

  it('删除被卖出引用的网格买入交易：阻止删除（修复 K）', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'grid_executions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'ge_buy', action: 'buy', transaction_id: 'txBuy' }, error: null }),
            }),
          }),
        };
      }
      return {
        select: vi.fn((cols: string) => {
          // navUpdateService 用 select('id').eq().eq().limit() 检查卖出引用
          if (cols === 'id') {
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: [{ id: 'txSell' }], error: null }),
                }),
              }),
            };
          }
          return {
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'txBuy', type: 'buy', grid_execution_id: 'ge_buy' }, error: null }),
              }),
            }),
          };
        }),
        delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };
    });

    await expect(removeTransactionWithHoldingUpdate('txBuy')).rejects.toThrow('已被卖出引用');
  });

  it('卖出引用检查查询失败时 fail-closed 拒绝删除（CRITICAL #1 修复）', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'transactions') {
        return {
          select: vi.fn((cols: string) => {
            if (cols === 'id') {
              // 卖出引用检查查询失败（网络错误）
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'network error' } }),
                  }),
                }),
              };
            }
            // select('*') 取交易记录
            return {
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'txBuy', type: 'buy', grid_execution_id: 'ge_buy' }, error: null }),
                }),
              }),
            };
          }),
          delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === 'grid_executions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'ge_buy', action: 'buy', transaction_id: 'txBuy' }, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      return {};
    });

    await expect(removeTransactionWithHoldingUpdate('txBuy')).rejects.toThrow('检查卖出引用失败');
  });
});

// ============================================
// removeHoldingWithTransactions
// ============================================

describe('removeHoldingWithTransactions', () => {
  it('按 fundCode 删除交易记录', async () => {
    mockFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    await expect(removeHoldingWithTransactions('000001')).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledWith('transactions');
  });

  it('Supabase 未配置直接返回', async () => {
    mockIsSupabaseConfigured.mockReturnValueOnce(false);
    await expect(removeHoldingWithTransactions('000001')).resolves.toBeUndefined();
  });

  it('空 fundCode 抛出错误', async () => {
    await expect(removeHoldingWithTransactions('')).rejects.toThrow('fundCode 不能为空');
  });

  it('删除失败抛出错误', async () => {
    mockFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'tx delete failed' } }),
      }),
    });

    await expect(removeHoldingWithTransactions('000001')).rejects.toThrow(
      '删除交易记录失败: tx delete failed'
    );
  });
});

// ============================================
// processPendingTransactions
// ============================================

describe('processPendingTransactions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    (window as any).__pendingTransactionsProcessing = false;
  });

  it('已在处理中返回空结果', async () => {
    (window as any).__pendingTransactionsProcessing = true;
    const result = await processPendingTransactions();
    expect(result).toEqual({ processedCount: 0, pendingCount: 0, errors: [] });
  });

  it('Supabase 未配置返回空结果', async () => {
    mockIsSupabaseConfigured.mockReturnValue(false);
    const result = await processPendingTransactions();
    expect(result).toEqual({ processedCount: 0, pendingCount: 0, errors: [] });
  });

  it('无 pending 交易返回空结果', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const result = await processPendingTransactions();
    expect(result).toEqual({ processedCount: 0, pendingCount: 0, errors: [] });
  });

  it('单基金 pending buy 处理成功', async () => {
    const pendingTx = {
      id: 'tx1',
      fund_code: '000001',
      fund_name: 'Test Fund',
      type: 'buy',
      amount: 1000,
      shares: 0,
      date: '2024-03-10',
      confirm_date: '2024-03-11',
      status: 'pending',
    };

    let callCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName !== 'transactions') return {};
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [pendingTx], error: null })),
          })),
        };
      }
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      };
    });

    mockFetchFundHistory.mockResolvedValue([{ date: '2024-03-11', nav: 2.0 }]);

    const result = await processPendingTransactions();
    expect(result.processedCount).toBe(1);
    expect(result.pendingCount).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mockFetchFundHistory).toHaveBeenCalledWith('000001', 100, 1, '2024-03-11', '2024-03-15');
  });

  it('多基金分组处理', async () => {
    const pendingTxs = [
      { id: 'tx1', fund_code: '000001', fund_name: 'A', type: 'buy', amount: 1000, shares: 0, date: '2024-03-10', confirm_date: '2024-03-11', status: 'pending' },
      { id: 'tx2', fund_code: '000002', fund_name: 'B', type: 'buy', amount: 2000, shares: 0, date: '2024-03-10', confirm_date: '2024-03-12', status: 'pending' },
    ];

    let callCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName !== 'transactions') return {};
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: pendingTxs, error: null })),
          })),
        };
      }
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      };
    });

    mockFetchFundHistory.mockImplementation((code: string) => {
      if (code === '000001') {
        return Promise.resolve([{ date: '2024-03-11', nav: 2.0 }]);
      }
      return Promise.resolve([{ date: '2024-03-12', nav: 1.5 }]);
    });

    const result = await processPendingTransactions();
    expect(result.processedCount).toBe(2);
    expect(result.pendingCount).toBe(0);
    expect(mockFetchFundHistory).toHaveBeenCalledTimes(2);
  });

  it('pending 网格买入确认后回填 grid_executions 真实成交净值/份额（H-6）', async () => {
    const pendingTx = {
      id: 'tx1', fund_code: '000001', fund_name: 'A', type: 'buy', amount: 1000, shares: 0,
      date: '2024-03-10', confirm_date: '2024-03-11', status: 'pending', grid_execution_id: 'ge_buy',
    };
    const gridUpdatePayloads: any[] = [];
    let txCallCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName === 'transactions') {
        txCallCount++;
        if (txCallCount === 1) {
          return { select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: [pendingTx], error: null })) })) };
        }
        return { update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) };
      }
      if (tableName === 'grid_executions') {
        return {
          update: vi.fn((payload: any) => {
            gridUpdatePayloads.push(payload);
            return { eq: vi.fn(() => Promise.resolve({ error: null })) };
          }),
        };
      }
      return {};
    });
    mockFetchFundHistory.mockResolvedValue([{ date: '2024-03-11', nav: 2.0 }]);

    await processPendingTransactions();

    expect(gridUpdatePayloads).toHaveLength(1);
    expect(gridUpdatePayloads[0].executed_nav).toBe(2.0);
    expect(gridUpdatePayloads[0].executed_shares).toBe(500);   // 1000 / 2.0
    expect(gridUpdatePayloads[0].remaining_shares).toBe(500);
    expect(gridUpdatePayloads[0].executed_amount).toBe(1000);
  });

  it('取不到确认日净值且确认日在阈值内：保持 pending 不降级成交', async () => {
    // confirm_date=2024-03-11，距今(2024-03-15)4天 < 5天阈值 → 静默等待，不用最新净值凑数
    const pendingTx = {
      id: 'tx1', fund_code: '000001', fund_name: 'A', type: 'buy', amount: 1000, shares: 0,
      date: '2024-03-10', confirm_date: '2024-03-11', status: 'pending',
    };

    let callCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName !== 'transactions') return {};
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [pendingTx], error: null })),
          })),
        };
      }
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      };
    });

    mockFetchFundHistory.mockResolvedValue([]);

    const result = await processPendingTransactions();
    expect(result.processedCount).toBe(0);
    expect(result.pendingCount).toBe(1);
    // 不再调用 fetchFundNav 降级
    expect(mockFetchFundNav).not.toHaveBeenCalled();
  });

  it('navDate < confirmDate 且确认日超过5天跳过', async () => {
    const pendingTx = {
      id: 'tx1', fund_code: '000001', fund_name: 'A', type: 'buy', amount: 1000, shares: 0,
      date: '2024-03-01', confirm_date: '2024-03-05', status: 'pending',
    };

    let callCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName === 'pending_alerts') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      if (tableName !== 'transactions') return {};
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [pendingTx], error: null })),
          })),
        };
      }
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      };
    });

    mockFetchFundHistory.mockResolvedValue([]);
    mockFetchFundNav.mockResolvedValue({ nav: 1.5, navDate: '2024-03-01' });

    const result = await processPendingTransactions();
    expect(result.processedCount).toBe(0);
    expect(result.pendingCount).toBe(1);
  });

  it('确认日有真实历史净值时正常成交', async () => {
    const pendingTx = {
      id: 'tx1', fund_code: '000001', fund_name: 'A', type: 'buy', amount: 1000, shares: 0,
      date: '2024-03-10', confirm_date: '2024-03-11', status: 'pending',
    };

    let callCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName !== 'transactions') return {};
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [pendingTx], error: null })),
          })),
        };
      }
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      };
    });

    // 确认日 2024-03-11 有真实净值
    mockFetchFundHistory.mockResolvedValue([{ date: '2024-03-11', nav: 1.5 }]);

    const result = await processPendingTransactions();
    expect(result.processedCount).toBe(1);
    expect(result.pendingCount).toBe(0);
    // 不需要降级
    expect(mockFetchFundNav).not.toHaveBeenCalled();
  });

  it('confirmDate >= today 跳过', async () => {
    const pendingTx = {
      id: 'tx1', fund_code: '000001', fund_name: 'A', type: 'buy', amount: 1000, shares: 0,
      date: '2024-03-15', confirm_date: '2024-03-15', status: 'pending',
    };

    let callCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName !== 'transactions') return {};
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [pendingTx], error: null })),
          })),
        };
      }
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      };
    });

    mockFetchFundHistory.mockResolvedValue([]);
    mockFetchFundNav.mockResolvedValue({ nav: 1.5, navDate: '2024-03-14' });

    const result = await processPendingTransactions();
    expect(result.processedCount).toBe(0);
    expect(result.pendingCount).toBe(1);
  });

  it('buy 类型正确计算 shares', async () => {
    const pendingTx = {
      id: 'tx1', fund_code: '000001', fund_name: 'A', type: 'buy', amount: 1000, shares: 0,
      date: '2024-03-10', confirm_date: '2024-03-11', status: 'pending',
    };

    const updatePayloads: any[] = [];
    let callCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName !== 'transactions') return {};
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [pendingTx], error: null })),
          })),
        };
      }
      return {
        update: vi.fn((payload: any) => {
          updatePayloads.push(payload);
          return {
            eq: vi.fn(() => Promise.resolve({ error: null })),
          };
        }),
      };
    });

    mockFetchFundHistory.mockResolvedValue([{ date: '2024-03-11', nav: 2.0 }]);

    await processPendingTransactions();
    expect(updatePayloads).toHaveLength(1);
    expect(updatePayloads[0].nav).toBe(2.0);
    expect(updatePayloads[0].shares).toBeCloseTo(500, 0);
    expect(updatePayloads[0].amount).toBe(1000);
    expect(updatePayloads[0].status).toBe('completed');
  });

  it('sell 类型正确计算 amount', async () => {
    const pendingTx = {
      id: 'tx1', fund_code: '000001', fund_name: 'A', type: 'sell', amount: 0, shares: 100,
      date: '2024-03-10', confirm_date: '2024-03-11', status: 'pending',
    };

    const updatePayloads: any[] = [];
    let callCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName !== 'transactions') return {};
      callCount++;
      if (callCount === 1) {
        // 初始查询 pending 交易
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [pendingTx], error: null })),
          })),
        };
      }
      if (callCount === 2) {
        // H5 闭环：卖出超卖校验查询（返回一笔已完成买入 100 份，available=100，卖出 100 通过）
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({
              data: [{ id: 'b1', fund_code: '000001', fund_name: 'A', type: 'buy', amount: 100, nav: 1, shares: 100, fee: 0, status: 'completed', date: '2024-03-01', created_at: '' }],
              error: null,
            })),
          })),
        };
      }
      return {
        update: vi.fn((payload: any) => {
          updatePayloads.push(payload);
          return {
            eq: vi.fn(() => Promise.resolve({ error: null })),
          };
        }),
      };
    });

    mockFetchFundHistory.mockResolvedValue([{ date: '2024-03-11', nav: 2.0 }]);

    await processPendingTransactions();
    expect(updatePayloads).toHaveLength(1);
    expect(updatePayloads[0].nav).toBe(2.0);
    expect(updatePayloads[0].shares).toBe(100);
    expect(updatePayloads[0].amount).toBeCloseTo(200, 0);
    expect(updatePayloads[0].status).toBe('completed');
  });

  it('确认日超过阈值仍取不到净值：写告警并记录错误', async () => {
    // confirm_date=2024-03-01，距今(2024-03-15)14天 > 5天阈值 → 写告警
    const pendingTx = {
      id: 'tx1', fund_code: '000001', fund_name: 'A', type: 'buy', amount: 1000, shares: 0,
      date: '2024-02-28', confirm_date: '2024-03-01', status: 'pending',
    };

    let callCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName === 'pending_alerts') {
        return { upsert: vi.fn().mockResolvedValue({ error: null }) };
      }
      if (tableName !== 'transactions') return {};
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [pendingTx], error: null })),
          })),
        };
      }
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      };
    });

    mockFetchFundHistory.mockResolvedValue([]);
    mockFetchFundNav.mockResolvedValue(null);

    const result = await processPendingTransactions();
    expect(result.processedCount).toBe(0);
    expect(result.errors).toContain('000001: 无法获取净值');
  });

  it('更新失败记录错误', async () => {
    const pendingTx = {
      id: 'tx1', fund_code: '000001', fund_name: 'A', type: 'buy', amount: 1000, shares: 0,
      date: '2024-03-10', confirm_date: '2024-03-11', status: 'pending',
    };

    let callCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName === 'pending_alerts') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      if (tableName !== 'transactions') return {};
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [pendingTx], error: null })),
          })),
        };
      }
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: { message: 'update failed' } })),
        })),
      };
    });

    mockFetchFundHistory.mockResolvedValue([{ date: '2024-03-11', nav: 2.0 }]);

    const result = await processPendingTransactions();
    expect(result.processedCount).toBe(0);
    expect(result.errors).toContain('000001: 更新失败: update failed');
  });

  it('fetchFundHistory 抛异常记录净值获取失败错误', async () => {
    const pendingTx = {
      id: 'tx1', fund_code: '000001', fund_name: 'A', type: 'buy', amount: 1000, shares: 0,
      date: '2024-03-10', confirm_date: '2024-03-11', status: 'pending',
    };

    let callCount = 0;
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName === 'pending_alerts') {
        return { upsert: vi.fn().mockResolvedValue({ error: null }) };
      }
      if (tableName !== 'transactions') return {};
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: [pendingTx], error: null })),
          })),
        };
      }
      return {
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
      };
    });

    mockFetchFundHistory.mockRejectedValue(new Error('network error'));

    const result = await processPendingTransactions();
    expect(result.processedCount).toBe(0);
    expect(result.errors).toContain('000001: 净值获取失败 — network error');
  });
});
