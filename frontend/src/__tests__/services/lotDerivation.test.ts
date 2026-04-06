import { describe, it, expect, beforeEach } from 'vitest';
import {
  deriveLots,
  deriveRealizedLots,
  summarizeHoldings,
  matchSellLots,
  type Lot,
  type RealizedLot,
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

describe('deriveLots - 批次派生', () => {
  describe('基础买入', () => {
    it('单一买入交易生成一个批次', () => {
      const txs = [makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 1000, price: 1.0 })];
      
      const lots = deriveLots(txs);
      
      expect(lots).toHaveLength(1);
      expect(lots[0].fundCode).toBe('000001');
      expect(lots[0].shares).toBe(1000);
      expect(lots[0].remainingShares).toBe(1000);
      expect(lots[0].cost).toBe(1.0);
      expect(lots[0].isPending).toBe(false);
    });

    it('多个买入交易生成多个批次', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 1000, price: 1.0 }),
        makeBuyTx({ id: 'buy_002', date: '2024-02-01', shares: 500, price: 1.2 }),
      ];
      
      const lots = deriveLots(txs);
      
      expect(lots).toHaveLength(2);
    });
  });

  describe('在途交易', () => {
    it('pending 状态的买入不计入持仓份额', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 1000, price: 1.0, status: 'completed' }),
        makeBuyTx({ id: 'buy_002', date: '2024-02-01', shares: 500, price: 1.2, status: 'pending', amount: 600 }),
      ];
      
      const lots = deriveLots(txs);
      
      // completed 买入有 remainingShares，pending 买入 remainingShares 为 0
      const completedLot = lots.find(l => l.id === 'buy_001');
      const pendingLot = lots.find(l => l.id === 'buy_002');
      
      expect(completedLot?.remainingShares).toBe(1000);
      expect(pendingLot?.remainingShares).toBe(0);
      expect(pendingLot?.isPending).toBe(true);
      expect(pendingLot?.amount).toBe(600);
    });
  });

  describe('卖出匹配 - 按成本最低优先', () => {
    it('卖出时先匹配成本低的批次', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 1000, price: 1.0 }), // 成本 1.0
        makeBuyTx({ id: 'buy_002', date: '2024-02-01', shares: 500, price: 1.5 }),  // 成本 1.5
        makeSellTx({ id: 'sell_001', date: '2024-03-01', shares: 300, price: 1.2 }), // 卖出 300 份
      ];
      
      const lots = deriveLots(txs);
      
      // 成本 1.0 的批次应该先被卖出
      const lot1 = lots.find(l => l.id === 'buy_001');
      const lot2 = lots.find(l => l.id === 'buy_002');
      
      expect(lot1?.remainingShares).toBe(700); // 1000 - 300
      expect(lot2?.remainingShares).toBe(500); // 未被卖出
    });

    it('卖出超过第一个批次的份额，会延续到下一个批次', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 100, price: 1.0 }),
        makeBuyTx({ id: 'buy_002', date: '2024-02-01', shares: 100, price: 2.0 }),
        makeSellTx({ id: 'sell_001', date: '2024-03-01', shares: 150, price: 1.5 }),
      ];
      
      const lots = deriveLots(txs);
      
      // buy_001 剩余 0，被过滤掉（remainingShares > 0 才保留）
      const lot1 = lots.find(l => l.id === 'buy_001');
      const lot2 = lots.find(l => l.id === 'buy_002');
      
      expect(lot1).toBeUndefined(); // 全部卖出后被过滤
      expect(lot2?.remainingShares).toBe(50); // 卖出 50，还剩 50
    });

    it('跳过在途批次不参与卖出匹配', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 500, price: 1.0, status: 'pending' }),
        makeBuyTx({ id: 'buy_002', date: '2024-02-01', shares: 500, price: 1.5, status: 'completed' }),
        makeSellTx({ id: 'sell_001', date: '2024-03-01', shares: 300, price: 1.2 }),
      ];
      
      const lots = deriveLots(txs);
      
      // 只有 completed 的 buy_002 参与匹配
      const lot2 = lots.find(l => l.id === 'buy_002');
      expect(lot2?.remainingShares).toBe(200);
    });
  });

  describe('边界情况', () => {
    it('无交易返回空数组', () => {
      const lots = deriveLots([]);
      expect(lots).toHaveLength(0);
    });

    it('只有卖出交易返回空数组', () => {
      const txs = [makeSellTx()];
      const lots = deriveLots(txs);
      expect(lots).toHaveLength(0);
    });

    it('卖出金额超过持仓份额，remainingShares 为负导致批次被过滤', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', shares: 100, price: 1.0 }),
        makeSellTx({ id: 'sell_001', shares: 150, price: 1.2 }),
      ];
      
      const lots = deriveLots(txs);
      
      // remainingShares 为 -50，被过滤掉（remainingShares > 0 才保留）
      expect(lots).toHaveLength(0);
    });
  });
});

describe('deriveRealizedLots - 已实现盈亏派生', () => {
  describe('基础已实现盈亏计算', () => {
    it('卖出后正确计算盈亏', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 1000, price: 1.0, amount: 1000 }),
        makeSellTx({ id: 'sell_001', date: '2024-02-01', shares: 1000, price: 1.2, amount: 1200 }),
      ];
      
      const realized = deriveRealizedLots(txs);
      
      expect(realized).toHaveLength(1);
      expect(realized[0].profit).toBeCloseTo(200, 0); // 1200 - 1000
      expect(realized[0].profitRate).toBeCloseTo(0.2, 2); // 20%
      expect(realized[0].holdingDays).toBe(31); // 1月1日到2月1日
    });

    it('亏损情况', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', shares: 1000, price: 1.2, amount: 1200 }),
        makeSellTx({ id: 'sell_001', shares: 1000, price: 1.0, amount: 1000 }),
      ];
      
      const realized = deriveRealizedLots(txs);
      
      expect(realized[0].profit).toBeLessThan(0);
      expect(realized[0].profitRate).toBeLessThan(0);
    });
  });

  describe('部分卖出', () => {
    it('部分卖出时不记录已实现盈亏', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', shares: 1000, price: 1.0 }),
        makeSellTx({ id: 'sell_001', shares: 500, price: 1.2 }),
      ];
      
      const realized = deriveRealizedLots(txs);
      
      // 只有全部卖出才记录
      expect(realized).toHaveLength(0);
    });
  });

  describe('多批次卖出', () => {
    it('分批卖出 - 第一笔部分卖出不记录，第二笔完全卖出时记录', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 100, price: 1.0, amount: 100 }),
        makeSellTx({ id: 'sell_001', date: '2024-02-01', shares: 60, price: 1.2, amount: 72 }),
        makeSellTx({ id: 'sell_002', date: '2024-03-01', shares: 40, price: 1.3, amount: 52 }),
      ];
      
      const realized = deriveRealizedLots(txs);
      
      // sell_001 卖 60，buy_001 剩 40 → 未完全卖出，不记录
      // sell_002 卖 40，buy_001 剩 0 → 完全卖出，记录
      // profit = 40 * 1.3 - 40 * 1.0 = 52 - 40 = 12
      expect(realized).toHaveLength(1);
      expect(realized[0].profit).toBeCloseTo(12, 0);
      expect(realized[0].shares).toBe(40);
    });

    it('单笔完全卖出正确记录盈亏', () => {
      const txs = [
        makeBuyTx({ id: 'buy_001', date: '2024-01-01', shares: 100, price: 1.0, amount: 100 }),
        makeSellTx({ id: 'sell_001', date: '2024-02-01', shares: 100, price: 1.5, amount: 150 }),
      ];
      
      const realized = deriveRealizedLots(txs);
      
      expect(realized).toHaveLength(1);
      expect(realized[0].profit).toBeCloseTo(50, 0); // 100 * (1.5 - 1.0)
      expect(realized[0].profitRate).toBeCloseTo(0.5, 2); // 50%
    });
  });
});

describe('summarizeHoldings - 持仓汇总', () => {
  it('同一基金多批次合并计算', () => {
    const lots: Lot[] = [
      { id: '1', fundCode: '000001', fundName: '华夏', shares: 500, remainingShares: 500, cost: 1.0, date: '2024-01-01' },
      { id: '2', fundCode: '000001', fundName: '华夏', shares: 500, remainingShares: 300, cost: 1.5, date: '2024-02-01' },
    ];
    
    const summary = summarizeHoldings(lots);
    
    expect(summary).toHaveLength(1);
    expect(summary[0].shares).toBe(800); // 500 + 300
    expect(summary[0].totalCost).toBeCloseTo(950, 0); // 500*1.0 + 300*1.5
    expect(summary[0].avgCost).toBeCloseTo(1.1875, 3); // 950 / 800
  });

  it('不同基金分别汇总', () => {
    const lots: Lot[] = [
      { id: '1', fundCode: '000001', fundName: '华夏', shares: 100, remainingShares: 100, cost: 1.0, date: '2024-01-01' },
      { id: '2', fundCode: '000002', fundName: '易方达', shares: 200, remainingShares: 200, cost: 2.0, date: '2024-01-01' },
    ];
    
    const summary = summarizeHoldings(lots);
    
    expect(summary).toHaveLength(2);
  });
});

describe('matchSellLots - 卖出匹配', () => {
  it('基础卖出匹配', () => {
    const lots: Lot[] = [
      { id: '1', fundCode: '000001', fundName: '华夏', shares: 500, remainingShares: 500, cost: 1.0, date: '2024-01-01' },
      { id: '2', fundCode: '000001', fundName: '华夏', shares: 500, remainingShares: 500, cost: 1.5, date: '2024-02-01' },
    ];
    
    const result = matchSellLots(lots, '000001', 300);
    
    expect(result.lotsUsed).toHaveLength(1);
    expect(result.lotsUsed[0].lotId).toBe('1');
    expect(result.lotsUsed[0].shares).toBe(300);
    expect(result.remainingShares).toBe(0);
  });

  it('卖出超过持仓返回剩余', () => {
    const lots: Lot[] = [
      { id: '1', fundCode: '000001', fundName: '华夏', shares: 100, remainingShares: 100, cost: 1.0, date: '2024-01-01' },
    ];
    
    const result = matchSellLots(lots, '000001', 150);
    
    expect(result.lotsUsed[0].shares).toBe(100);
    expect(result.remainingShares).toBe(50);
  });
});
