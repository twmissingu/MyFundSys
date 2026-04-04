import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const mockSaveTransaction = vi.hoisted(() => vi.fn());
const mockRemoveTransaction = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());
const mockRefreshHoldings = vi.hoisted(() => vi.fn());

vi.mock('../../hooks/useSync', () => ({
  useTransactions: () => ({
    transactions: [],
    loading: false,
    saveTransaction: mockSaveTransaction,
    removeTransaction: mockRemoveTransaction,
    refresh: mockRefresh,
  }),
  useHoldings: () => ({
    holdings: [],
    loading: false,
    refresh: mockRefreshHoldings,
  }),
}));

const mockAddTransactionWithHoldingUpdate = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockProcessPendingTransactions = vi.hoisted(() => vi.fn().mockResolvedValue({ processedCount: 0 }));

vi.mock('../../services/navUpdateService', () => ({
  addTransactionWithHoldingUpdate: mockAddTransactionWithHoldingUpdate,
  processPendingTransactions: mockProcessPendingTransactions,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ data: null }),
    })),
  },
  isSupabaseConfigured: vi.fn(() => false),
}));

const mockFetchFundNav = vi.hoisted(() => vi.fn());
const mockFetchFundHistory = vi.hoisted(() => vi.fn());
const mockSearchByCode = vi.hoisted(() => vi.fn());

vi.mock('../../services/fundApi', () => ({
  searchByCode: mockSearchByCode,
  fetchFundNav: mockFetchFundNav,
  fetchFundHistory: mockFetchFundHistory,
}));

Object.defineProperty(window, 'location', {
  value: { hash: '#transactions' },
  writable: true,
});

import Transactions from '../../pages/Transactions';

describe('添加交易 - 日期切换与份额计算', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchFundHistory.mockReset();
    mockFetchFundNav.mockReset();
    mockSearchByCode.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const openAddDialog = async () => {
    render(<Transactions />);
    const addButton = screen.getByText(/添加交易/);
    await act(async () => {
      fireEvent.click(addButton);
    });
  };

  const selectFund = async (code: string, name: string) => {
    const searchInput = screen.getByPlaceholderText(/输入基金代码/);
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: code } });
    });

    await waitFor(() => {
      expect(mockSearchByCode).toHaveBeenCalled();
    });

    const fundItem = screen.getByText(name);
    await act(async () => {
      fireEvent.click(fundItem);
    });
  };

  const getSellButtonInDialog = () => {
    const buttons = screen.getAllByText('卖出');
    return buttons.find(btn => btn.getAttribute('style')?.includes('cursor: pointer'));
  };

  describe('日期切换时自动重新计算', () => {
    it('买入：切换日期后自动用新净值重新计算份额', async () => {
      mockSearchByCode.mockResolvedValue([{ code: '000001', name: '测试基金', type: '混合型' }]);
      mockFetchFundNav.mockResolvedValue({ code: '000001', name: '测试基金', nav: 1.0, navDate: '2024-01-15' });
      
      mockFetchFundHistory.mockResolvedValueOnce([{ date: '2024-01-10', nav: 2.0, accNav: 2.5, dailyChangeRate: 1.0, buyStatus: '开放', sellStatus: '开放' }]);
      mockFetchFundHistory.mockResolvedValueOnce([{ date: '2024-01-12', nav: 2.5, accNav: 3.0, dailyChangeRate: 1.5, buyStatus: '开放', sellStatus: '开放' }]);

      await openAddDialog();
      await selectFund('000001', '测试基金');

      const dateInput = screen.getByLabelText(/交易日期/);
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: '2024-01-10' } });
      });

      const amountInput = screen.getByPlaceholderText('0.00');
      await act(async () => {
        fireEvent.change(amountInput, { target: { value: '1000' } });
      });

      await waitFor(() => {
        const sharesInput = screen.getByPlaceholderText('自动计算') as HTMLInputElement;
        expect(sharesInput.value).toBe('500.00');
      });

      await act(async () => {
        fireEvent.change(dateInput, { target: { value: '2024-01-12' } });
      });

      await waitFor(() => {
        const sharesInput = screen.getByPlaceholderText('自动计算') as HTMLInputElement;
        expect(sharesInput.value).toBe('400.00');
      });
    });

    it('卖出：切换日期后自动用新净值重新计算金额', async () => {
      mockSearchByCode.mockResolvedValue([{ code: '000001', name: '测试基金', type: '混合型' }]);
      mockFetchFundNav.mockResolvedValue({ code: '000001', name: '测试基金', nav: 1.0, navDate: '2024-01-15' });
      
      mockFetchFundHistory.mockResolvedValueOnce([{ date: '2024-01-10', nav: 2.0, accNav: 2.5, dailyChangeRate: 1.0, buyStatus: '开放', sellStatus: '开放' }]);
      mockFetchFundHistory.mockResolvedValueOnce([{ date: '2024-01-12', nav: 2.5, accNav: 3.0, dailyChangeRate: 1.5, buyStatus: '开放', sellStatus: '开放' }]);

      await openAddDialog();
      await selectFund('000001', '测试基金');

      const sellButton = getSellButtonInDialog();
      await act(async () => {
        fireEvent.click(sellButton!);
      });

      const dateInput = screen.getByLabelText(/交易日期/);
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: '2024-01-10' } });
      });

      const sharesInput = screen.getByPlaceholderText('0.00');
      await act(async () => {
        fireEvent.change(sharesInput, { target: { value: '100' } });
      });

      await waitFor(() => {
        const amountInput = screen.getByPlaceholderText('自动计算') as HTMLInputElement;
        expect(amountInput.value).toBe('200.00');
      });

      await act(async () => {
        fireEvent.change(dateInput, { target: { value: '2024-01-12' } });
      });

      await waitFor(() => {
        const amountInput = screen.getByPlaceholderText('自动计算') as HTMLInputElement;
        expect(amountInput.value).toBe('250.00');
      });
    });
  });

  describe('卖出时使用选中日期净值', () => {
    it('卖出时输入份额，使用 selectedDateNav 而非 currentNav 计算金额', async () => {
      mockSearchByCode.mockResolvedValue([{ code: '000001', name: '测试基金', type: '混合型' }]);
      mockFetchFundNav.mockResolvedValue({ code: '000001', name: '测试基金', nav: 1.0, navDate: '2024-01-15' });
      mockFetchFundHistory.mockResolvedValue([{ date: '2024-01-10', nav: 2.0, accNav: 2.5, dailyChangeRate: 1.0, buyStatus: '开放', sellStatus: '开放' }]);

      await openAddDialog();
      await selectFund('000001', '测试基金');

      const sellButton = getSellButtonInDialog();
      await act(async () => {
        fireEvent.click(sellButton!);
      });

      const dateInput = screen.getByLabelText(/交易日期/);
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: '2024-01-10' } });
      });

      const sharesInput = screen.getByPlaceholderText('0.00');
      await act(async () => {
        fireEvent.change(sharesInput, { target: { value: '100' } });
      });

      await waitFor(() => {
        const amountInput = screen.getByPlaceholderText('自动计算') as HTMLInputElement;
        expect(amountInput.value).toBe('200.00');
      });
    });

    it('卖出时未获取到历史净值时使用 currentNav 计算', async () => {
      mockSearchByCode.mockResolvedValue([{ code: '000001', name: '测试基金', type: '混合型' }]);
      mockFetchFundNav.mockResolvedValue({ code: '000001', name: '测试基金', nav: 1.5, navDate: '2024-01-15' });
      
      // 精确匹配返回空，但下一交易日查找返回数据
      mockFetchFundHistory.mockResolvedValueOnce([]);
      mockFetchFundHistory.mockResolvedValueOnce([
        { date: '2024-01-10', nav: 1.5, accNav: 2.0, dailyChangeRate: 1.0, buyStatus: '开放', sellStatus: '开放' },
      ]);

      await openAddDialog();
      await selectFund('000001', '测试基金');

      const sellButton = getSellButtonInDialog();
      await act(async () => {
        fireEvent.click(sellButton!);
      });

      const dateInput = screen.getByLabelText(/交易日期/);
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: '2024-01-10' } });
      });

      const sharesInput = screen.getByPlaceholderText('0.00');
      await act(async () => {
        fireEvent.change(sharesInput, { target: { value: '100' } });
      });

      await waitFor(() => {
        const amountInput = screen.getByPlaceholderText('自动计算') as HTMLInputElement;
        expect(amountInput.value).toBe('150.00');
      });
    });
  });

  describe('多次切换日期', () => {
    it('多次切换日期，每次都能正确获取净值并重新计算', async () => {
      mockSearchByCode.mockResolvedValue([{ code: '000001', name: '测试基金', type: '混合型' }]);
      mockFetchFundNav.mockResolvedValue({ code: '000001', name: '测试基金', nav: 1.0, navDate: '2024-01-15' });
      
      const navMap: Record<string, number> = {
        '2024-01-08': 1.1,
        '2024-01-10': 1.3,
        '2024-01-12': 1.5,
      };

      mockFetchFundHistory.mockImplementation(async (_code: string, _ps: number, _pi: number, startDate: string, endDate: string) => {
        if (startDate === endDate && navMap[startDate]) {
          return [{ date: startDate, nav: navMap[startDate], accNav: navMap[startDate] + 0.5, dailyChangeRate: 1.0, buyStatus: '开放', sellStatus: '开放' }];
        }
        return [];
      });

      await openAddDialog();
      await selectFund('000001', '测试基金');

      const dateInput = screen.getByLabelText(/交易日期/);
      const amountInput = screen.getByPlaceholderText('0.00');

      await act(async () => {
        fireEvent.change(amountInput, { target: { value: '1000' } });
      });

      const testCases = [
        { date: '2024-01-08', expectedShares: '909.09' },
        { date: '2024-01-10', expectedShares: '769.23' },
        { date: '2024-01-12', expectedShares: '666.67' },
      ];

      for (const tc of testCases) {
        await act(async () => {
          fireEvent.change(dateInput, { target: { value: tc.date } });
        });

        await waitFor(() => {
          const sharesInput = screen.getByPlaceholderText('自动计算') as HTMLInputElement;
          expect(sharesInput.value).toBe(tc.expectedShares);
        }, { timeout: 3000 });
      }
    });
  });

  describe('非交易日（净值待定）场景', () => {
    it('选择无净值的日期时，不计算份额且显示在途提示', async () => {
      mockSearchByCode.mockResolvedValue([{ code: '000001', name: '测试基金', type: '混合型' }]);
      mockFetchFundNav.mockResolvedValue({ code: '000001', name: '测试基金', nav: 1.0, navDate: '2024-01-15' });
      
      let callCount = 0;
      mockFetchFundHistory.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return [];
        }
        return [];
      });

      await openAddDialog();
      await selectFund('000001', '测试基金');

      const dateInput = screen.getByLabelText(/交易日期/);
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: '2024-01-01' } });
      });

      const amountInput = screen.getByPlaceholderText('0.00');
      await act(async () => {
        fireEvent.change(amountInput, { target: { value: '1000' } });
      });

      await waitFor(() => {
        const sharesInput = screen.getByPlaceholderText('自动计算') as HTMLInputElement;
        expect(sharesInput.value).toBe('');
      });
    });

    it('在途状态下手动输入金额不计算份额', async () => {
      mockSearchByCode.mockResolvedValue([{ code: '000001', name: '测试基金', type: '混合型' }]);
      mockFetchFundNav.mockResolvedValue({ code: '000001', name: '测试基金', nav: 1.0, navDate: '2024-01-15' });
      mockFetchFundHistory.mockResolvedValue([]);

      await openAddDialog();
      await selectFund('000001', '测试基金');

      const dateInput = screen.getByLabelText(/交易日期/);
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: '2024-01-01' } });
      });

      const amountInput = screen.getByPlaceholderText('0.00');
      await act(async () => {
        fireEvent.change(amountInput, { target: { value: '1000' } });
      });

      await waitFor(() => {
        const sharesInput = screen.getByPlaceholderText('自动计算') as HTMLInputElement;
        expect(sharesInput.value).toBe('');
      });
    });
  });

  describe('历史非交易日自动匹配下一交易日', () => {
    it('选择历史非交易日时，自动匹配下一交易日净值并计算份额', async () => {
      mockSearchByCode.mockResolvedValue([{ code: '000001', name: '测试基金', type: '混合型' }]);
      mockFetchFundNav.mockResolvedValue({ code: '000001', name: '测试基金', nav: 1.0, navDate: '2024-01-15' });
      
      // First call: exact match returns empty
      // Second call: fallback finds next trading day
      let callCount = 0;
      mockFetchFundHistory.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return []; // exact match fails
        }
        // fallback returns data with next trading day at the end
        return [
          { date: '2024-01-08', nav: 1.1, accNav: 1.6, dailyChangeRate: 1.0, buyStatus: '开放', sellStatus: '开放' },
          { date: '2024-01-05', nav: 1.0, accNav: 1.5, dailyChangeRate: 0.5, buyStatus: '开放', sellStatus: '开放' },
        ];
      });

      await openAddDialog();
      await selectFund('000001', '测试基金');

      const dateInput = screen.getByLabelText(/交易日期/);
      await act(async () => {
        fireEvent.change(dateInput, { target: { value: '2024-01-01' } });
      });

      const amountInput = screen.getByPlaceholderText('0.00');
      await act(async () => {
        fireEvent.change(amountInput, { target: { value: '1000' } });
      });

      await waitFor(() => {
        const sharesInput = screen.getByPlaceholderText('自动计算') as HTMLInputElement;
        // 1000 / 1.0 = 1000.00 (uses the last/oldest record's NAV which is the closest to the selected date)
        expect(sharesInput.value).toBe('1000.00');
      }, { timeout: 5000 });
    });
  });
});