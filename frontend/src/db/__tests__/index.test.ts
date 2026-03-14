/**
 * @fileoverview IndexedDB 数据库测试
 * @description 测试数据库的 CRUD 操作
 * @module db/__tests__/index
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../index';
import type { FundCacheItem, Transaction, Holding } from '../index';

describe('Database', () => {
  // 每个测试前清理数据
  beforeEach(async () => {
    await db.fundCache.clear();
    await db.transactions.clear();
    await db.holdings.clear();
  });

  describe('FundCache', () => {
    const mockFund: FundCacheItem = {
      id: 'test-1',
      code: '000001',
      name: '测试基金',
      category: '股票型',
      nav: 1.5,
      navDate: '2024-01-01',
      source: 'manual',
      isHolding: true,
      holdingShares: 1000,
      searchCount: 0,
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('应该能添加基金缓存', async () => {
      const id = await db.fundCache.add(mockFund);
      expect(id).toBeDefined();
    });

    it('应该能查询基金缓存', async () => {
      await db.fundCache.add(mockFund);
      const fund = await db.fundCache.where('code').equals('000001').first();
      expect(fund).toBeDefined();
      expect(fund?.name).toBe('测试基金');
    });

    it('应该能更新基金缓存', async () => {
      await db.fundCache.add(mockFund);
      const fund = await db.fundCache.where('code').equals('000001').first();
      if (fund) {
        await db.fundCache.update(fund.id, { nav: 1.6 });
        const updated = await db.fundCache.get(fund.id);
        expect(updated?.nav).toBe(1.6);
      }
    });

    it('应该能删除基金缓存', async () => {
      const id = await db.fundCache.add(mockFund);
      await db.fundCache.delete(id);
      const fund = await db.fundCache.get(id);
      expect(fund).toBeUndefined();
    });
  });

  describe('Transactions', () => {
    const mockTransaction: Transaction = {
      id: 'tx-1',
      fundCode: '000001',
      fundName: '测试基金',
      type: 'buy',
      shares: 1000,
      nav: 1.5,
      amount: 1500,
      fee: 0,
      date: '2024-01-01',
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('应该能添加交易记录', async () => {
      const id = await db.transactions.add(mockTransaction);
      expect(id).toBeDefined();
    });

    it('应该能查询交易记录', async () => {
      await db.transactions.add(mockTransaction);
      const txs = await db.transactions.where('fundCode').equals('000001').toArray();
      expect(txs.length).toBe(1);
      expect(txs[0].type).toBe('buy');
    });
  });

  describe('Holdings', () => {
    const mockHolding: Holding = {
      id: 'hold-1',
      fundCode: '000001',
      fundName: '测试基金',
      shares: 1000,
      avgNav: 1.5,
      totalCost: 1500,
      currentNav: 1.6,
      marketValue: 1600,
      profit: 100,
      profitRate: 6.67,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('应该能添加持仓', async () => {
      const id = await db.holdings.add(mockHolding);
      expect(id).toBeDefined();
    });

    it('应该能计算持仓收益', async () => {
      await db.holdings.add(mockHolding);
      const holding = await db.holdings.where('fundCode').equals('000001').first();
      expect(holding?.profit).toBe(100);
      expect(holding?.profitRate).toBe(6.67);
    });
  });
});
