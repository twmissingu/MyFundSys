import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  updateLocalHoldingAfterTransaction,
  reverseTransactionOnHolding,
} from '../../services/navUpdateService';
import type { Holding, Transaction } from '../../types';

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

function makeHolding(overrides: Partial<Holding> = {}): Holding {
  return {
    id: 'h_001',
    fundId: 'fund_001',
    fundCode: '000001',
    fundName: '华夏成长混合',
    shares: 1000,
    avgCost: 1.0,
    totalCost: 1000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('updateLocalHoldingAfterTransaction', () => {
  describe('买入新基金', () => {
    it('持仓不存在时，创建新持仓', () => {
      const tx = makeBuyTx();
      const result = updateLocalHoldingAfterTransaction(undefined, tx);

      expect(result.holding).not.toBeNull();
      expect(result.holding!.fundCode).toBe('000001');
      expect(result.holding!.shares).toBe(1000);
      expect(result.holding!.avgCost).toBe(1.0);
      expect(result.holding!.totalCost).toBe(1000);
      expect(result.shouldDelete).toBe(false);
    });

    it('卖出新基金且持仓不存在时，不创建持仓', () => {
      const tx = makeSellTx();
      const result = updateLocalHoldingAfterTransaction(undefined, tx);

      expect(result.holding).toBeNull();
      expect(result.shouldDelete).toBe(false);
    });
  });

  describe('买入追加', () => {
    it('追加买入时份额正确累加', () => {
      const existing = makeHolding({ shares: 1000, avgCost: 1.0, totalCost: 1000 });
      const tx = makeBuyTx({ amount: 500, price: 1.2, shares: 416.67 });

      const result = updateLocalHoldingAfterTransaction(existing, tx);

      expect(result.holding!.shares).toBeCloseTo(1416.67, 1);
      expect(result.holding!.totalCost).toBeCloseTo(1500, 1);
      expect(result.shouldDelete).toBe(false);
    });

    it('追加买入时均价重新计算', () => {
      const existing = makeHolding({ shares: 1000, avgCost: 1.0, totalCost: 1000 });
      const tx = makeBuyTx({ amount: 1000, price: 2.0, shares: 500 });

      const result = updateLocalHoldingAfterTransaction(existing, tx);

      expect(result.holding!.avgCost).toBeCloseTo(1.333, 2);
    });
  });

  describe('卖出', () => {
    it('卖出后份额正确减少', () => {
      const existing = makeHolding({ shares: 1000, avgCost: 1.0, totalCost: 1000 });
      const tx = makeSellTx({ shares: 300, amount: 450 });

      const result = updateLocalHoldingAfterTransaction(existing, tx);

      expect(result.holding!.shares).toBe(700);
      expect(result.shouldDelete).toBe(false);
    });

    it('卖出后总成本正确减少', () => {
      const existing = makeHolding({ shares: 1000, avgCost: 1.0, totalCost: 1000 });
      const tx = makeSellTx({ shares: 300, amount: 450 });

      const result = updateLocalHoldingAfterTransaction(existing, tx);

      expect(result.holding!.totalCost).toBeCloseTo(550, 1);
    });

    it('卖出后均价重新计算', () => {
      const existing = makeHolding({ shares: 1000, avgCost: 1.0, totalCost: 1000 });
      const tx = makeSellTx({ shares: 300, amount: 450 });

      const result = updateLocalHoldingAfterTransaction(existing, tx);

      expect(result.holding!.avgCost).toBeCloseTo(550 / 700, 3);
    });

    it('全部卖出后应标记删除', () => {
      const existing = makeHolding({ shares: 1000, avgCost: 1.0, totalCost: 1000 });
      const tx = makeSellTx({ shares: 1000, amount: 1500 });

      const result = updateLocalHoldingAfterTransaction(existing, tx);

      expect(result.holding).toBeNull();
      expect(result.shouldDelete).toBe(true);
    });
  });
});

describe('reverseTransactionOnHolding', () => {
  describe('反向买入（删除买入交易）', () => {
    it('反向买入后份额正确减少', () => {
      const existing = makeHolding({ shares: 1500, avgCost: 1.2, totalCost: 1800 });
      const tx = makeBuyTx({ amount: 500, price: 1.0, shares: 500 });

      const result = reverseTransactionOnHolding(existing, tx);

      expect(result.holding!.shares).toBe(1000);
      expect(result.holding!.totalCost).toBe(1300);
      expect(result.shouldDelete).toBe(false);
    });

    it('反向买入全部撤销后应标记删除', () => {
      const existing = makeHolding({ shares: 1000, avgCost: 1.0, totalCost: 1000 });
      const tx = makeBuyTx({ amount: 1000, price: 1.0, shares: 1000 });

      const result = reverseTransactionOnHolding(existing, tx);

      expect(result.holding).toBeNull();
      expect(result.shouldDelete).toBe(true);
    });
  });

  describe('反向卖出（删除卖出交易）', () => {
    it('反向卖出后份额正确恢复', () => {
      const existing = makeHolding({ shares: 700, avgCost: 0.786, totalCost: 550 });
      const tx = makeSellTx({ shares: 300, amount: 450 });

      const result = reverseTransactionOnHolding(existing, tx);

      expect(result.holding!.shares).toBe(1000);
      expect(result.holding!.totalCost).toBe(1000);
      expect(result.shouldDelete).toBe(false);
    });
  });

  describe('边界情况', () => {
    it('持仓不存在时返回 null', () => {
      const tx = makeBuyTx();
      const result = reverseTransactionOnHolding(undefined, tx);

      expect(result.holding).toBeNull();
      expect(result.shouldDelete).toBe(false);
    });
  });
});
