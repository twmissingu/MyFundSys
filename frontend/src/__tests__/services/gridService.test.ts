import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mock Supabase ----
const mockSelectResult = vi.hoisted(() => vi.fn());
const mockInsertResult = vi.hoisted(() => vi.fn());
const mockUpdateResult = vi.hoisted(() => vi.fn());
const mockDeleteResult = vi.hoisted(() => vi.fn());

const mockFrom = vi.hoisted(() => vi.fn(() => ({
    select: vi.fn(() => {
      const eqChain: any = vi.fn(() => eqChain);
      eqChain.maybeSingle = mockSelectResult;
      eqChain.order = mockSelectResult;
      eqChain.limit = vi.fn(() => ({ maybeSingle: mockSelectResult }));
      return {
        eq: eqChain,
        or: vi.fn(() => ({
          order: mockSelectResult,
        })),
        order: mockSelectResult,
      };
    }),
  insert: vi.fn(() => ({
    select: vi.fn(() => ({
      single: mockInsertResult,
    })),
  })),
  update: vi.fn(() => ({
    eq: vi.fn(() => Promise.resolve(mockUpdateResult())),
  })),
  delete: vi.fn(() => ({
    eq: vi.fn(() => Promise.resolve(mockDeleteResult())),
  })),
})));

const mockIsSupabaseConfigured = vi.hoisted(() => vi.fn(() => true));

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: mockIsSupabaseConfigured,
  supabase: { from: mockFrom },
}));

// Mock navUpdateService
const mockAddTransactionWithHoldingUpdate = vi.hoisted(() => vi.fn());
vi.mock('../../services/navUpdateService', () => ({
  addTransactionWithHoldingUpdate: mockAddTransactionWithHoldingUpdate,
}));

// Mock favoriteService
const mockAddFavoriteFund = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock('../../services/favoriteService', () => ({
  addFavoriteFund: mockAddFavoriteFund,
}));

import {
  calculateGridLevels,
  deriveGridStatuses,
  computeFundOverview,
  executeGrid,
  fetchGridStrategies,
  batchImportGridStrategies,
  createGridStrategy,
  deleteGridStrategy,
  fetchGridStrategyByFund,
  fetchGridExecutions,
  fetchAllGridExecutions,
  cancelGridExecution,
  calculateSellShares,
  shouldLiquidate,
  getMaxSellPrice,
} from '../../services/gridService';
import type { GridStrategy, GridExecution, GridType, GridTypeConfig } from '../../types';

describe('gridService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSupabaseConfigured.mockReturnValue(true);
    mockAddTransactionWithHoldingUpdate.mockResolvedValue({ transactionId: 'tx_001' });
    mockSelectResult.mockResolvedValue({ data: null, error: null });
    mockInsertResult.mockResolvedValue({ data: { id: 'ge_001' }, error: null });
    mockUpdateResult.mockResolvedValue({ error: null });
    mockDeleteResult.mockResolvedValue({ error: null });
  });

  // ============================================
  // calculateGridLevels
  // ============================================
  describe('calculateGridLevels', () => {
    it('从底部价格按固定间距展开网格', () => {
      const levels = calculateGridLevels(
        0.5,      // bottomPrice
        0.10,     // spacingPct = 10%
        3,        // gridCount
        1000,     // baseInvestment
        0.20,     // incrementPct = 20%
        [0.3, 0.5, 0.8]  // profitRules
      );

      expect(levels).toHaveLength(3);

      // 第1格: trigger = 0.5 * 1.10^0 = 0.5, investment = 1000
      expect(levels[0].level).toBe(1);
      expect(levels[0].trigger_price).toBe(0.5);
      expect(levels[0].investment).toBe(1000);
      expect(levels[0].cumulative).toBe(1000);
      expect(levels[0].sell_price).toBe(0.55);  // 0.5 * 1.1
      expect(levels[0].profit_retention_pct).toBe(0.3);

      // 第2格: trigger = 0.5 * 1.10^1 = 0.55, investment = 1200
      expect(levels[1].level).toBe(2);
      expect(levels[1].trigger_price).toBeCloseTo(0.55, 4);
      expect(levels[1].investment).toBe(1200);
      expect(levels[1].cumulative).toBe(2200);
      expect(levels[1].profit_retention_pct).toBe(0.5);

      // 第3格: trigger = 0.5 * 1.10^2 = 0.605, investment = 1440
      expect(levels[2].level).toBe(3);
      expect(levels[2].trigger_price).toBeCloseTo(0.605, 4);
      expect(levels[2].investment).toBe(1440);
      expect(levels[2].cumulative).toBe(3640);
      expect(levels[2].profit_retention_pct).toBe(0.8);
    });

    it('价格保留4位小数', () => {
      const levels = calculateGridLevels(
        0.3333, 0.05, 1, 100, 0, [0]
      );
      expect(levels[0].trigger_price).toBe(0.3333);
      expect(levels[0].sell_price).toBe(0.35);  // 0.3333*1.05 = 0.349965 -> round
    });

    it('gridCount为0返回空数组', () => {
      const levels = calculateGridLevels(1, 0.1, 0, 100, 0, []);
      expect(levels).toHaveLength(0);
    });
  });

  // ============================================
  // deriveGridStatuses
  // ============================================
  describe('deriveGridStatuses', () => {
    const createStrategy = (): GridStrategy => ({
      id: 'gs_001',
      fund_code: '000001',
      fund_name: '测试基金',
      peak_price: 2.0,
      bottom_price: 0.5,
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      grid_config: {
        small: {
          label: '小网',
          spacing_pct: 0.1,
          grid_count: 2,
          base_investment: 1000,
          increment_pct: 0,
          profit_rules: [0, 0],
          grids: [
            { level: 1, trigger_price: 0.5, investment: 1000, cumulative: 1000, sell_price: 0.55, profit: 50, profit_retention_pct: 0 },
            { level: 2, trigger_price: 0.55, investment: 1000, cumulative: 2000, sell_price: 0.605, profit: 55, profit_retention_pct: 0 },
          ],
        },
        medium: {
          label: '中网',
          spacing_pct: 0.15,
          grid_count: 1,
          base_investment: 2000,
          increment_pct: 0,
          profit_rules: [0],
          grids: [
            { level: 1, trigger_price: 0.5, investment: 2000, cumulative: 2000, sell_price: 0.575, profit: 100, profit_retention_pct: 0 },
          ],
        },
        large: {
          label: '大网',
          spacing_pct: 0.2,
          grid_count: 1,
          base_investment: 3000,
          increment_pct: 0,
          profit_rules: [0],
          grids: [
            { level: 1, trigger_price: 0.5, investment: 3000, cumulative: 3000, sell_price: 0.6, profit: 150, profit_retention_pct: 0 },
          ],
        },
      },
    });

    it('当前净值 > 触发价 => 状态为 above（等待）', () => {
      const strategy = createStrategy();
      const executions: GridExecution[] = [];
      const levels = deriveGridStatuses(strategy, executions, 0.6);  // 0.6 > all triggers

      expect(levels.small[0].status).toBe('above');
      expect(levels.small[1].status).toBe('above');
      expect(levels.medium[0].status).toBe('above');
      expect(levels.large[0].status).toBe('above');
    });

    it('当前净值 <= 触发价 => 状态为 triggered（可买入）', () => {
      const strategy = createStrategy();
      const executions: GridExecution[] = [];
      const levels = deriveGridStatuses(strategy, executions, 0.5);  // <= all triggers

      expect(levels.small[0].status).toBe('triggered');
      expect(levels.small[1].status).toBe('triggered');
      expect(levels.medium[0].status).toBe('triggered');
      expect(levels.large[0].status).toBe('triggered');
    });

    it('有执行记录 => 状态为 executed（已执行）', () => {
      const strategy = createStrategy();
      const executions: GridExecution[] = [
        {
          id: 'ge_001',
          strategy_id: 'gs_001',
          fund_code: '000001',
          grid_type: 'small',
          grid_level: 1,
          action: 'buy',
          status: 'executed',
          transaction_id: 'tx_001',
          executed_nav: 0.48,
          executed_amount: 1000,
          executed_shares: 2083.33,
        },
      ];
      const levels = deriveGridStatuses(strategy, executions, 0.52);

      expect(levels.small[0].status).toBe('executed');
      expect(levels.small[0].execution).toBeDefined();
      expect(levels.small[0].execution?.executed_nav).toBe(0.48);
      expect(levels.small[1].status).toBe('triggered');
    });

    it('只匹配同类型的执行记录', () => {
      const strategy = createStrategy();
      const executions: GridExecution[] = [
        {
          id: 'ge_001',
          strategy_id: 'gs_001',
          fund_code: '000001',
          grid_type: 'small',
          grid_level: 1,
          action: 'buy',
          status: 'executed',
        },
      ];
      const levels = deriveGridStatuses(strategy, executions, 0.5);

      // small 第1格已执行
      expect(levels.small[0].status).toBe('executed');
      // medium 第1格虽然 level=1 但类型不同，仍应为 triggered
      expect(levels.medium[0].status).toBe('triggered');
    });

    it('已取消的记录不视为 executed', () => {
      const strategy = createStrategy();
      const executions: GridExecution[] = [
        {
          id: 'ge_001',
          strategy_id: 'gs_001',
          fund_code: '000001',
          grid_type: 'small',
          grid_level: 1,
          action: 'buy',
          status: 'cancelled',
        },
      ];
      const levels = deriveGridStatuses(strategy, executions, 0.5);

      expect(levels.small[0].status).toBe('triggered');
    });

    it('清仓模式下已买入格子保持 executed 状态（不显示 sell_triggered）', () => {
      const strategy = createStrategy();
      const executions: GridExecution[] = [
        {
          id: 'ge_001',
          strategy_id: 'gs_001',
          fund_code: '000001',
          grid_type: 'small',
          grid_level: 1,
          action: 'buy',
          status: 'executed',
        },
      ];
      // 当前净值 >= 最大 sell_price (0.605) => 清仓模式
      const levels = deriveGridStatuses(strategy, executions, 0.65);

      expect(levels.small[0].status).toBe('executed');
      // distance_pct 基于 sell_price 计算: (0.65 - 0.55) / 0.55 * 100 ≈ 18.18%
      expect(levels.small[0].distance_pct).toBeCloseTo(18.18, 1);
    });

    it('非清仓模式下当前净值 >= sell_price 时显示 sell_triggered', () => {
      const strategy = createStrategy();
      const executions: GridExecution[] = [
        {
          id: 'ge_001',
          strategy_id: 'gs_001',
          fund_code: '000001',
          grid_type: 'small',
          grid_level: 1,
          action: 'buy',
          status: 'executed',
        },
      ];
      // 当前净值 0.58 < 最大 sell_price (0.605)，但 >= small level1 sell_price (0.55)
      const levels = deriveGridStatuses(strategy, executions, 0.58);

      expect(levels.small[0].status).toBe('sell_triggered');
    });

    it('distance_pct 计算正确', () => {
      const strategy = createStrategy();
      const executions: GridExecution[] = [];
      const levels = deriveGridStatuses(strategy, executions, 0.55);

      // small level1 trigger=0.5, current=0.55 => (0.55-0.5)/0.5*100 = 10%
      expect(levels.small[0].distance_pct).toBe(10);
      // small level2 trigger=0.55, current=0.55 => 0%
      expect(levels.small[1].distance_pct).toBe(0);
    });

    it('空网格类型配置返回空数组', () => {
      const strategy = createStrategy();
      strategy.grid_config = {
        small: { label: '小网', spacing_pct: 0.1, grid_count: 0, base_investment: 0, increment_pct: 0, profit_rules: [], grids: [] },
        medium: { label: '中网', spacing_pct: 0.15, grid_count: 0, base_investment: 0, increment_pct: 0, profit_rules: [], grids: [] },
        large: { label: '大网', spacing_pct: 0.2, grid_count: 0, base_investment: 0, increment_pct: 0, profit_rules: [], grids: [] },
      };
      const levels = deriveGridStatuses(strategy, [], 1.0);

      expect(levels.small).toHaveLength(0);
      expect(levels.medium).toHaveLength(0);
      expect(levels.large).toHaveLength(0);
    });
  });

  // ============================================
  // computeFundOverview
  // ============================================
  describe('computeFundOverview', () => {
    const createStrategy = (): GridStrategy => ({
      id: 'gs_001',
      fund_code: '000001',
      fund_name: '测试基金',
      peak_price: 2.0,
      bottom_price: 0.5,
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      grid_config: {
        small: {
          label: '小网',
          spacing_pct: 0.1,
          grid_count: 2,
          base_investment: 1000,
          increment_pct: 0,
          profit_rules: [0, 0],
          grids: [
            { level: 1, trigger_price: 0.5, investment: 1000, cumulative: 1000, sell_price: 0.55, profit: 50, profit_retention_pct: 0 },
            { level: 2, trigger_price: 0.55, investment: 1000, cumulative: 2000, sell_price: 0.605, profit: 55, profit_retention_pct: 0 },
          ],
        },
        medium: {
          label: '中网',
          spacing_pct: 0.15,
          grid_count: 1,
          base_investment: 2000,
          increment_pct: 0,
          profit_rules: [0],
          grids: [
            { level: 1, trigger_price: 0.5, investment: 2000, cumulative: 2000, sell_price: 0.575, profit: 100, profit_retention_pct: 0 },
          ],
        },
        large: {
          label: '大网',
          spacing_pct: 0.2,
          grid_count: 1,
          base_investment: 3000,
          increment_pct: 0,
          profit_rules: [0],
          grids: [
            { level: 1, trigger_price: 0.5, investment: 3000, cumulative: 3000, sell_price: 0.6, profit: 150, profit_retention_pct: 0 },
          ],
        },
      },
    });

    it('计算总预算 = 所有网格投资额之和', () => {
      const strategy = createStrategy();
      const overview = computeFundOverview(strategy, [], 1.0);

      // 1000 + 1000 + 2000 + 3000 = 7000
      expect(overview.total_budget).toBe(7000);
    });

    it('已投入 = 已执行网格的投资额之和', () => {
      const strategy = createStrategy();
      const executions: GridExecution[] = [
        {
          id: 'ge_001',
          strategy_id: 'gs_001',
          fund_code: '000001',
          grid_type: 'small',
          grid_level: 1,
          action: 'buy',
          status: 'executed',
          transaction_id: 'tx_001',
          executed_nav: 0.48,
          executed_amount: 1000,
        },
        {
          id: 'ge_002',
          strategy_id: 'gs_001',
          fund_code: '000001',
          grid_type: 'medium',
          grid_level: 1,
          action: 'buy',
          status: 'executed',
          transaction_id: 'tx_002',
          executed_nav: 0.48,
          executed_amount: 2000,
        },
      ];
      const overview = computeFundOverview(strategy, executions, 1.0);

      expect(overview.capital_deployed).toBe(3000);
      expect(overview.executed_count).toBe(2);
    });

    it('留利润底仓（部分卖出后 remaining_shares>0）计入已投入（H2 修复）', () => {
      const strategy = createStrategy();
      const executions: GridExecution[] = [
        {
          id: 'ge_buy_001', strategy_id: 'gs_001', fund_code: '000001',
          grid_type: 'small', grid_level: 1, action: 'buy', status: 'executed',
          transaction_id: 'tx_buy', executed_nav: 0.48, executed_amount: 1000,
          executed_shares: 100, remaining_shares: 20, // 卖出 80，留 20 底仓
        },
        {
          id: 'ge_sell_001', strategy_id: 'gs_001', fund_code: '000001',
          grid_type: 'small', grid_level: 1, action: 'sell', status: 'executed',
          transaction_id: 'tx_sell', executed_nav: 0.55, executed_shares: 80,
        },
      ];
      const overview = computeFundOverview(strategy, executions, 0.6);

      // 留利润底仓 20/100 = 20% 投资额 = 200
      expect(overview.capital_deployed).toBe(200);
    });

    it('待执行 = 当前净值 <= 触发价但未执行的网格数', () => {
      const strategy = createStrategy();
      // 当前净值 0.5，全部触发，一个已执行
      const executions: GridExecution[] = [
        {
          id: 'ge_001',
          strategy_id: 'gs_001',
          fund_code: '000001',
          grid_type: 'small',
          grid_level: 1,
          action: 'buy',
          status: 'executed',
        },
      ];
      const overview = computeFundOverview(strategy, executions, 0.5);

      // 总共4格，1格已执行，剩余3格全部触发
      expect(overview.triggered_pending_count).toBe(3);
      expect(overview.total_grid_count).toBe(4);
    });

    it('nearest_trigger 指向最近的未执行网格', () => {
      const strategy = createStrategy();
      // 当前净值 0.58，small level2 trigger=0.55 最近，medium level1 trigger=0.5 稍远
      const overview = computeFundOverview(strategy, [], 0.58);

      expect(overview.nearest_trigger.grid_type).toBe('small');
      expect(overview.nearest_trigger.level).toBe(2);
      // distance = (0.58 - 0.55) / 0.55 * 100 ≈ 5.45%
      expect(overview.nearest_trigger.distance_pct).toBeCloseTo(5.45, 1);
    });

    it('nearest_trigger 不考虑已执行网格', () => {
      const strategy = createStrategy();
      const executions: GridExecution[] = [
        {
          id: 'ge_001',
          strategy_id: 'gs_001',
          fund_code: '000001',
          grid_type: 'small',
          grid_level: 2,
          action: 'buy',
          status: 'executed',
        },
      ];
      // current=0.58, small level2 已执行，最近应是 small level1 (trigger=0.5)
      const overview = computeFundOverview(strategy, executions, 0.58);

      expect(overview.nearest_trigger.grid_type).toBe('small');
      expect(overview.nearest_trigger.level).toBe(1);
    });

    it('nearest_trigger 选择距离最近的未执行网格（后面的网格更远时不更新）', () => {
      const strategy = createStrategy();
      // current=0.52, small level1 distance=4%, level2 distance=5.45%
      // level1 先遍历且更近，level2 虽然也是未执行但更远，不应更新 nearest
      const overview = computeFundOverview(strategy, [], 0.52);

      expect(overview.nearest_trigger.grid_type).toBe('small');
      expect(overview.nearest_trigger.level).toBe(1);
    });
  });

  // ============================================
  // executeGrid
  // ============================================
  describe('executeGrid', () => {
    it('创建交易记录和执行记录', async () => {
      const result = await executeGrid({
        strategyId: 'gs_001',
        fundCode: '000001',
        fundName: '测试基金',
        gridType: 'small',
        gridLevel: 1,
        action: 'buy',
        triggerPrice: 0.5,
        investmentAmount: 1000,
        currentNav: 0.48,
      });

      expect(mockAddTransactionWithHoldingUpdate).toHaveBeenCalled();
      const txCall = mockAddTransactionWithHoldingUpdate.mock.calls[0][0];
      expect(txCall.type).toBe('buy');
      expect(txCall.amount).toBe(1000);
      expect(txCall.source).toBe('grid');
      expect(txCall.status).toBe('pending');
      expect(txCall.shares).toBeCloseTo(2083.33, 2);
      expect(result.transactionId).toBe('tx_001');
    });

    it('Supabase 未配置时抛出错误', async () => {
      mockIsSupabaseConfigured.mockReturnValue(false);

      await expect(executeGrid({
        strategyId: 'gs_001',
        fundCode: '000001',
        fundName: '测试基金',
        gridType: 'small',
        gridLevel: 1,
        action: 'buy',
        triggerPrice: 0.5,
        investmentAmount: 1000,
        currentNav: 0.48,
      })).rejects.toThrow('Supabase 未配置');
    });

    it('买入执行记录写入失败抛出错误', async () => {
      mockInsertResult.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });

      await expect(executeGrid({
        strategyId: 'gs_001',
        fundCode: '000001',
        fundName: '测试基金',
        gridType: 'small',
        gridLevel: 1,
        action: 'buy',
        triggerPrice: 0.5,
        investmentAmount: 1000,
        currentNav: 0.48,
      })).rejects.toThrow('写入买入执行记录失败');
    });

    it('买入操作缺少 investmentAmount 时抛出错误', async () => {
      await expect(executeGrid({
        strategyId: 'gs_001',
        fundCode: '000001',
        fundName: '测试基金',
        gridType: 'small',
        gridLevel: 1,
        action: 'buy',
        triggerPrice: 0.5,
        currentNav: 0.48,
      } as any)).rejects.toThrow('必须指定有效的 investmentAmount');
    });

    it('买入操作 investmentAmount 为 0 时抛出错误', async () => {
      await expect(executeGrid({
        strategyId: 'gs_001',
        fundCode: '000001',
        fundName: '测试基金',
        gridType: 'small',
        gridLevel: 1,
        action: 'buy',
        triggerPrice: 0.5,
        investmentAmount: 0,
        currentNav: 0.48,
      })).rejects.toThrow('必须指定有效的 investmentAmount');
    });

    it('currentNav 为 0 时抛出错误，防止 Infinity 份额（L1 修复）', async () => {
      await expect(executeGrid({
        strategyId: 'gs_001',
        fundCode: '000001',
        fundName: '测试基金',
        gridType: 'small',
        gridLevel: 1,
        action: 'buy',
        triggerPrice: 0.5,
        investmentAmount: 1000,
        currentNav: 0,
      })).rejects.toThrow('净值为 0');
    });
  });

  // ============================================
  // batchImportGridStrategies
  // ============================================
  describe('batchImportGridStrategies', () => {
    afterEach(() => {
      // Restore default mockAddFavoriteFund return value
      mockAddFavoriteFund.mockResolvedValue(true);
      // Restore default mockFrom implementation so downstream tests aren't affected
      mockFrom.mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: mockSelectResult,
            order: mockSelectResult,
          })),
          or: vi.fn(() => ({
            order: mockSelectResult,
          })),
          order: mockSelectResult,
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: mockInsertResult,
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve(mockUpdateResult())),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve(mockDeleteResult())),
        })),
      }));
    });

    const importItem = {
      fund_code: '000001',
      fund_name: '测试基金',
      peak_price: 2.0,
      bottom_price: 0.5,
      grid_config: {
        small: { label: '小网', spacing_pct: 0.1, grid_count: 1, base_investment: 1000, increment_pct: 0, profit_rules: [0], grids: [] },
        medium: { label: '中网', spacing_pct: 0.15, grid_count: 0, base_investment: 0, increment_pct: 0, profit_rules: [], grids: [] },
        large: { label: '大网', spacing_pct: 0.2, grid_count: 0, base_investment: 0, increment_pct: 0, profit_rules: [], grids: [] },
      } as Record<GridType, GridTypeConfig>,
    };

    it('空数组返回 0 成功', async () => {
      const result = await batchImportGridStrategies([]);
      expect(result.success).toBe(0);
      expect(result.autoFavorited).toBe(0);
    });

    it('Supabase 未配置返回错误', async () => {
      mockIsSupabaseConfigured.mockReturnValue(false);
      const result = await batchImportGridStrategies([importItem]);
      expect(result.success).toBe(0);
      expect(result.autoFavorited).toBe(0);
      expect(result.errors[0]).toContain('Supabase 未配置');
    });

    it('成功创建新策略并自动添加到收藏', async () => {
      mockSelectResult.mockResolvedValue({ data: null, error: null });

      const result = await batchImportGridStrategies([importItem]);

      expect(result.success).toBe(1);
      expect(result.autoFavorited).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockAddFavoriteFund).toHaveBeenCalledWith('000001', '测试基金', '基金');
    });

    it('成功更新现有策略不添加到收藏', async () => {
      mockSelectResult.mockResolvedValue({ data: { id: 'gs_001' }, error: null });

      const result = await batchImportGridStrategies([importItem]);

      expect(result.success).toBe(1);
      expect(result.autoFavorited).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockAddFavoriteFund).not.toHaveBeenCalled();
    });

    it('更新现有策略失败记录错误', async () => {
      mockSelectResult.mockResolvedValue({ data: { id: 'gs_001' }, error: null });
      mockUpdateResult.mockResolvedValue({ error: new Error('Update failed') });

      const result = await batchImportGridStrategies([importItem]);

      expect(result.success).toBe(0);
      expect(result.errors[0]).toContain('更新失败');
    });

    it('创建新策略时 insert 返回 error', async () => {
      mockSelectResult.mockResolvedValue({ data: null, error: null });
      (mockFrom as any).mockImplementation(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: mockSelectResult,
            order: mockSelectResult,
          })),
          or: vi.fn(() => ({ order: mockSelectResult })),
          order: mockSelectResult,
        })),
        insert: vi.fn(() => Promise.resolve({ error: new Error('Insert failed') })),
        update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve(mockUpdateResult())) })),
        delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve(mockDeleteResult())) })),
      }));

      const result = await batchImportGridStrategies([importItem]);

      expect(result.success).toBe(0);
      expect(result.errors[0]).toContain('创建失败');
    });

    it('创建新策略但添加到收藏失败时记录错误', async () => {
      mockSelectResult.mockResolvedValue({ data: null, error: null });
      mockAddFavoriteFund.mockResolvedValue(false);

      const result = await batchImportGridStrategies([importItem]);

      expect(result.success).toBe(1);
      expect(result.autoFavorited).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('添加到收藏失败');
    });

    it('抛出非 Error 对象时记录未知错误', async () => {
      mockSelectResult.mockRejectedValue('string error');

      const result = await batchImportGridStrategies([importItem]);

      expect(result.success).toBe(0);
      expect(result.errors[0]).toContain('未知错误');
    });

  });

  // ============================================
  // fetchGridStrategies
  // ============================================
  describe('fetchGridStrategies', () => {
    it('Supabase 未配置返回空数组', async () => {
      mockIsSupabaseConfigured.mockReturnValue(false);
      const result = await fetchGridStrategies();
      expect(result).toEqual([]);
    });

    it('成功获取活跃策略列表', async () => {
      const dbStrategies = [
        {
          id: 'gs_001',
          fund_code: '000001',
          fund_name: '测试基金A',
          peak_price: 2.0,
          bottom_price: 0.5,
          grid_config: {},
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'gs_002',
          fund_code: '000002',
          fund_name: '测试基金B',
          peak_price: 3.0,
          bottom_price: 1.0,
          grid_config: {},
          is_active: true,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ];
      mockSelectResult.mockResolvedValue({ data: dbStrategies, error: null });

      const result = await fetchGridStrategies();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('gs_001');
      expect(result[1].fund_code).toBe('000002');
    });

    it('查询失败时抛出错误', async () => {
      mockSelectResult.mockResolvedValue({ data: null, error: new Error('DB Error') });

      await expect(fetchGridStrategies()).rejects.toThrow('获取网格策略失败');
    });
  });

  // ============================================
  // createGridStrategy
  // ============================================
  describe('createGridStrategy', () => {
    const baseStrategy = {
      fund_code: '000001',
      fund_name: '测试基金',
      peak_price: 2.0,
      bottom_price: 0.5,
      grid_config: {
        small: { label: '小网', spacing_pct: 0.1, grid_count: 1, base_investment: 1000, increment_pct: 0, profit_rules: [0], grids: [] },
        medium: { label: '中网', spacing_pct: 0.15, grid_count: 0, base_investment: 0, increment_pct: 0, profit_rules: [], grids: [] },
        large: { label: '大网', spacing_pct: 0.2, grid_count: 0, base_investment: 0, increment_pct: 0, profit_rules: [], grids: [] },
      } as Record<GridType, GridTypeConfig>,
      is_active: true,
    };

    it('Supabase 未配置时返回 null', async () => {
      mockIsSupabaseConfigured.mockReturnValue(false);
      const result = await createGridStrategy(baseStrategy);
      expect(result).toBeNull();
    });

    it('成功创建返回 GridStrategy', async () => {
      const dbStrategy = {
        id: 'gs_new',
        fund_code: '000001',
        fund_name: '测试基金',
        peak_price: 2.0,
        bottom_price: 0.5,
        grid_config: baseStrategy.grid_config,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockInsertResult.mockResolvedValue({ data: dbStrategy, error: null });

      const result = await createGridStrategy(baseStrategy);

      expect(result).not.toBeNull();
      expect(result!.id).toBe('gs_new');
      expect(result!.fund_code).toBe('000001');
      expect(result!.peak_price).toBe(2.0);
    });

    it('创建失败时抛出错误', async () => {
      mockInsertResult.mockResolvedValue({ data: null, error: new Error('DB Error') });

      await expect(createGridStrategy(baseStrategy)).rejects.toThrow('创建网格策略失败');
    });
  });

  // ============================================
  // deleteGridStrategy
  // ============================================
  describe('deleteGridStrategy', () => {
    it('Supabase 未配置时不执行删除', async () => {
      mockIsSupabaseConfigured.mockReturnValue(false);
      await deleteGridStrategy('gs_001');
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('成功删除策略', async () => {
      await deleteGridStrategy('gs_001');
      expect(mockFrom).toHaveBeenCalledWith('grid_strategies');
      expect(mockDeleteResult).toHaveBeenCalled();
    });
  });

  // ============================================
  // fetchGridStrategyByFund
  // ============================================
  describe('fetchGridStrategyByFund', () => {
    it('Supabase 未配置时返回 null', async () => {
      mockIsSupabaseConfigured.mockReturnValue(false);
      const result = await fetchGridStrategyByFund('000001');
      expect(result).toBeNull();
    });

    it('成功获取返回 GridStrategy', async () => {
      const dbStrategy = {
        id: 'gs_001',
        fund_code: '000001',
        fund_name: '测试基金',
        peak_price: 2.0,
        bottom_price: 0.5,
        grid_config: {},
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockSelectResult.mockResolvedValue({ data: dbStrategy, error: null });

      const result = await fetchGridStrategyByFund('000001');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('gs_001');
      expect(result!.fund_code).toBe('000001');
    });

    it('查询失败时抛出错误', async () => {
      mockSelectResult.mockResolvedValue({ data: null, error: new Error('DB Error') });

      await expect(fetchGridStrategyByFund('000001')).rejects.toThrow('获取网格策略失败');
    });

    it('未找到策略返回 null', async () => {
      mockSelectResult.mockResolvedValue({ data: null, error: null });

      const result = await fetchGridStrategyByFund('000001');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // fetchGridExecutions
  // ============================================
  describe('fetchGridExecutions', () => {
    it('Supabase 未配置时返回空数组', async () => {
      mockIsSupabaseConfigured.mockReturnValue(false);
      const result = await fetchGridExecutions('000001');
      expect(result).toEqual([]);
    });

    it('成功获取返回 GridExecution 数组', async () => {
      const dbExecutions = [
        {
          id: 'ge_001',
          strategy_id: 'gs_001',
          fund_code: '000001',
          grid_type: 'small',
          grid_level: 1,
          action: 'buy',
          status: 'executed',
          transaction_id: 'tx_001',
          executed_nav: 0.48,
          executed_amount: 1000,
          executed_shares: 2083.33,
          remaining_shares: 2083.33,
          executed_at: '2024-01-01T00:00:00Z',
        },
      ];
      mockSelectResult.mockResolvedValue({ data: dbExecutions, error: null });

      const result = await fetchGridExecutions('000001');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ge_001');
      expect(result[0].fund_code).toBe('000001');
      expect(result[0].executed_nav).toBe(0.48);
      expect(result[0].remaining_shares).toBe(2083.33);
    });

    it('查询失败时抛出错误', async () => {
      mockSelectResult.mockResolvedValue({ data: null, error: new Error('DB Error') });

      await expect(fetchGridExecutions('000001')).rejects.toThrow('获取网格执行记录失败');
    });
  });

  // ============================================
  // fetchAllGridExecutions
  // ============================================
  describe('fetchAllGridExecutions', () => {
    it('Supabase 未配置时返回空数组', async () => {
      mockIsSupabaseConfigured.mockReturnValue(false);
      const result = await fetchAllGridExecutions();
      expect(result).toEqual([]);
    });

    it('成功获取返回全部 GridExecution 数组', async () => {
      const dbExecutions = [
        { id: 'ge_001', strategy_id: 'gs_001', fund_code: '000001', grid_type: 'small', grid_level: 1, action: 'buy', status: 'executed', executed_at: '2024-01-01T00:00:00Z' },
        { id: 'ge_002', strategy_id: 'gs_002', fund_code: '000002', grid_type: 'medium', grid_level: 1, action: 'buy', status: 'executed', executed_at: '2024-01-02T00:00:00Z' },
      ];
      mockSelectResult.mockResolvedValue({ data: dbExecutions, error: null });

      const result = await fetchAllGridExecutions();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('ge_001');
      expect(result[1].fund_code).toBe('000002');
    });

    it('查询失败时抛出错误', async () => {
      mockSelectResult.mockResolvedValue({ data: null, error: new Error('DB Error') });

      await expect(fetchAllGridExecutions()).rejects.toThrow('获取网格执行记录失败');
    });
  });

  // ============================================
  // cancelGridExecution
  // ============================================
  describe('cancelGridExecution', () => {
    it('Supabase 未配置时不执行更新', async () => {
      mockIsSupabaseConfigured.mockReturnValue(false);
      await cancelGridExecution('ge_001');
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('成功取消执行记录并删除关联交易', async () => {
      mockSelectResult.mockResolvedValue({ data: { id: 'ge_001', transaction_id: 'tx_001' }, error: null });

      await cancelGridExecution('ge_001');
      expect(mockFrom).toHaveBeenCalledWith('grid_executions');
      expect(mockFrom).toHaveBeenCalledWith('transactions');
      expect(mockUpdateResult).toHaveBeenCalled();
    });

    it('取消卖出 execution 时标记 cancelled 并恢复买入 remaining_shares（H-1 状态变更验证）', async () => {
      mockSelectResult
        .mockResolvedValueOnce({ data: { id: 'ge_sell', action: 'sell', transaction_id: 'tx_sell', executed_shares: 80, status: 'executed' }, error: null })
        .mockResolvedValueOnce({ data: { grid_execution_id: 'ge_buy' }, error: null })
        .mockResolvedValueOnce({ data: { remaining_shares: 920, executed_shares: 1000 }, error: null });

      await cancelGridExecution('ge_sell');

      const allUpdatePayloads = mockFrom.mock.results
        .filter((r: any) => r.value?.update)
        .flatMap((r: any) => r.value.update.mock.calls.map((c: any) => c[0]));
      // ② 标记 cancelled + 清空 transaction_id
      const cancelUpdate = allUpdatePayloads.find((p: any) => p && p.status === 'cancelled');
      expect(cancelUpdate).toBeDefined();
      expect(cancelUpdate.transaction_id).toBeNull();
      // ③ 恢复 remaining_shares（920 + 80 = 1000，封顶 executed_shares 1000）
      const restoreUpdate = allUpdatePayloads.find((p: any) => p && p.remaining_shares !== undefined);
      expect(restoreUpdate).toBeDefined();
      expect(restoreUpdate.remaining_shares).toBe(1000);
    });
  });

  // ============================================
  // executeGrid (sell branch)
  // ============================================
  describe('executeGrid (sell)', () => {
    it('成功创建卖出交易和执行记录', async () => {
      // 第一次 select：买入 execution（含 transaction_id）；第二次：买入交易状态 completed
      mockSelectResult
        .mockResolvedValueOnce({ data: { remaining_shares: 1000, executed_shares: 1000, transaction_id: 'tx_buy_001' }, error: null })
        .mockResolvedValueOnce({ data: { status: 'completed' }, error: null });
      mockInsertResult.mockResolvedValue({ data: { id: 'ge_sell_001' }, error: null });

      const result = await executeGrid({
        strategyId: 'gs_001',
        fundCode: '000001',
        fundName: '测试基金',
        gridType: 'small',
        gridLevel: 1,
        action: 'sell',
        triggerPrice: 0.5,
        sellShares: 1000,
        currentNav: 0.6,
        buyExecutionId: 'ge_buy_001',
      });

      expect(mockAddTransactionWithHoldingUpdate).toHaveBeenCalled();
      const txCall = mockAddTransactionWithHoldingUpdate.mock.calls[0][0];
      expect(txCall.type).toBe('sell');
      expect(txCall.gridExecutionId).toBe('ge_buy_001');
      expect(txCall.status).toBe('completed');
      expect(txCall.amount).toBe(600);
      expect(txCall.shares).toBe(1000);
      expect(result.transactionId).toBe('tx_001');
      expect(result.executionId).toBe('ge_sell_001');
    });

    it('卖出时缺少 buyExecutionId 抛出错误', async () => {
      await expect(executeGrid({
        strategyId: 'gs_001',
        fundCode: '000001',
        fundName: '测试基金',
        gridType: 'small',
        gridLevel: 1,
        action: 'sell',
        triggerPrice: 0.5,
        sellShares: 1000,
        currentNav: 0.6,
      })).rejects.toThrow('卖出操作必须指定 buyExecutionId');
    });

    it('卖出操作缺少 sellShares 时抛出错误', async () => {
      await expect(executeGrid({
        strategyId: 'gs_001',
        fundCode: '000001',
        fundName: '测试基金',
        gridType: 'small',
        gridLevel: 1,
        action: 'sell',
        triggerPrice: 0.5,
        currentNav: 0.6,
        buyExecutionId: 'ge_buy_001',
      } as any)).rejects.toThrow('必须指定有效的 sellShares');
    });

    it('卖出操作 sellShares 为 0 时抛出错误', async () => {
      await expect(executeGrid({
        strategyId: 'gs_001',
        fundCode: '000001',
        fundName: '测试基金',
        gridType: 'small',
        gridLevel: 1,
        action: 'sell',
        triggerPrice: 0.5,
        sellShares: 0,
        currentNav: 0.6,
        buyExecutionId: 'ge_buy_001',
      })).rejects.toThrow('必须指定有效的 sellShares');
    });

    it('卖出执行记录写入失败抛出错误', async () => {
      mockSelectResult
        .mockResolvedValueOnce({ data: { remaining_shares: 1000, executed_shares: 1000, transaction_id: 'tx_buy_001' }, error: null })
        .mockResolvedValueOnce({ data: { status: 'completed' }, error: null });
      mockInsertResult.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });

      await expect(executeGrid({
        strategyId: 'gs_001',
        fundCode: '000001',
        fundName: '测试基金',
        gridType: 'small',
        gridLevel: 1,
        action: 'sell',
        triggerPrice: 0.5,
        sellShares: 1000,
        currentNav: 0.6,
        buyExecutionId: 'ge_buy_001',
      })).rejects.toThrow('写入卖出执行记录失败');
    });

    it('卖出份额超过剩余可卖份额时抛出错误（修复 A）', async () => {
      mockSelectResult.mockResolvedValue({ data: { remaining_shares: 500, executed_shares: 1000 }, error: null });

      await expect(executeGrid({
        strategyId: 'gs_001',
        fundCode: '000001',
        fundName: '测试基金',
        gridType: 'small',
        gridLevel: 1,
        action: 'sell',
        triggerPrice: 0.5,
        sellShares: 800,
        currentNav: 0.6,
        buyExecutionId: 'ge_buy_001',
      })).rejects.toThrow('超过该网格剩余可卖份额');
    });

    it('买入执行记录不存在时抛出错误（修复 A）', async () => {
      mockSelectResult.mockResolvedValue({ data: null, error: null });

      await expect(executeGrid({
        strategyId: 'gs_001',
        fundCode: '000001',
        fundName: '测试基金',
        gridType: 'small',
        gridLevel: 1,
        action: 'sell',
        triggerPrice: 0.5,
        sellShares: 100,
        currentNav: 0.6,
        buyExecutionId: 'ge_missing',
      })).rejects.toThrow('未找到对应的买入执行记录');
    });

    it('卖出在途（pending）买入时抛出错误，防止扣减错误批次（C1 修复）', async () => {
      // 第一次 select：买入 execution（含 transaction_id）
      mockSelectResult
        .mockResolvedValueOnce({ data: { remaining_shares: 1000, executed_shares: 1000, transaction_id: 'tx_buy_001' }, error: null })
        // 第二次 select：买入交易状态 = pending
        .mockResolvedValueOnce({ data: { status: 'pending' }, error: null });

      await expect(executeGrid({
        strategyId: 'gs_001',
        fundCode: '000001',
        fundName: '测试基金',
        gridType: 'small',
        gridLevel: 1,
        action: 'sell',
        triggerPrice: 0.5,
        sellShares: 1000,
        currentNav: 0.6,
        buyExecutionId: 'ge_buy_001',
      })).rejects.toThrow('买入交易尚未确认');
    });

    it('买入已确认（completed）时允许卖出（C1 正向）', async () => {
      mockSelectResult
        .mockResolvedValueOnce({ data: { remaining_shares: 1000, executed_shares: 1000, transaction_id: 'tx_buy_001' }, error: null })
        .mockResolvedValueOnce({ data: { status: 'completed' }, error: null });
      mockInsertResult.mockResolvedValue({ data: { id: 'ge_sell_001' }, error: null });

      const result = await executeGrid({
        strategyId: 'gs_001',
        fundCode: '000001',
        fundName: '测试基金',
        gridType: 'small',
        gridLevel: 1,
        action: 'sell',
        triggerPrice: 0.5,
        sellShares: 1000,
        currentNav: 0.6,
        buyExecutionId: 'ge_buy_001',
      });

      expect(mockAddTransactionWithHoldingUpdate).toHaveBeenCalled();
      expect(result.executionId).toBe('ge_sell_001');
    });

    it('买入 execution 缺少 transaction_id 拒绝卖出（C1 加固 H-3）', async () => {
      // buyExecForCheck 无 transaction_id（脏数据）
      mockSelectResult.mockResolvedValueOnce({ data: { remaining_shares: 1000, executed_shares: 1000 }, error: null });
      await expect(executeGrid({
        strategyId: 'gs_001', fundCode: '000001', fundName: '测试基金',
        gridType: 'small', gridLevel: 1, action: 'sell', triggerPrice: 0.5,
        sellShares: 1000, currentNav: 0.6, buyExecutionId: 'ge_buy_001',
      })).rejects.toThrow('缺少关联交易');
    });

    it('关联买入交易不存在拒绝卖出（C1 加固 H-3）', async () => {
      mockSelectResult
        .mockResolvedValueOnce({ data: { remaining_shares: 1000, executed_shares: 1000, transaction_id: 'tx_buy_001' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null }); // 买入交易查询返回 null
      await expect(executeGrid({
        strategyId: 'gs_001', fundCode: '000001', fundName: '测试基金',
        gridType: 'small', gridLevel: 1, action: 'sell', triggerPrice: 0.5,
        sellShares: 1000, currentNav: 0.6, buyExecutionId: 'ge_buy_001',
      })).rejects.toThrow('关联的买入交易不存在');
    });

    it('部分卖出后正确更新 remaining_shares（H-2 状态变更验证）', async () => {
      mockSelectResult
        .mockResolvedValueOnce({ data: { remaining_shares: 1000, executed_shares: 1000, transaction_id: 'tx_buy_001' }, error: null })
        .mockResolvedValueOnce({ data: { status: 'completed' }, error: null });
      mockInsertResult.mockResolvedValue({ data: { id: 'ge_sell_001' }, error: null });

      await executeGrid({
        strategyId: 'gs_001', fundCode: '000001', fundName: '测试基金',
        gridType: 'small', gridLevel: 1, action: 'sell', triggerPrice: 0.5,
        sellShares: 300, currentNav: 0.6, buyExecutionId: 'ge_buy_001',
      });

      // 从所有 from() 调用结果中收集 update payload，找到 remaining_shares 更新
      const allUpdatePayloads = mockFrom.mock.results
        .filter((r: any) => r.value?.update)
        .flatMap((r: any) => r.value.update.mock.calls.map((c: any) => c[0]));
      const remainingUpdate = allUpdatePayloads.find((p: any) => p && p.remaining_shares !== undefined);
      expect(remainingUpdate).toBeDefined();
      expect(remainingUpdate.remaining_shares).toBe(700); // 1000 - 300
    });
  });

  // ============================================
  // calculateSellShares
  // ============================================
  describe('calculateSellShares', () => {
    it('利润留存 30% 时卖出 70%', () => {
      const result = calculateSellShares(1000, 0.3);
      expect(result.sellShares).toBe(700);
      expect(result.retainShares).toBe(300);
    });

    it('利润留存 0% 时全部卖出', () => {
      const result = calculateSellShares(1000, 0);
      expect(result.sellShares).toBe(1000);
      expect(result.retainShares).toBe(0);
    });

    it('利润留存 100% 时全部保留', () => {
      const result = calculateSellShares(1000, 1);
      expect(result.sellShares).toBe(0);
      expect(result.retainShares).toBe(1000);
    });

    it('小数份额四舍五入到4位', () => {
      const result = calculateSellShares(1234.5678, 0.3333);
      expect(result.retainShares).toBeCloseTo(411.48, 2);
      expect(result.sellShares).toBeCloseTo(823.09, 2);
    });

    it('利润留存比例负值时自动夹紧为0（全部卖出）', () => {
      const result = calculateSellShares(1000, -0.5);
      expect(result.sellShares).toBe(1000);
      expect(result.retainShares).toBe(0);
    });

    it('利润留存比例超过100%时自动夹紧为1（全部保留）', () => {
      const result = calculateSellShares(1000, 2);
      expect(result.sellShares).toBe(0);
      expect(result.retainShares).toBe(1000);
    });

    it('利润留存比例为空值时视为0', () => {
      const result = calculateSellShares(1000, null as any);
      expect(result.sellShares).toBe(1000);
      expect(result.retainShares).toBe(0);
    });
  });

  // ============================================
  // shouldLiquidate / getMaxSellPrice
  // ============================================
  describe('shouldLiquidate', () => {
    const strategy: GridStrategy = {
      id: 'gs_001',
      fund_code: '000001',
      fund_name: '测试基金',
      peak_price: 2.0,
      bottom_price: 0.5,
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      grid_config: {
        small: {
          label: '小网', spacing_pct: 0.1, grid_count: 1, base_investment: 1000, increment_pct: 0, profit_rules: [0],
          grids: [
            { level: 1, trigger_price: 0.5, investment: 1000, cumulative: 1000, sell_price: 0.55, profit: 50, profit_retention_pct: 0 },
          ],
        },
        medium: { label: '中网', spacing_pct: 0.15, grid_count: 0, base_investment: 0, increment_pct: 0, profit_rules: [], grids: [] },
        large: { label: '大网', spacing_pct: 0.2, grid_count: 0, base_investment: 0, increment_pct: 0, profit_rules: [], grids: [] },
      },
    };

    it('当前净值 >= 最大 sell_price 时返回 true', () => {
      expect(shouldLiquidate(strategy, 0.55)).toBe(true);
      expect(shouldLiquidate(strategy, 0.6)).toBe(true);
    });

    it('当前净值 < 最大 sell_price 时返回 false', () => {
      expect(shouldLiquidate(strategy, 0.54)).toBe(false);
      expect(shouldLiquidate(strategy, 0.5)).toBe(false);
    });
  });

  describe('getMaxSellPrice', () => {
    const strategy: GridStrategy = {
      id: 'gs_001',
      fund_code: '000001',
      fund_name: '测试基金',
      peak_price: 2.0,
      bottom_price: 0.5,
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      grid_config: {
        small: {
          label: '小网', spacing_pct: 0.1, grid_count: 2, base_investment: 1000, increment_pct: 0, profit_rules: [0, 0],
          grids: [
            { level: 1, trigger_price: 0.5, investment: 1000, cumulative: 1000, sell_price: 0.55, profit: 50, profit_retention_pct: 0 },
            { level: 2, trigger_price: 0.55, investment: 1000, cumulative: 2000, sell_price: 0.605, profit: 55, profit_retention_pct: 0 },
          ],
        },
        medium: {
          label: '中网', spacing_pct: 0.15, grid_count: 1, base_investment: 2000, increment_pct: 0, profit_rules: [0],
          grids: [
            { level: 1, trigger_price: 0.5, investment: 2000, cumulative: 2000, sell_price: 0.575, profit: 100, profit_retention_pct: 0 },
          ],
        },
        large: { label: '大网', spacing_pct: 0.2, grid_count: 0, base_investment: 0, increment_pct: 0, profit_rules: [], grids: [] },
      },
    };

    it('返回所有网格中的最大 sell_price', () => {
      expect(getMaxSellPrice(strategy)).toBe(0.605);
    });

    it('空网格返回 Infinity', () => {
      const emptyStrategy: GridStrategy = {
        ...strategy,
        grid_config: {
          small: { label: '小网', spacing_pct: 0.1, grid_count: 0, base_investment: 0, increment_pct: 0, profit_rules: [], grids: [] },
          medium: { label: '中网', spacing_pct: 0.15, grid_count: 0, base_investment: 0, increment_pct: 0, profit_rules: [], grids: [] },
          large: { label: '大网', spacing_pct: 0.2, grid_count: 0, base_investment: 0, increment_pct: 0, profit_rules: [], grids: [] },
        },
      };
      expect(getMaxSellPrice(emptyStrategy)).toBe(Infinity);
    });
  });
});
