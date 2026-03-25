import { describe, it, expect } from 'vitest';
import { runBacktest, generateMockPriceData } from '../../services/backtest';
import type { Strategy } from '../../types';

describe('backtest', () => {
  const mockStrategy: Strategy = {
    id: 's_001',
    name: '测试策略',
    description: '用于测试的策略',
    type: 'valuation',
    rules: [
      { condition: 'percentile < 20', action: 'buy', params: { ratio: 0.5 } },
      { condition: 'percentile > 80', action: 'sell', params: { ratio: 0.5 } },
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  describe('generateMockPriceData', () => {
    it('生成指定日期范围的价格数据', () => {
      const data = generateMockPriceData('2024-01-01', '2024-01-31');

      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('date');
      expect(data[0]).toHaveProperty('price');
      expect(data[0]).toHaveProperty('pe');
      expect(data[0]).toHaveProperty('pb');
    });

    it('价格数据按日期升序排列', () => {
      const data = generateMockPriceData('2024-01-01', '2024-01-10');

      for (let i = 1; i < data.length; i++) {
        const prevDate = new Date(data[i - 1].date).getTime();
        const currDate = new Date(data[i].date).getTime();
        expect(currDate).toBeGreaterThanOrEqual(prevDate);
      }
    });

    it('周末数据被跳过', () => {
      // 从周三开始，应该只返回工作日数据
      const data = generateMockPriceData('2024-01-01', '2024-01-07');

      data.forEach(item => {
        const date = new Date(item.date);
        const dayOfWeek = date.getDay();
        expect(dayOfWeek).not.toBe(0); // 周日
        expect(dayOfWeek).not.toBe(6); // 周六
      });
    });
  });

  describe('runBacktest', () => {
    it('回测返回完整的结果对象', async () => {
      const priceData = generateMockPriceData('2024-01-01', '2024-01-31', 1.0);

      const result = await runBacktest({
        strategy: mockStrategy,
        fundCode: '000001',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        initialCapital: 10000,
        priceData,
      });

      expect(result).toHaveProperty('strategyName', '测试策略');
      expect(result).toHaveProperty('startDate', '2024-01-01');
      expect(result).toHaveProperty('endDate', '2024-01-31');
      expect(result).toHaveProperty('initialCapital', 10000);
      expect(result).toHaveProperty('finalValue');
      expect(result).toHaveProperty('totalReturn');
      expect(result).toHaveProperty('annualizedReturn');
      expect(result).toHaveProperty('maxDrawdown');
      expect(result).toHaveProperty('sharpeRatio');
      expect(result).toHaveProperty('trades');
      expect(result).toHaveProperty('equityCurve');
    });

    it('权益曲线与交易日数量一致', async () => {
      const priceData = generateMockPriceData('2024-01-01', '2024-01-10', 1.0);

      const result = await runBacktest({
        strategy: mockStrategy,
        fundCode: '000001',
        startDate: '2024-01-01',
        endDate: '2024-01-10',
        initialCapital: 10000,
        priceData,
      });

      expect(result.equityCurve.length).toBe(priceData.length);
    });

    it('定投策略回测', async () => {
      const monthlyStrategy: Strategy = {
        id: 's_002',
        name: '定投策略',
        description: '每月定投',
        type: 'trend',
        rules: [
          { condition: 'monthly', action: 'buy', params: { amount: 1000 } },
        ],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      const priceData = generateMockPriceData('2024-01-01', '2024-03-31', 1.0);

      const result = await runBacktest({
        strategy: monthlyStrategy,
        fundCode: '000001',
        startDate: '2024-01-01',
        endDate: '2024-03-31',
        initialCapital: 10000,
        priceData,
      });

      expect(result.strategyName).toBe('定投策略');
      expect(result.trades).toBeGreaterThanOrEqual(0);
    });

    it('初始资金正确反映在最终价值中', async () => {
      const priceData = generateMockPriceData('2024-01-01', '2024-01-05', 1.0);

      const result = await runBacktest({
        strategy: { ...mockStrategy, rules: [] }, // 无规则，不交易
        fundCode: '000001',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        initialCapital: 5000,
        priceData,
      });

      expect(result.initialCapital).toBe(5000);
      // 无交易时最终价值应等于初始资金
      expect(result.finalValue).toBe(5000);
      expect(result.totalReturn).toBe(0);
    });
  });
});
