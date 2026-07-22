import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGridStrategies, useGridDetail } from '../../hooks/useGrid';
import type { GridStrategy, GridExecution, GridLevelWithStatus, GridFundOverview, GridType } from '../../types';

// ---- Mock gridService ----
const mockFetchGridStrategies = vi.hoisted(() => vi.fn());
const mockFetchGridExecutions = vi.hoisted(() => vi.fn());
const mockFetchAllGridExecutions = vi.hoisted(() => vi.fn());
const mockFetchGridStrategyByFund = vi.hoisted(() => vi.fn());
const mockExecuteGrid = vi.hoisted(() => vi.fn());
const mockDeriveGridStatuses = vi.hoisted(() => vi.fn());
const mockComputeFundOverview = vi.hoisted(() => vi.fn());
const mockCalculateSellShares = vi.hoisted(() => vi.fn());
const mockShouldLiquidate = vi.hoisted(() => vi.fn());

vi.mock('../../services/gridService', () => ({
  fetchGridStrategies: mockFetchGridStrategies,
  fetchGridExecutions: mockFetchGridExecutions,
  fetchAllGridExecutions: mockFetchAllGridExecutions,
  fetchGridStrategyByFund: mockFetchGridStrategyByFund,
  executeGrid: mockExecuteGrid,
  deriveGridStatuses: mockDeriveGridStatuses,
  computeFundOverview: mockComputeFundOverview,
  calculateSellShares: mockCalculateSellShares,
  shouldLiquidate: mockShouldLiquidate,
}));

// ---- Mock fundApi ----
const mockFetchFundNav = vi.hoisted(() => vi.fn());

vi.mock('../../services/fundApi', () => ({
  fetchFundNav: mockFetchFundNav,
}));

// ---- Test helpers ----
function makeStrategy(overrides: Partial<GridStrategy> = {}): GridStrategy {
  return {
    id: 'gs_001',
    fund_code: '000001',
    fund_name: '测试基金',
    peak_price: 2.0,
    bottom_price: 1.0,
    grid_config: {
      small: {
        label: '小网',
        spacing_pct: 0.05,
        grid_count: 2,
        base_investment: 1000,
        increment_pct: 0.1,
        profit_rules: [0, 0.2],
        grids: [
          { level: 1, trigger_price: 1.0, investment: 1000, cumulative: 1000, sell_price: 1.05, profit: 50, profit_retention_pct: 0 },
          { level: 2, trigger_price: 1.05, investment: 1100, cumulative: 2100, sell_price: 1.1025, profit: 55, profit_retention_pct: 0.2 },
        ],
      },
      medium: {
        label: '中网',
        spacing_pct: 0.1,
        grid_count: 1,
        base_investment: 2000,
        increment_pct: 0.1,
        profit_rules: [0],
        grids: [
          { level: 1, trigger_price: 1.0, investment: 2000, cumulative: 2000, sell_price: 1.1, profit: 200, profit_retention_pct: 0 },
        ],
      },
      large: {
        label: '大网',
        spacing_pct: 0.15,
        grid_count: 1,
        base_investment: 3000,
        increment_pct: 0.1,
        profit_rules: [0],
        grids: [
          { level: 1, trigger_price: 1.0, investment: 3000, cumulative: 3000, sell_price: 1.15, profit: 450, profit_retention_pct: 0 },
        ],
      },
    },
    is_active: true,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    ...overrides,
  };
}

function makeExecution(overrides: Partial<GridExecution> = {}): GridExecution {
  return {
    id: 'ge_001',
    strategy_id: 'gs_001',
    fund_code: '000001',
    grid_type: 'small',
    grid_level: 1,
    action: 'buy',
    status: 'executed',
    transaction_id: 'tx_001',
    executed_nav: 1.0,
    executed_amount: 1000,
    executed_shares: 1000,
    remaining_shares: 800,
    executed_at: '2024-01-01',
    ...overrides,
  };
}

function makeLevelsByType(overrides: Partial<Record<GridType, GridLevelWithStatus[]>> = {}): Record<GridType, GridLevelWithStatus[]> {
  const defaults: Record<GridType, GridLevelWithStatus[]> = {
    small: [
      {
        level: 1, trigger_price: 1.0, investment: 1000, cumulative: 1000, sell_price: 1.05, profit: 50, profit_retention_pct: 0,
        status: 'executed', distance_pct: 5,
        execution: makeExecution(),
      },
      {
        level: 2, trigger_price: 1.05, investment: 1100, cumulative: 2100, sell_price: 1.1025, profit: 55, profit_retention_pct: 0.2,
        status: 'above', distance_pct: -2,
      },
    ],
    medium: [
      {
        level: 1, trigger_price: 1.0, investment: 2000, cumulative: 2000, sell_price: 1.1, profit: 200, profit_retention_pct: 0,
        status: 'triggered', distance_pct: 0,
      },
    ],
    large: [
      {
        level: 1, trigger_price: 1.0, investment: 3000, cumulative: 3000, sell_price: 1.15, profit: 450, profit_retention_pct: 0,
        status: 'above', distance_pct: -5,
      },
    ],
  };
  return { ...defaults, ...overrides };
}

function makeOverview(strategy: GridStrategy, overrides: Partial<GridFundOverview> = {}): GridFundOverview {
  return {
    strategy,
    current_nav: 1.05,
    nearest_trigger: { price: 1.0, distance_pct: 5, grid_type: 'small', level: 1 },
    total_budget: 7100,
    capital_deployed: 1000,
    executed_count: 1,
    total_grid_count: 4,
    triggered_pending_count: 1,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchGridStrategies.mockResolvedValue([]);
  mockFetchAllGridExecutions.mockResolvedValue([]);
  mockFetchGridExecutions.mockResolvedValue([]);
  mockFetchGridStrategyByFund.mockResolvedValue(null);
  mockFetchFundNav.mockResolvedValue({ code: '000001', name: '测试基金', nav: 1.05, navDate: '2024-01-01', dailyChange: 0.05, dailyChangeRate: 5 });
  mockDeriveGridStatuses.mockReturnValue(makeLevelsByType());
  mockComputeFundOverview.mockImplementation((strategy: GridStrategy) => makeOverview(strategy));
  mockCalculateSellShares.mockReturnValue({ sellShares: 800, retainShares: 200 });
  mockShouldLiquidate.mockReturnValue(false);
  mockExecuteGrid.mockResolvedValue({ executionId: 'ge_new', transactionId: 'tx_new' });
});

// ============================================
// useGridStrategies
// ============================================
describe('useGridStrategies', () => {
  it('初始状态为 loading=true, overviews=[], error=null', () => {
    const { result } = renderHook(() => useGridStrategies());
    expect(result.current.loading).toBe(true);
    expect(result.current.overviews).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('无策略时加载完成后 overviews 为空', async () => {
    mockFetchGridStrategies.mockResolvedValue([]);
    const { result } = renderHook(() => useGridStrategies());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.overviews).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('有策略时加载完成后返回正确的 overview 列表', async () => {
    const strategy = makeStrategy();
    mockFetchGridStrategies.mockResolvedValue([strategy]);
    mockFetchAllGridExecutions.mockResolvedValue([]);
    const { result } = renderHook(() => useGridStrategies());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.overviews).toHaveLength(1);
    expect(result.current.overviews[0].strategy.fund_code).toBe('000001');
  });

  it('相同 fund_code 的执行记录正确分组', async () => {
    const strategy = makeStrategy();
    mockFetchGridStrategies.mockResolvedValue([strategy]);
    mockFetchAllGridExecutions.mockResolvedValue([
      makeExecution({ id: 'ge_001', fund_code: '000001', grid_type: 'small' }),
      makeExecution({ id: 'ge_002', fund_code: '000001', grid_type: 'medium' }),
    ]);
    const { result } = renderHook(() => useGridStrategies());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.overviews).toHaveLength(1);
    expect(mockComputeFundOverview).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([
        expect.objectContaining({ id: 'ge_001' }),
        expect.objectContaining({ id: 'ge_002' }),
      ]),
      expect.any(Number)
    );
  });

  it('fetchFundNav 失败时不再回退到 bottom_price（避免错误买入信号，修复 #10）', async () => {
    const strategy = makeStrategy({ bottom_price: 0.8 });
    mockFetchGridStrategies.mockResolvedValue([strategy]);
    mockFetchAllGridExecutions.mockResolvedValue([]);
    mockFetchFundNav.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useGridStrategies());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockComputeFundOverview).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      Number.NaN
    );
  });

  it('fetchGridStrategies 抛异常时设置 error', async () => {
    mockFetchGridStrategies.mockRejectedValue(new Error('DB Error'));
    const { result } = renderHook(() => useGridStrategies());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('DB Error');
    expect(result.current.overviews).toEqual([]);
  });

  it('按 nearest_trigger 的 distance_pct 绝对值排序', async () => {
    const strat1 = makeStrategy({ id: 'gs_001', fund_code: '000001' });
    const strat2 = makeStrategy({ id: 'gs_002', fund_code: '000002' });
    mockFetchGridStrategies.mockResolvedValue([strat1, strat2]);
    mockFetchAllGridExecutions.mockResolvedValue([]);
    mockComputeFundOverview.mockImplementation((strategy: GridStrategy) => {
      const distance = strategy.fund_code === '000001' ? 10 : 2;
      return makeOverview(strategy, { nearest_trigger: { price: 1.0, distance_pct: distance, grid_type: 'small', level: 1 } });
    });
    const { result } = renderHook(() => useGridStrategies());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.overviews[0].strategy.fund_code).toBe('000002');
    expect(result.current.overviews[1].strategy.fund_code).toBe('000001');
  });

  it('refresh 调用后重新加载数据', async () => {
    const strategy = makeStrategy();
    mockFetchGridStrategies.mockResolvedValue([strategy]);
    const { result } = renderHook(() => useGridStrategies());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchGridStrategies).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.refresh(); });
    expect(mockFetchGridStrategies).toHaveBeenCalledTimes(2);
  });
});

// ============================================
// useGridDetail
// ============================================
describe('useGridDetail', () => {
  it('初始状态为 loading=true, strategy=null', () => {
    const { result } = renderHook(() => useGridDetail('000001'));
    expect(result.current.loading).toBe(true);
    expect(result.current.strategy).toBeNull();
    expect(result.current.currentNav).toBeNull();
  });

  it('无策略时 strategy=null, loading=false', async () => {
    mockFetchGridStrategyByFund.mockResolvedValue(null);
    const { result } = renderHook(() => useGridDetail('000001'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.strategy).toBeNull();
  });

  it('有策略时正确加载 strategy, levelsByType, currentNav', async () => {
    const strategy = makeStrategy();
    mockFetchGridStrategyByFund.mockResolvedValue(strategy);
    const levels = makeLevelsByType();
    mockDeriveGridStatuses.mockReturnValue(levels);
    const { result } = renderHook(() => useGridDetail('000001'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.strategy).toEqual(strategy);
    expect(result.current.levelsByType).toEqual(levels);
    expect(result.current.currentNav).toBe(1.05);
  });

  it('fetchFundNav 失败时不再回退到 strat.bottom_price（修复 #10）', async () => {
    const strategy = makeStrategy({ bottom_price: 0.8 });
    mockFetchGridStrategyByFund.mockResolvedValue(strategy);
    mockFetchFundNav.mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useGridDetail('000001'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.currentNav).toBeNaN();
  });

  it('baseShares 计算已买入未卖出格子的份额之和', async () => {
    const strategy = makeStrategy();
    mockFetchGridStrategyByFund.mockResolvedValue(strategy);
    mockDeriveGridStatuses.mockReturnValue(makeLevelsByType({
      small: [
        {
          level: 1, trigger_price: 1.0, investment: 1000, cumulative: 1000, sell_price: 1.05, profit: 50, profit_retention_pct: 0,
          status: 'executed', distance_pct: 5,
          execution: makeExecution({ remaining_shares: 500, executed_shares: 1000 }),
        },
        {
          level: 2, trigger_price: 1.05, investment: 1100, cumulative: 2100, sell_price: 1.1025, profit: 55, profit_retention_pct: 0.2,
          status: 'above', distance_pct: -2,
        },
      ],
      medium: [
        {
          level: 1, trigger_price: 1.0, investment: 2000, cumulative: 2000, sell_price: 1.1, profit: 200, profit_retention_pct: 0,
          status: 'executed', distance_pct: 0,
          execution: makeExecution({ grid_type: 'medium', remaining_shares: 300, executed_shares: 300 }),
        },
      ],
      large: [
        {
          level: 1, trigger_price: 1.0, investment: 3000, cumulative: 3000, sell_price: 1.15, profit: 450, profit_retention_pct: 0,
          status: 'above', distance_pct: -5,
        },
      ],
    }));
    const { result } = renderHook(() => useGridDetail('000001'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.baseShares).toBe(800);
  });

  it('baseShares 为 0 当没有已买入未卖出格子', async () => {
    const strategy = makeStrategy();
    mockFetchGridStrategyByFund.mockResolvedValue(strategy);
    mockDeriveGridStatuses.mockReturnValue(makeLevelsByType({
      small: [
        {
          level: 1, trigger_price: 1.0, investment: 1000, cumulative: 1000, sell_price: 1.05, profit: 50, profit_retention_pct: 0,
          status: 'triggered', distance_pct: 5,
        },
      ],
      medium: [
        {
          level: 1, trigger_price: 1.0, investment: 2000, cumulative: 2000, sell_price: 1.1, profit: 200, profit_retention_pct: 0,
          status: 'above', distance_pct: 0,
        },
      ],
      large: [
        {
          level: 1, trigger_price: 1.0, investment: 3000, cumulative: 3000, sell_price: 1.15, profit: 450, profit_retention_pct: 0,
          status: 'above', distance_pct: -5,
        },
      ],
    }));
    const { result } = renderHook(() => useGridDetail('000001'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.baseShares).toBe(0);
  });

  it('shouldLiquidate 为 true 当触发清仓条件', async () => {
    const strategy = makeStrategy();
    mockFetchGridStrategyByFund.mockResolvedValue(strategy);
    mockShouldLiquidate.mockReturnValue(true);
    const { result } = renderHook(() => useGridDetail('000001'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.shouldLiquidate).toBe(true);
  });

  it('shouldLiquidate 为 false 当未触发清仓条件', async () => {
    const strategy = makeStrategy();
    mockFetchGridStrategyByFund.mockResolvedValue(strategy);
    mockShouldLiquidate.mockReturnValue(false);
    const { result } = renderHook(() => useGridDetail('000001'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.shouldLiquidate).toBe(false);
  });

  it('executeGridLevel 策略未加载时抛错', async () => {
    mockFetchGridStrategyByFund.mockResolvedValue(null);
    const { result } = renderHook(() => useGridDetail('000001'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(result.current.executeGridLevel('small', 1)).rejects.toThrow('策略或净值数据未加载');
  });

  it('executeGridLevel 找不到 gridLevel 时抛错', async () => {
    const strategy = makeStrategy();
    mockFetchGridStrategyByFund.mockResolvedValue(strategy);
    const { result } = renderHook(() => useGridDetail('000001'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(result.current.executeGridLevel('small', 999)).rejects.toThrow('未找到 small 网格第 999 层');
  });

  it('executeGridLevel 正常执行买入并刷新', async () => {
    const strategy = makeStrategy();
    mockFetchGridStrategyByFund.mockResolvedValue(strategy);
    const { result } = renderHook(() => useGridDetail('000001'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.executeGridLevel('small', 1); });
    expect(mockExecuteGrid).toHaveBeenCalledWith(expect.objectContaining({
      strategyId: 'gs_001',
      fundCode: '000001',
      gridType: 'small',
      gridLevel: 1,
      action: 'buy',
      triggerPrice: 1.0,
      investmentAmount: 1000,
    }));
  });

  it('sellGridLevel 找不到买入记录时抛错', async () => {
    const strategy = makeStrategy();
    mockFetchGridStrategyByFund.mockResolvedValue(strategy);
    mockDeriveGridStatuses.mockReturnValue(makeLevelsByType({
      small: [
        {
          level: 1, trigger_price: 1.0, investment: 1000, cumulative: 1000, sell_price: 1.05, profit: 50, profit_retention_pct: 0,
          status: 'triggered', distance_pct: 5,
          execution: undefined,
        },
      ],
    }));
    const { result } = renderHook(() => useGridDetail('000001'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(result.current.sellGridLevel('small', 1)).rejects.toThrow('未找到买入记录，无法卖出');
  });

  it('sellGridLevel 正常执行卖出并刷新', async () => {
    const strategy = makeStrategy();
    mockFetchGridStrategyByFund.mockResolvedValue(strategy);
    const { result } = renderHook(() => useGridDetail('000001'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.sellGridLevel('small', 1); });
    // 修复 #5：基于 remaining_shares（默认 800）而非 executed_shares
    expect(mockCalculateSellShares).toHaveBeenCalledWith(800, 0);
    expect(mockExecuteGrid).toHaveBeenCalledWith(expect.objectContaining({
      strategyId: 'gs_001',
      fundCode: '000001',
      gridType: 'small',
      gridLevel: 1,
      action: 'sell',
      triggerPrice: 1.05,
      sellShares: 800,
      buyExecutionId: 'ge_001',
    }));
  });

  it('liquidateGridFund 策略未加载时抛错', async () => {
    mockFetchGridStrategyByFund.mockResolvedValue(null);
    const { result } = renderHook(() => useGridDetail('000001'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(result.current.liquidateGridFund()).rejects.toThrow('策略或净值数据未加载');
  });

  it('liquidateGridFund 清仓所有已买入未卖出格子并刷新', async () => {
    const strategy = makeStrategy();
    mockFetchGridStrategyByFund.mockResolvedValue(strategy);
    mockDeriveGridStatuses.mockReturnValue({
      small: [
        {
          level: 1, trigger_price: 1.0, investment: 1000, cumulative: 1000, sell_price: 1.05, profit: 50, profit_retention_pct: 0,
          status: 'executed', distance_pct: 5,
          execution: makeExecution({ executed_shares: 1000, remaining_shares: 1000 }),
        },
      ],
      medium: [
        {
          level: 1, trigger_price: 1.0, investment: 2000, cumulative: 2000, sell_price: 1.1, profit: 200, profit_retention_pct: 0,
          status: 'executed', distance_pct: 0,
          execution: makeExecution({ grid_type: 'medium', grid_level: 1, executed_shares: 500, remaining_shares: 500 }),
        },
      ],
      large: [
        {
          level: 1, trigger_price: 1.0, investment: 3000, cumulative: 3000, sell_price: 1.15, profit: 450, profit_retention_pct: 0,
          status: 'above', distance_pct: -5,
        },
      ],
    });
    const { result } = renderHook(() => useGridDetail('000001'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.liquidateGridFund(); });
    expect(mockExecuteGrid).toHaveBeenCalledTimes(2);
    const calls = mockExecuteGrid.mock.calls;
    // 修复 #5：清仓卖出剩余份额 remaining_shares
    expect(calls[0][0]).toMatchObject({ gridType: 'small', gridLevel: 1, action: 'sell', sellShares: 1000 });
    expect(calls[1][0]).toMatchObject({ gridType: 'medium', gridLevel: 1, action: 'sell', sellShares: 500 });
  });

  it('liquidateGridFund 跳过 remaining_shares <= 0 的格子', async () => {
    const strategy = makeStrategy();
    mockFetchGridStrategyByFund.mockResolvedValue(strategy);
    mockDeriveGridStatuses.mockReturnValue({
      small: [
        {
          level: 1, trigger_price: 1.0, investment: 1000, cumulative: 1000, sell_price: 1.05, profit: 50, profit_retention_pct: 0,
          status: 'executed', distance_pct: 5,
          execution: makeExecution({ executed_shares: 1000, remaining_shares: 0 }),
        },
      ],
      medium: [
        {
          level: 1, trigger_price: 1.0, investment: 2000, cumulative: 2000, sell_price: 1.1, profit: 200, profit_retention_pct: 0,
          status: 'executed', distance_pct: 0,
          execution: makeExecution({ grid_type: 'medium', grid_level: 1, executed_shares: 500, remaining_shares: 500 }),
        },
      ],
      large: [],
    });
    const { result } = renderHook(() => useGridDetail('000001'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.liquidateGridFund(); });
    expect(mockExecuteGrid).toHaveBeenCalledTimes(1);
    expect(mockExecuteGrid.mock.calls[0][0]).toMatchObject({ gridType: 'medium', sellShares: 500 });
  });

  it('executeGridLevel 找不到 gridConfig 时抛错', async () => {
    const strategy = makeStrategy();
    mockFetchGridStrategyByFund.mockResolvedValue(strategy);
    const { result } = renderHook(() => useGridDetail('000001'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(result.current.executeGridLevel('invalid' as GridType, 1)).rejects.toThrow('未找到 invalid 网格配置');
  });

  it('sellGridLevel 策略未加载时抛错', async () => {
    mockFetchGridStrategyByFund.mockResolvedValue(null);
    const { result } = renderHook(() => useGridDetail('000001'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(result.current.sellGridLevel('small', 1)).rejects.toThrow('策略或净值数据未加载');
  });

  it('sellGridLevel 找不到 gridConfig 时抛错', async () => {
    const strategy = makeStrategy();
    mockFetchGridStrategyByFund.mockResolvedValue(strategy);
    const { result } = renderHook(() => useGridDetail('000001'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(result.current.sellGridLevel('invalid' as GridType, 1)).rejects.toThrow('未找到 invalid 网格配置');
  });

  it('sellGridLevel 找不到 gridLevel 时抛错', async () => {
    const strategy = makeStrategy();
    mockFetchGridStrategyByFund.mockResolvedValue(strategy);
    const { result } = renderHook(() => useGridDetail('000001'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(result.current.sellGridLevel('small', 999)).rejects.toThrow('未找到 small 网格第 999 层');
  });

  it('refresh 调用后重新加载数据', async () => {
    const strategy = makeStrategy();
    mockFetchGridStrategyByFund.mockResolvedValue(strategy);
    const { result } = renderHook(() => useGridDetail('000001'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetchGridStrategyByFund).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.refresh(); });
    expect(mockFetchGridStrategyByFund).toHaveBeenCalledTimes(2);
  });
});
