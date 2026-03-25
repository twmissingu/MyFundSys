import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mock Supabase（vi.hoisted 确保在模块加载前初始化）----
const mockInsert = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn(() => ({
  insert: mockInsert,
  delete: mockDelete,
  select: mockSelect,
})));
const mockIsSupabaseConfigured = vi.hoisted(() => vi.fn(() => true));

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: mockIsSupabaseConfigured,
  supabase: {
    from: mockFrom,
  },
}));

import {
  syncHoldingsToSupabase,
  syncTransactionsToSupabase,
  checkSupabaseConnection,
  type SyncResult,
} from '../../services/syncService';
import type { Holding, Transaction } from '../../types';

describe('syncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSupabaseConfigured.mockReturnValue(true);
    // 模拟链式调用: .delete().neq('id', '0') 和 .insert()
    const mockNeq = vi.fn().mockResolvedValue({ error: null });
    mockDelete.mockReturnValue({ neq: mockNeq });
    mockInsert.mockResolvedValue({ error: null });
    mockSelect.mockResolvedValue({ error: null, count: 0 });
  });

  describe('syncHoldingsToSupabase', () => {
    it('空持仓数组时返回成功', async () => {
      const result: SyncResult = await syncHoldingsToSupabase([]);
      expect(result.success).toBe(true);
      expect(result.message).toContain('0 条持仓');
    });

    it('同步持仓时先清空再插入', async () => {
      const holdings: Holding[] = [
        {
          id: 'h_001',
          fundId: 'f_001',
          fundCode: '000001',
          fundName: '测试基金',
          shares: 1000,
          avgCost: 1.0,
          totalCost: 1000,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      const result = await syncHoldingsToSupabase(holdings);

      expect(mockDelete).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('Supabase 错误时返回失败', async () => {
      mockInsert.mockReturnValue({ error: new Error('DB Error') });

      const holdings: Holding[] = [
        {
          id: 'h_001',
          fundId: 'f_001',
          fundCode: '000001',
          fundName: '测试基金',
          shares: 1000,
          avgCost: 1.0,
          totalCost: 1000,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      const result = await syncHoldingsToSupabase(holdings);

      expect(result.success).toBe(false);
      expect(result.message).toBe('同步失败');
    });
  });

  describe('syncTransactionsToSupabase', () => {
    it('空交易数组时返回成功', async () => {
      const result: SyncResult = await syncTransactionsToSupabase([]);
      expect(result.success).toBe(true);
      expect(result.message).toContain('0 条交易');
    });

    it('同步交易时先清空再插入', async () => {
      const transactions: Transaction[] = [
        {
          id: 't_001',
          fundId: 'f_001',
          fundCode: '000001',
          fundName: '测试基金',
          type: 'buy',
          date: '2024-01-01',
          amount: 1000,
          price: 1.0,
          shares: 1000,
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];

      const result = await syncTransactionsToSupabase(transactions);

      expect(mockDelete).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('包含所有交易类型的转换', async () => {
      const transactions: Transaction[] = [
        {
          id: 't_001',
          fundId: 'f_001',
          fundCode: '000001',
          fundName: '测试基金',
          type: 'buy',
          date: '2024-01-01',
          amount: 1000,
          price: 1.0,
          shares: 1000,
          fee: 0,
          status: 'completed',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 't_002',
          fundId: 'f_001',
          fundCode: '000001',
          fundName: '测试基金',
          type: 'sell',
          date: '2024-01-02',
          amount: 500,
          price: 1.5,
          shares: 333.33,
          fee: 5,
          status: 'pending',
          createdAt: '2024-01-02T00:00:00Z',
        },
      ];

      const result = await syncTransactionsToSupabase(transactions);

      expect(result.success).toBe(true);
    });
  });

  describe('checkSupabaseConnection', () => {
    it('连接成功返回 true', async () => {
      mockSelect.mockReturnValue({ error: null });

      const result = await checkSupabaseConnection();

      expect(result).toBe(true);
      expect(mockSelect).toHaveBeenCalledWith('count', { count: 'exact', head: true });
    });

    it('连接失败返回 false', async () => {
      mockSelect.mockReturnValue({ error: new Error('Connection failed') });

      const result = await checkSupabaseConnection();

      expect(result).toBe(false);
    });
  });
});
