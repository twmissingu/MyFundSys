/**
 * 网格交易策略 Hooks
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchGridStrategies, fetchGridExecutions, fetchAllGridExecutions, fetchGridStrategyByFund, executeGrid, deriveGridStatuses, computeFundOverview, calculateSellShares, shouldLiquidate } from '../services/gridService';
import { fetchFundNav } from '../services/fundApi';
import { GRID_TYPES } from '../types';
import type { GridType, GridStrategy, GridExecution, GridLevelWithStatus, GridFundOverview } from '../types';

/**
 * 获取所有网格策略的总览数据
 */
export function useGridStrategies() {
  const [overviews, setOverviews] = useState<GridFundOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. 获取所有策略
      const strategies = await fetchGridStrategies();
      if (strategies.length === 0) {
        setOverviews([]);
        return;
      }

      // 2. 获取所有执行记录
      const allExecutions = await fetchAllGridExecutions();
      // 按 fund_code 分组
      const executionsByFund = new Map<string, GridExecution[]>();
      for (const exec of allExecutions) {
        const list = executionsByFund.get(exec.fund_code) || [];
        list.push(exec);
        executionsByFund.set(exec.fund_code, list);
      }

      // 3. 并发获取当前净值
      const fundCodes = strategies.map(s => s.fund_code);
      const navResults = await Promise.allSettled(
        fundCodes.map(code => fetchFundNav(code))
      );
      const navMap = new Map<string, number>();
      navResults.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value) {
          navMap.set(fundCodes[i], result.value.nav);
        } else {
          // 修复 #10：净值获取失败不再兜底为 bottom_price（会让所有网格显示买入信号→错误交易）。
          // 用 NaN：deriveGridStatuses 的 NaN 比较全为 false，非执行层级显示 'above'（无虚假触发）。
          navMap.set(fundCodes[i], Number.NaN);
        }
      });

      // 4. 计算每个基金的总览
      const overviewList: GridFundOverview[] = strategies.map(strategy => {
        const executions = executionsByFund.get(strategy.fund_code) || [];
        const currentNav = navMap.get(strategy.fund_code) ?? Number.NaN;
        return computeFundOverview(strategy, executions, currentNav);
      });

      // 按距离触发价排序（最近的在前面）
      overviewList.sort((a, b) => {
        const distA = Math.abs(a.nearest_trigger.distance_pct);
        const distB = Math.abs(b.nearest_trigger.distance_pct);
        return distA - distB;
      });

      setOverviews(overviewList);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载失败';
      setError(msg);
      setOverviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { overviews, loading, error, refresh: loadData };
}

/**
 * 获取单只基金的网格详情
 */
export function useGridDetail(fundCode: string) {
  const [strategy, setStrategy] = useState<GridStrategy | null>(null);
  const [levelsByType, setLevelsByType] = useState<Record<GridType, GridLevelWithStatus[]>>({
    small: [],
    medium: [],
    large: [],
  });
  const [currentNav, setCurrentNav] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 计算底仓份额（所有已买入未卖出格子的留利润份额之和）
  const baseShares = (() => {
    let total = 0;
    for (const gridType of GRID_TYPES) {
      for (const level of levelsByType[gridType] || []) {
        // H2 修复：留利润底仓（卖出后 remaining_shares>0）仍计入底仓份额。
        if (level.status === 'executed' && level.execution && (!level.sellExecution || (level.execution.remaining_shares ?? 0) > 0)) {
          // 已买入未卖出，持有中（这些份额在卖出时会部分留存为底仓）
          total += level.execution.remaining_shares ?? level.execution.executed_shares ?? 0;
        }
      }
    }
    return total;
  })();

  // 清仓触发：当前净值 >= 最大网格 sell_price
  const isLiquidating = strategy && currentNav ? shouldLiquidate(strategy, currentNav) : false;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. 获取策略
      const strat = await fetchGridStrategyByFund(fundCode);
      if (!strat) {
        setStrategy(null);
        setCurrentNav(null);
        return;
      }
      setStrategy(strat);

      // 2. 获取执行记录
      const executions = await fetchGridExecutions(fundCode);

      // 3. 获取当前净值
      let nav: number;
      try {
        const navData = await fetchFundNav(fundCode);
        // 修复 #10：净值获取失败/为空不再兜底 bottom_price（会触发错误买入信号），用 NaN
        nav = navData?.nav ?? Number.NaN;
      } catch {
        nav = Number.NaN;
      }
      setCurrentNav(nav);

      // 4. 推导网格状态
      const levels = deriveGridStatuses(strat, executions, nav);
      setLevelsByType(levels);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载失败';
      setError(msg);
      setStrategy(null);
      setCurrentNav(null);
      setLevelsByType({ small: [], medium: [], large: [] });
    } finally {
      setLoading(false);
    }
  }, [fundCode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * 执行某个网格层级的买入
   */
  const executeGridLevel = useCallback(
    async (gridType: GridType, level: number) => {
      if (!strategy || !currentNav) {
        throw new Error('策略或净值数据未加载');
      }

      const gridConfig = strategy.grid_config[gridType];
      if (!gridConfig) {
        throw new Error(`未找到 ${gridType} 网格配置`);
      }

      const gridLevel = gridConfig.grids.find(g => g.level === level);
      if (!gridLevel) {
        throw new Error(`未找到 ${gridType} 网格第 ${level} 层`);
      }

      await executeGrid({
        strategyId: strategy.id,
        fundCode: strategy.fund_code,
        fundName: strategy.fund_name,
        gridType,
        gridLevel: level,
        action: 'buy',
        triggerPrice: gridLevel.trigger_price,
        investmentAmount: gridLevel.investment,
        currentNav,
      });

      // 刷新数据
      await loadData();
    },
    [strategy, currentNav, loadData]
  );

  /**
   * 执行某个网格层级的卖出（带留利润）
   */
  const sellGridLevel = useCallback(
    async (gridType: GridType, level: number) => {
      if (!strategy || !currentNav) {
        throw new Error('策略或净值数据未加载');
      }

      const gridConfig = strategy.grid_config[gridType];
      if (!gridConfig) {
        throw new Error(`未找到 ${gridType} 网格配置`);
      }

      const gridLevel = gridConfig.grids.find(g => g.level === level);
      if (!gridLevel) {
        throw new Error(`未找到 ${gridType} 网格第 ${level} 层`);
      }

      // 找到该格的买入执行记录
      const buyExec = levelsByType[gridType]?.find(l => l.level === level)?.execution;
      if (!buyExec) {
        throw new Error('未找到买入记录，无法卖出');
      }

      // 修复 #5：用 remaining_shares（剩余份额）而非 executed_shares（原始买入份额），
      // 否则部分卖出后再卖会超卖。
      const buyShares = buyExec.remaining_shares ?? buyExec.executed_shares ?? 0;
      const { sellShares } = calculateSellShares(buyShares, gridLevel.profit_retention_pct);
      if (sellShares <= 0) {
        throw new Error('该格子可卖份额为 0');
      }

      await executeGrid({
        strategyId: strategy.id,
        fundCode: strategy.fund_code,
        fundName: strategy.fund_name,
        gridType,
        gridLevel: level,
        action: 'sell',
        triggerPrice: gridLevel.sell_price,
        sellShares,
        currentNav,
        buyExecutionId: buyExec.id,
      });

      // 刷新数据
      await loadData();
    },
    [strategy, currentNav, levelsByType, loadData]
  );

  /**
   * 清仓：卖出所有底仓（超出网格范围后一次性卖出）
   */
  const liquidateGridFund = useCallback(async () => {
    if (!strategy || !currentNav) {
      throw new Error('策略或净值数据未加载');
    }

    const errors: { gridType: GridType; level: number; error: string }[] = [];

    // 遍历所有已买入未卖出的格子
    for (const gridType of GRID_TYPES) {
      for (const level of levelsByType[gridType] || []) {
        if (level.execution && !level.sellExecution) {
          // 清仓时卖出剩余全部份额（修复 #5：用 remaining_shares 防超卖）
          const sellShares = level.execution.remaining_shares ?? level.execution.executed_shares ?? 0;
          if (sellShares <= 0) continue;

          try {
            await executeGrid({
              strategyId: strategy.id,
              fundCode: strategy.fund_code,
              fundName: strategy.fund_name,
              gridType,
              gridLevel: level.level,
              action: 'sell',
              triggerPrice: level.sell_price,
              sellShares,
              currentNav,
              buyExecutionId: level.execution.id,
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : '卖出失败';
            errors.push({ gridType, level: level.level, error: msg });
          }
        }
      }
    }

    // 刷新数据
    await loadData();

    if (errors.length > 0) {
      throw new Error(`清仓部分失败：${errors.length} 个格子卖出出错（${errors.map(e => `${e.gridType}-${e.level}`).join(', ')}）`);
    }
  }, [strategy, currentNav, levelsByType, loadData]);

  return { strategy, levelsByType, currentNav, loading, error, baseShares, shouldLiquidate: isLiquidating, executeGridLevel, sellGridLevel, liquidateGridFund, refresh: loadData };
}
