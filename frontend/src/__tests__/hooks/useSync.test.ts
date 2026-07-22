import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// Mock batchFetchNav（enrichHoldingsWithNav 的唯一外部依赖）
const mockBatchFetchNav = vi.hoisted(() => vi.fn());
vi.mock('../../services/fundApi', () => ({
  batchFetchNav: mockBatchFetchNav,
}));

// Mock supabase（useHoldings/useTransactions 的数据源）
const mockSupabaseFrom = vi.hoisted(() => vi.fn());
vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockSupabaseFrom },
  isSupabaseConfigured: vi.fn(() => true),
}));

// Mock navUpdateService（deriveLots/summarizeHoldings 等）
vi.mock('../../services/navUpdateService', () => ({
  deriveLots: vi.fn(() => []),
  summarizeHoldings: vi.fn(() => []),
  addTransactionWithHoldingUpdate: vi.fn(),
  removeTransactionWithHoldingUpdate: vi.fn(),
  removeHoldingWithTransactions: vi.fn(),
}));

// Mock dataChangeEvent（useHoldings/useTransactions 注册监听）
vi.mock('../../utils/dataChangeEvent', () => ({ onDataChanged: vi.fn(() => () => {}) }));

import { mapTransaction, enrichHoldingsWithNav, useHoldings, useTransactions } from '../../hooks/useSync';
import type { Transaction } from '../../types';

// ============================================
// mapTransaction：DB 行 → Transaction 映射（数据完整性关键）
// ============================================
describe('mapTransaction', () => {
  it('完整映射 DB 行到 Transaction（snake_case → camelCase）', () => {
    const raw = {
      id: 'tx_001',
      fund_code: '000001',
      fund_name: '华夏成长',
      type: 'buy',
      date: '2024-01-10',
      confirm_date: '2024-01-11',
      amount: 1000,
      nav: 1.5,
      shares: 666.67,
      fee: 1.2,
      status: 'completed',
      source: 'grid',
      grid_execution_id: 'ge_001',
      lot_id: 'lot_001',
      created_at: '2024-01-10T00:00:00Z',
    };
    const tx = mapTransaction(raw);
    expect(tx).toEqual({
      id: 'tx_001',
      fundId: '000001',
      fundCode: '000001',
      fundName: '华夏成长',
      type: 'buy',
      date: '2024-01-10',
      confirmDate: '2024-01-11',
      amount: 1000,
      price: 1.5,
      shares: 666.67,
      fee: 1.2,
      status: 'completed',
      source: 'grid',
      gridExecutionId: 'ge_001',
      lotId: 'lot_001',
      createdAt: '2024-01-10T00:00:00Z',
    } as Transaction);
  });

  it('confirm_date 为 null 时回退到 date', () => {
    const tx = mapTransaction({
      id: 't1', fund_code: '000001', fund_name: 'f', type: 'buy',
      date: '2024-01-10', confirm_date: null, amount: 100, nav: 1,
      shares: 100, fee: 0, status: 'completed', created_at: '',
    });
    expect(tx.confirmDate).toBe('2024-01-10');
  });

  it('confirm_date 缺失（undefined）时回退到 date', () => {
    const tx = mapTransaction({
      id: 't1', fund_code: '000001', fund_name: 'f', type: 'buy',
      date: '2024-01-10', amount: 100, nav: 1, shares: 100, fee: 0,
      status: 'completed', created_at: '',
    });
    expect(tx.confirmDate).toBe('2024-01-10');
  });

  it('source 缺失时默认 manual', () => {
    const tx = mapTransaction({
      id: 't1', fund_code: '000001', fund_name: 'f', type: 'buy',
      date: '2024-01-10', amount: 100, nav: 1, shares: 100, fee: 0,
      status: 'completed', created_at: '',
    });
    expect(tx.source).toBe('manual');
  });

  it('nav 字段映射到 price（净值→价格）', () => {
    const tx = mapTransaction({
      id: 't1', fund_code: '000001', fund_name: 'f', type: 'buy',
      date: '2024-01-10', amount: 100, nav: 2.5, shares: 40, fee: 0,
      status: 'completed', created_at: '',
    });
    expect(tx.price).toBe(2.5);
  });
});

// ============================================
// enrichHoldingsWithNav：净值增强持仓（市值/盈亏计算）
// ============================================
describe('enrichHoldingsWithNav', () => {
  beforeEach(() => {
    mockBatchFetchNav.mockReset();
  });

  it('空 summaries 返回空数组', async () => {
    const result = await enrichHoldingsWithNav([]);
    expect(result).toEqual([]);
    expect(mockBatchFetchNav).not.toHaveBeenCalled();
  });

  it('有 NAV 时计算 currentValue / profit / profitRate', async () => {
    mockBatchFetchNav.mockResolvedValue(new Map([
      ['000001', { nav: 2.0, navDate: '2024-01-10', name: '华夏成长' }],
    ]));
    const summaries = [{
      fundCode: '000001', fundName: '华夏成长', shares: 100,
      totalCost: 100, avgCost: 1.0,
    }];
    const result = await enrichHoldingsWithNav(summaries);
    expect(result).toHaveLength(1);
    expect(result[0].currentValue).toBe(200);   // 2.0 × 100
    expect(result[0].profit).toBe(100);          // 200 − 100
    expect(result[0].profitRate).toBe(1);        // 100 / 100
    expect(result[0].currentNav).toBe(2.0);
  });

  it('无 NAV 时 currentValue/profit 为 undefined（不用成本冒充市值）', async () => {
    mockBatchFetchNav.mockResolvedValue(new Map()); // 该基金无净值
    const summaries = [{
      fundCode: '000001', fundName: '华夏成长', shares: 100,
      totalCost: 100, avgCost: 1.0,
    }];
    const result = await enrichHoldingsWithNav(summaries);
    expect(result).toHaveLength(1);
    expect(result[0].currentValue).toBeUndefined();
    expect(result[0].profit).toBeUndefined();
    expect(result[0].currentNav).toBeUndefined();
  });

  it('summary.fundName 为空时用 navInfo.name 兜底', async () => {
    mockBatchFetchNav.mockResolvedValue(new Map([
      ['000001', { nav: 1.0, navDate: '2024-01-10', name: 'NAV基金名' }],
    ]));
    const summaries = [{
      fundCode: '000001', fundName: '', shares: 100,
      totalCost: 100, avgCost: 1.0,
    }];
    const result = await enrichHoldingsWithNav(summaries);
    expect(result[0].fundName).toBe('NAV基金名');
  });

  it('totalCost 为 0 时 profitRate 为 0（避免除零）', async () => {
    mockBatchFetchNav.mockResolvedValue(new Map([
      ['000001', { nav: 1.5, navDate: '2024-01-10', name: 'f' }],
    ]));
    const summaries = [{
      fundCode: '000001', fundName: 'f', shares: 100,
      totalCost: 0, avgCost: 0,
    }];
    const result = await enrichHoldingsWithNav(summaries);
    expect(result[0].profitRate).toBe(0);
  });
});

// ============================================
// useHoldings / useTransactions：M4 error 状态（H-4）
// ============================================
describe('useHoldings / useTransactions error 状态（H-4 M4）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useHoldings 加载失败时设置 error 而非静默空数据', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn(() => Promise.resolve({ data: null, error: { message: 'RLS denied' } })),
    });

    const { result } = renderHook(() => useHoldings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toContain('加载持仓失败');
    expect(result.current.error).toContain('RLS denied');
    expect(result.current.holdings).toEqual([]);
  });

  it('useTransactions 加载失败时设置 error 而非静默空数据', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn(() => Promise.resolve({ data: null, error: { message: 'network timeout' } })),
    });

    const { result } = renderHook(() => useTransactions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toContain('加载交易记录失败');
    expect(result.current.error).toContain('network timeout');
    expect(result.current.transactions).toEqual([]);
  });
});
