import { describe, it, expect } from 'vitest';
import {
  formatMoney,
  formatPercent,
  getValuationStatus,
  calculateMA,
  calculateStdDev,
  getProfitColor,
} from '../../utils';

describe('formatMoney', () => {
  it('正数：正确格式化人民币', () => {
    expect(formatMoney(1234.56)).toBe('¥1,234.56');
  });

  it('零值：显示 ¥0.00', () => {
    expect(formatMoney(0)).toBe('¥0.00');
  });

  it('负数：正确格式化负金额', () => {
    expect(formatMoney(-500)).toBe('-¥500.00');
  });

  it('大数：正确添加千位分隔符', () => {
    expect(formatMoney(1000000)).toBe('¥1,000,000.00');
  });
});

describe('formatPercent', () => {
  it('0% 显示 0.00%', () => {
    expect(formatPercent(0)).toBe('0.00%');
  });

  it('50% 显示 50.00%', () => {
    expect(formatPercent(0.5)).toBe('50.00%');
  });

  it('100% 显示 100.00%', () => {
    expect(formatPercent(1)).toBe('100.00%');
  });

  it('负数百分比', () => {
    expect(formatPercent(-0.1)).toBe('-10.00%');
  });
});

describe('getValuationStatus', () => {
  it('百分位 < 0.2 → 钻石坑', () => {
    expect(getValuationStatus(0.1).text).toBe('钻石坑');
  });

  it('百分位 0.2-0.4 → 低估', () => {
    expect(getValuationStatus(0.3).text).toBe('低估');
  });

  it('百分位 0.4-0.6 → 合理', () => {
    expect(getValuationStatus(0.5).text).toBe('合理');
  });

  it('百分位 0.6-0.8 → 高估', () => {
    expect(getValuationStatus(0.7).text).toBe('高估');
  });

  it('百分位 >= 0.8 → 危险', () => {
    expect(getValuationStatus(0.9).text).toBe('危险');
  });

  it('边界值 0.2 → 低估', () => {
    expect(getValuationStatus(0.2).text).toBe('低估');
  });
});

describe('calculateMA', () => {
  const data = [1, 2, 3, 4, 5, 6];

  it('period=3 时，前2个值为 NaN', () => {
    const result = calculateMA(data, 3);
    expect(isNaN(result[0])).toBe(true);
    expect(isNaN(result[1])).toBe(true);
  });

  it('period=3 时，第3个值为前3个均值', () => {
    const result = calculateMA(data, 3);
    expect(result[2]).toBeCloseTo(2); // (1+2+3)/3=2
  });

  it('period=3 时，第4个值正确', () => {
    const result = calculateMA(data, 3);
    expect(result[3]).toBeCloseTo(3); // (2+3+4)/3=3
  });

  it('空数组返回空数组', () => {
    expect(calculateMA([], 3)).toEqual([]);
  });
});

describe('calculateStdDev', () => {
  it('空数组返回 0', () => {
    expect(calculateStdDev([])).toBe(0);
  });

  it('全相同值时标准差为 0', () => {
    expect(calculateStdDev([5, 5, 5, 5])).toBe(0);
  });

  it('[2, 4, 4, 4, 5, 5, 7, 9] 标准差约为 2', () => {
    expect(calculateStdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2);
  });
});

describe('getProfitColor', () => {
  it('正数 → 红色（A股涨为红）', () => {
    expect(getProfitColor(1)).toBe('#ff4d4f');
  });

  it('负数 → 绿色（A股跌为绿）', () => {
    expect(getProfitColor(-1)).toBe('#52c41a');
  });

  it('零 → 灰色', () => {
    expect(getProfitColor(0)).toBe('#8c8c8c');
  });
});
