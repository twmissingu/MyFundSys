import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * 测试日期变化时净值是否正确更新
 * 
 * 模拟逻辑：
 * 1. 选择历史日期 → 调用 fetchFundHistory 获取该日期净值
 * 2. 切换日期 → 重新调用 fetchFundHistory 获取新日期净值
 * 3. 选择当天 → 使用 currentNav
 */

// 模拟 fetchFundHistory 返回不同日期的净值
const mockHistoryData: Record<string, { date: string; nav: number }[]> = {
  '000001': [
    { date: '2024-01-08', nav: 1.1000 },
    { date: '2024-01-09', nav: 1.2000 },
    { date: '2024-01-10', nav: 1.3000 },
    { date: '2024-01-11', nav: 1.4000 },
    { date: '2024-01-12', nav: 1.5000 },
  ],
};

// 模拟 fetchFundHistory 函数
async function mockFetchFundHistory(
  fundCode: string,
  _pageSize: number,
  _pageIndex: number,
  startDate: string
): Promise<{ date: string; nav: number }[]> {
  const allData = mockHistoryData[fundCode] || [];
  if (!startDate) return allData;
  return allData.filter(h => h.date >= startDate);
}

// 模拟获取指定日期净值的逻辑
function getNavForDate(historyData: { date: string; nav: number }[], targetDate: string): number | null {
  const match = historyData.find(h => h.date === targetDate);
  if (match) return match.nav;
  if (historyData.length > 0) return historyData[0].nav;
  return null;
}

describe('日期变化时净值更新逻辑', () => {
  describe('getNavForDate - 获取指定日期净值', () => {
    it('精确匹配日期时返回对应净值', () => {
      const data = mockHistoryData['000001'];
      expect(getNavForDate(data, '2024-01-10')).toBe(1.3000);
      expect(getNavForDate(data, '2024-01-08')).toBe(1.1000);
    });

    it('日期不存在时返回第一条数据', () => {
      const data = mockHistoryData['000001'];
      expect(getNavForDate(data, '2024-01-15')).toBe(1.1000);
    });

    it('无数据时返回 null', () => {
      expect(getNavForDate([], '2024-01-10')).toBeNull();
    });
  });

  describe('日期切换场景', () => {
    it('从日期A切换到日期B，净值应更新为B的净值', async () => {
      // 模拟用户操作流程
      let selectedDateNav: { nav: number; date: string } | null = null;

      // 用户选择 2024-01-10
      const dateA = '2024-01-10';
      const historyA = await mockFetchFundHistory('000001', 1, 1, dateA);
      selectedDateNav = { nav: getNavForDate(historyA, dateA)!, date: dateA };
      expect(selectedDateNav.nav).toBe(1.3000);
      expect(selectedDateNav.date).toBe('2024-01-10');

      // 用户切换为 2024-01-12
      const dateB = '2024-01-12';
      const historyB = await mockFetchFundHistory('000001', 1, 1, dateB);
      selectedDateNav = { nav: getNavForDate(historyB, dateB)!, date: dateB };
      expect(selectedDateNav.nav).toBe(1.5000);
      expect(selectedDateNav.date).toBe('2024-01-12');
    });

    it('多次切换日期，每次都能获取到正确的净值', async () => {
      let selectedDateNav: { nav: number; date: string } | null = null;

      const dates = ['2024-01-08', '2024-01-10', '2024-01-12', '2024-01-09'];
      const expectedNavs = [1.1000, 1.3000, 1.5000, 1.2000];

      for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        const history = await mockFetchFundHistory('000001', 1, 1, date);
        selectedDateNav = { nav: getNavForDate(history, date)!, date };
        expect(selectedDateNav.nav).toBe(expectedNavs[i]);
        expect(selectedDateNav.date).toBe(date);
      }
    });
  });

  describe('份额计算', () => {
    it('使用正确日期的净值计算份额', () => {
      const amount = 1000;
      const nav = 1.3000; // 2024-01-10 的净值
      const shares = amount / nav;
      expect(shares).toBeCloseTo(769.23, 2);
    });

    it('日期切换后份额计算使用新净值', () => {
      const amount = 1000;
      
      // 日期A: 2024-01-10, 净值 1.3000
      const navA = 1.3000;
      const sharesA = amount / navA;
      
      // 日期B: 2024-01-12, 净值 1.5000
      const navB = 1.5000;
      const sharesB = amount / navB;
      
      expect(sharesA).toBeCloseTo(769.23, 2);
      expect(sharesB).toBeCloseTo(666.67, 2);
      expect(sharesB).toBeLessThan(sharesA); // 净值越高，份额越少
    });
  });
});
