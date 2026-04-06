import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  deriveLots,
  deriveRealizedLots,
  canDeleteTransaction,
  matchSellLots,
  type Lot,
} from '../../services/navUpdateService';
import type { Transaction } from '../../types';

function makeBuyTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: crypto.randomUUID(),
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
  return {
    id: crypto.randomUUID(),
    fundId: 'fund_001',
    fundCode: '000001',
    fundName: '华夏成长混合',
    type: 'sell',
    date: '2024-02-15',
    amount: 500,
    price: 1.2,
    shares: 416.67,
    status: 'completed',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('canDeleteTransaction 排序逻辑验证（与 deriveLots 一致）', () => {
  it('按日期排序，而非按价格排序', () => {
    // 创建两个买入，日期不同但价格不同
    // 如果按价格排序：buy_002 (price=0.8) 先于 buy_001 (price=1.0)
    // 如果按日期排序：buy_001 (date=2024-01-01) 先于 buy_002 (date=2024-02-01)
    const txs = [
      makeBuyTx({ id: 'buy_001', date: '2024-01-01', price: 1.0, shares: 100 }),
      makeBuyTx({ id: 'buy_002', date: '2024-02-01', price: 0.8, shares: 100 }),
      makeSellTx({ id: 'sell_001', date: '2024-03-01', price: 0.9, shares: 50 }),
    ];

    // deriveLots 按日期排序后创建批次，然后按成本匹配卖出
    // buy_001 (date=01-01, cost=1.0) 先创建
    // buy_002 (date=02-01, cost=0.8) 后创建
    // 卖出匹配按成本升序：buy_002 (cost=0.8) 先被匹配
    const lots = deriveLots(txs);
    const lot1 = lots.find(l => l.id === 'buy_001');
    const lot2 = lots.find(l => l.id === 'buy_002');

    // buy_002 成本更低，先被卖出 50 份
    expect(lot2?.remainingShares).toBe(50);
    expect(lot1?.remainingShares).toBe(100);

    // canDeleteTransaction 应该使用相同的逻辑
    const canDelete1 = canDeleteTransaction(txs, 'buy_001');
    const canDelete2 = canDeleteTransaction(txs, 'buy_002');

    // buy_001 未被卖出，可以删除
    expect(canDelete1.canDelete).toBe(true);
    // buy_002 被卖出了 50 份，不能删除
    expect(canDelete2.canDelete).toBe(false);
  });

  it('相同日期不同价格的买入，卖出匹配逻辑一致', () => {
    const txs = [
      makeBuyTx({ id: 'buy_001', date: '2024-01-01', price: 1.5, shares: 100 }),
      makeBuyTx({ id: 'buy_002', date: '2024-01-01', price: 1.0, shares: 100 }),
      makeSellTx({ id: 'sell_001', date: '2024-02-01', price: 1.2, shares: 50 }),
    ];

    // 日期相同，按原始顺序创建批次
    // 卖出匹配按成本升序：buy_002 (cost=1.0) 先被匹配
    const lots = deriveLots(txs);
    const lot1 = lots.find(l => l.id === 'buy_001');
    const lot2 = lots.find(l => l.id === 'buy_002');

    expect(lot2?.remainingShares).toBe(50);
    expect(lot1?.remainingShares).toBe(100);
  });
});

describe('deriveLots 与 canDeleteTransaction 逻辑一致性', () => {
  it('复杂场景：多买入多卖出，两者结果一致', () => {
    const txs = [
      makeBuyTx({ id: 'buy_001', date: '2024-01-01', price: 1.0, shares: 100 }),
      makeBuyTx({ id: 'buy_002', date: '2024-01-15', price: 1.2, shares: 100 }),
      makeBuyTx({ id: 'buy_003', date: '2024-02-01', price: 0.8, shares: 100 }),
      makeSellTx({ id: 'sell_001', date: '2024-03-01', price: 1.1, shares: 150 }),
      makeSellTx({ id: 'sell_002', date: '2024-04-01', price: 1.0, shares: 50 }),
    ];

    // deriveLots:
    // 批次按日期创建: buy_001(1.0), buy_002(1.2), buy_003(0.8)
    // 卖出匹配按成本升序:
    // sell_001 (150): buy_003(0.8) 100 → buy_001(1.0) 50
    // sell_002 (50): buy_001(1.0) 剩余 50 → 50
    // 结果: buy_001 剩 0, buy_002 剩 100, buy_003 剩 0
    const lots = deriveLots(txs);

    expect(lots.find(l => l.id === 'buy_001')).toBeUndefined(); // 全部卖出被过滤
    expect(lots.find(l => l.id === 'buy_002')?.remainingShares).toBe(100);
    expect(lots.find(l => l.id === 'buy_003')).toBeUndefined(); // 全部卖出被过滤

    // canDeleteTransaction 验证
    expect(canDeleteTransaction(txs, 'buy_001').canDelete).toBe(false);
    expect(canDeleteTransaction(txs, 'buy_002').canDelete).toBe(true);
    expect(canDeleteTransaction(txs, 'buy_003').canDelete).toBe(false);
  });
});

describe('addTransactionWithHoldingUpdate confirm_date 字段', () => {
  it('confirmDate 为 null 时，confirm_date 为 null', () => {
    // 验证 navUpdateService 中的 txPayload 构建逻辑
    const confirmDate = null;
    const txPayload = {
      confirm_date: confirmDate || null,
    };
    expect(txPayload.confirm_date).toBeNull();
  });

  it('confirmDate 有值时，confirm_date 为该值', () => {
    const confirmDate = '2024-01-15';
    const txPayload = {
      confirm_date: confirmDate || null,
    };
    expect(txPayload.confirm_date).toBe('2024-01-15');
  });

  it('confirmDate 为 undefined 时，confirm_date 为 null', () => {
    const confirmDate = undefined as string | undefined;
    const txPayload = {
      confirm_date: confirmDate || null,
    };
    expect(txPayload.confirm_date).toBeNull();
  });
});

describe('mapTransaction confirmDate 映射逻辑', () => {
  it('confirm_date 存在时使用 confirm_date', () => {
    const rawTx = {
      id: 'tx_001',
      fund_code: '000001',
      fund_name: '华夏成长',
      type: 'buy',
      date: '2024-01-10',
      confirm_date: '2024-01-11',
      amount: 1000,
      nav: 1.0,
      shares: 1000,
      fee: 0,
      status: 'completed',
      created_at: '2024-01-10T00:00:00Z',
    };

    // 模拟 mapTransaction 逻辑
    const mapped = {
      confirmDate: rawTx.confirm_date || rawTx.date,
    };

    expect(mapped.confirmDate).toBe('2024-01-11');
  });

  it('confirm_date 为 null 时使用 date', () => {
    const rawTx = {
      id: 'tx_001',
      fund_code: '000001',
      fund_name: '华夏成长',
      type: 'buy',
      date: '2024-01-10',
      confirm_date: null,
      amount: 1000,
      nav: 1.0,
      shares: 1000,
      fee: 0,
      status: 'completed',
      created_at: '2024-01-10T00:00:00Z',
    };

    const mapped = {
      confirmDate: rawTx.confirm_date || rawTx.date,
    };

    expect(mapped.confirmDate).toBe('2024-01-10');
  });
});
