/**
 * 网格交易策略服务
 *
 * Supabase 为数据源，提供网格策略的 CRUD、执行、状态推导等功能
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { addTransactionWithHoldingUpdate } from './navUpdateService';
import { addFavoriteFund } from './favoriteService';
import { GRID_TYPES } from '../types';
const SHARE_PRECISION = 10000;

import type {
  GridType,
  GridLevel,
  GridTypeConfig,
  GridStrategy,
  GridExecution,
  GridLevelStatus,
  GridLevelWithStatus,
  GridFundOverview,
} from '../types';

// ============================================
// 网格阶梯计算（纯函数）
// ============================================

export function calculateGridLevels(
  bottomPrice: number,
  spacingPct: number,
  gridCount: number,
  baseInvestment: number,
  incrementPct: number,
  profitRules: number[]
): GridLevel[] {
  const grids: GridLevel[] = [];
  let cumulative = 0;

  for (let i = 0; i < gridCount; i++) {
    // 买① = 极限底，向上按固定间距展开
    const triggerPrice = bottomPrice * Math.pow(1 + spacingPct, i);
    const investment = Math.round(baseInvestment * Math.pow(1 + incrementPct, i));
    cumulative += investment;
    const sellPrice = triggerPrice * (1 + spacingPct);
    const profit = Math.round(investment * spacingPct);
    const profitRetentionPct = profitRules[i] || 0;

    grids.push({
      level: i + 1,
      trigger_price: roundPrice(triggerPrice),
      investment,
      cumulative,
      sell_price: roundPrice(sellPrice),
      profit,
      profit_retention_pct: profitRetentionPct,
    });
  }

  return grids;
}

function roundPrice(price: number): number {
  return Math.round(price * SHARE_PRECISION) / SHARE_PRECISION;
}

// ============================================
// CRUD 操作
// ============================================

export async function fetchGridStrategies(): Promise<GridStrategy[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('grid_strategies')
    .select('*')
    .or('is_active.eq.true,is_active.is.null')
    .order('fund_code');

  if (error) {
    throw new Error(`获取网格策略失败: ${error.message}`);
  }

  return (data || []).map(mapDbGridStrategy);
}

export async function fetchGridStrategyByFund(fundCode: string): Promise<GridStrategy | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('grid_strategies')
    .select('*')
    .eq('fund_code', fundCode)
    .maybeSingle();

  if (error) {
    throw new Error(`获取网格策略失败: ${error.message}`);
  }

  if (!data) return null;
  return mapDbGridStrategy(data);
}

export async function createGridStrategy(
  strategy: Omit<GridStrategy, 'id' | 'created_at' | 'updated_at'>
): Promise<GridStrategy | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await (supabase
    .from('grid_strategies') as any)
    .insert({
      fund_code: strategy.fund_code,
      fund_name: strategy.fund_name,
      peak_price: strategy.peak_price,
      bottom_price: strategy.bottom_price,
      grid_config: strategy.grid_config as any,
      is_active: strategy.is_active,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`创建网格策略失败: ${error.message}`);
  }

  return mapDbGridStrategy(data);
}

export async function deleteGridStrategy(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const { error } = await supabase.from('grid_strategies').delete().eq('id', id);
  if (error) throw new Error(`删除网格策略失败: ${error.message}`);
}

// ============================================
// 执行记录 CRUD
// ============================================

export async function fetchGridExecutions(fundCode: string): Promise<GridExecution[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('grid_executions')
    .select('*')
    .eq('fund_code', fundCode)
    .order('created_at');

  if (error) {
    throw new Error(`获取网格执行记录失败: ${error.message}`);
  }

  return (data || []).map(mapDbGridExecution);
}

export async function fetchAllGridExecutions(): Promise<GridExecution[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('grid_executions')
    .select('*')
    .order('created_at');

  if (error) {
    throw new Error(`获取网格执行记录失败: ${error.message}`);
  }

  return (data || []).map(mapDbGridExecution);
}

// ============================================
// 网格执行
// ============================================

export interface ExecuteGridParams {
  strategyId: string;
  fundCode: string;
  fundName: string;
  gridType: GridType;
  gridLevel: number;
  action: 'buy' | 'sell';
  triggerPrice: number;
  investmentAmount?: number;  // buy 用
  sellShares?: number;        // sell 用
  currentNav: number;
  buyExecutionId?: string;    // sell 用：指向买入的 grid_execution
}

export async function executeGridBuy(
  params: ExecuteGridParams
): Promise<{ executionId: string; transactionId: string }> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 未配置');
  if (params.investmentAmount == null || params.investmentAmount <= 0) {
    throw new Error('买入操作必须指定有效的 investmentAmount');
  }
  if (!params.currentNav || params.currentNav <= 0) {
    throw new Error('当前净值为 0，无法计算买入份额');
  }

  const today = new Date().toISOString().split('T')[0];
  const investmentAmount = params.investmentAmount;
  const shares = investmentAmount / params.currentNav;
  const roundedShares = Math.round(shares * SHARE_PRECISION) / SHARE_PRECISION;

  const { transactionId } = await addTransactionWithHoldingUpdate({
    fundId: params.fundCode,
    fundCode: params.fundCode,
    fundName: params.fundName,
    type: 'buy',
    date: today,
    amount: investmentAmount,
    price: params.currentNav,
    shares: roundedShares,
    fee: 0,
    status: 'pending',
    source: 'grid',
  });

  const { data, error } = await (supabase
    .from('grid_executions') as any)
    .insert({
      strategy_id: params.strategyId,
      fund_code: params.fundCode,
      grid_type: params.gridType,
      grid_level: params.gridLevel,
      action: 'buy',
      status: 'executed',
      transaction_id: transactionId,
      executed_nav: params.currentNav,
      executed_amount: investmentAmount,
      executed_shares: roundedShares,
      remaining_shares: roundedShares,
      executed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`写入买入执行记录失败: ${error.message}`);

  const executionId = (data as any).id;

  try {
    const { error: backfillError } = await (supabase
      .from('transactions') as any)
      .update({ grid_execution_id: executionId })
      .eq('id', transactionId);
    if (backfillError) {
      console.warn(`回填 grid_execution_id 失败: ${backfillError.message}`);
    }
  } catch (e) {
    console.warn(`回填 grid_execution_id 异常: ${e}`);
  }

  return { executionId, transactionId };
}

export async function executeGridSell(
  params: ExecuteGridParams
): Promise<{ executionId: string; transactionId: string }> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 未配置');
  if (!params.buyExecutionId) throw new Error('卖出操作必须指定 buyExecutionId');
  if (params.sellShares == null || params.sellShares <= 0) {
    throw new Error('卖出操作必须指定有效的 sellShares');
  }

  const today = new Date().toISOString().split('T')[0];
  const buyExecutionId = params.buyExecutionId;
  const sellShares = params.sellShares;
  const sellAmount = sellShares * params.currentNav;

  const { data: buyExecForCheck, error: buyCheckError } = await (supabase
    .from('grid_executions') as any)
    .select('remaining_shares, executed_shares, transaction_id')
    .eq('id', buyExecutionId)
    .maybeSingle();
  if (buyCheckError) throw new Error(`查询买入执行记录失败: ${buyCheckError.message}`);
  if (!buyExecForCheck) throw new Error('未找到对应的买入执行记录，无法卖出');

  const availableShares = buyExecForCheck.remaining_shares != null
    ? Number(buyExecForCheck.remaining_shares)
    : Number(buyExecForCheck.executed_shares ?? 0);
  if (sellShares > availableShares + 1 / SHARE_PRECISION) {
    throw new Error(`卖出份额(${sellShares})超过该网格剩余可卖份额(${availableShares})`);
  }

  const buyTxId = (buyExecForCheck as any).transaction_id;
  if (!buyTxId) throw new Error('买入执行记录缺少关联交易，数据异常，无法校验卖出');

  const { data: buyTx, error: buyTxError } = await (supabase
    .from('transactions') as any)
    .select('status')
    .eq('id', buyTxId)
    .maybeSingle();
  if (buyTxError) throw new Error(`查询买入交易状态失败: ${buyTxError.message}`);
  if (!buyTx) throw new Error('关联的买入交易不存在，无法校验卖出');
  if (buyTx.status === 'pending') throw new Error('买入交易尚未确认，暂不能卖出');

  const { transactionId } = await addTransactionWithHoldingUpdate({
    fundId: params.fundCode,
    fundCode: params.fundCode,
    fundName: params.fundName,
    type: 'sell',
    date: today,
    amount: Math.round(sellAmount * 100) / 100,
    price: params.currentNav,
    shares: Math.round(sellShares * SHARE_PRECISION) / SHARE_PRECISION,
    fee: 0,
    status: 'completed',
    source: 'grid',
    gridExecutionId: buyExecutionId,
  });

  const { data: sellExecData, error: sellError } = await (supabase
    .from('grid_executions') as any)
    .insert({
      strategy_id: params.strategyId,
      fund_code: params.fundCode,
      grid_type: params.gridType,
      grid_level: params.gridLevel,
      action: 'sell',
      status: 'executed',
      transaction_id: transactionId,
      executed_nav: params.currentNav,
      executed_shares: Math.round(sellShares * SHARE_PRECISION) / SHARE_PRECISION,
      executed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (sellError) throw new Error(`写入卖出执行记录失败: ${sellError.message}`);

  const newRemaining = Math.max(0, Math.round((availableShares - sellShares) * SHARE_PRECISION) / SHARE_PRECISION);
  const { error: updateError } = await (supabase
    .from('grid_executions') as any)
    .update({ remaining_shares: newRemaining })
    .eq('id', buyExecutionId);

  if (updateError) throw new Error(`更新买入执行记录失败: ${updateError.message}`);

  return { executionId: (sellExecData as any).id, transactionId };
}

export async function executeGrid(
  params: ExecuteGridParams
): Promise<{ executionId: string; transactionId: string }> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 未配置');

  if (params.action === 'buy') {
    return executeGridBuy(params);
  }
  return executeGridSell(params);
}

export async function cancelGridExecution(executionId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const { data: exec, error: fetchError } = await (supabase
    .from('grid_executions') as any)
    .select('*')
    .eq('id', executionId)
    .maybeSingle();
  if (fetchError) throw new Error(`查询网格执行记录失败: ${fetchError.message}`);

  if (!exec) return;
  if (exec.status === 'cancelled') return;

  // 检查是否已有卖出消耗了该买入份额：卖出 transaction 的 grid_execution_id 指向该 execution
  if (exec.action === 'buy' && exec.transaction_id) {
    const { data: sellTxs, error: sellErr } = await supabase
      .from('transactions')
      .select('id')
      .eq('grid_execution_id', executionId)
      .eq('type', 'sell')
      .limit(1);
    // fail-closed：查询失败时拒绝取消以保护数据一致性（修复前 fail-open 会 console.warn 放行→数据损坏）
    if (sellErr) throw new Error('检查卖出引用失败，拒绝取消以保护数据一致性');
    if (sellTxs && sellTxs.length > 0) {
      throw new Error('该买入已被卖出引用，无法取消。请先删除对应的卖出记录。');
    }
  }

  // 修复 B：原子性与顺序。
  // 此前顺序为「先恢复份额 → 再删交易 → 再标 cancelled」，中途失败会留下
  // 「份额已恢复但卖出记录仍 executed」的脏状态（份额被重复计入）。
  // 改为「先删交易 → 再标 cancelled → 最后恢复份额」：恢复份额是幂等的最后一步，
  // 即使失败也只是少恢复（保守），不会出现重复计入。
  //
  // 注：Supabase JS client 无事务，单用户场景并发概率极低；如需严格原子性应改为 Postgres RPC。

  // 先解析卖出 execution 对应的买入 execution（用于稍后恢复份额）
  let buyExecIdToRestore: string | undefined;
  if (exec.action === 'sell' && exec.transaction_id) {
    try {
      const { data: sellTx } = await (supabase
        .from('transactions') as any)
        .select('grid_execution_id')
        .eq('id', exec.transaction_id)
        .maybeSingle();
      buyExecIdToRestore = sellTx?.grid_execution_id;
    } catch (e) {
      console.warn('查询卖出的 grid_execution_id 失败，跳过份额恢复:', e);
    }
  }

  // ① 删除关联交易记录
  if (exec.transaction_id) {
    const { error: txError } = await supabase.from('transactions').delete().eq('id', exec.transaction_id);
    if (txError) throw new Error(`删除关联交易失败: ${txError.message}`);
  }

  // ② 标记 execution 取消并清空 transaction_id
  const { error } = await (supabase
    .from('grid_executions') as any)
    .update({ status: 'cancelled', transaction_id: null })
    .eq('id', executionId);
  if (error) throw new Error(`取消网格执行失败: ${error.message}`);

  // ③ 最后恢复买入 execution 的 remaining_shares（幂等保守的收尾步骤）
  //    恢复后不得超过原始买入份额 executed_shares，防止重复恢复导致虚增。
  if (buyExecIdToRestore) {
    try {
      const { data: buyExec } = await (supabase
        .from('grid_executions') as any)
        .select('remaining_shares, executed_shares')
        .eq('id', buyExecIdToRestore)
        .maybeSingle();
      if (buyExec) {
        const sellShares = exec.executed_shares ?? 0;
        const currentRemaining = buyExec.remaining_shares ?? 0;
        const cap = buyExec.executed_shares ?? Number.POSITIVE_INFINITY;
        const restoredRemaining = Math.min(
          cap,
          Math.round((currentRemaining + sellShares) * SHARE_PRECISION) / SHARE_PRECISION
        );
        const { error: restoreError } = await (supabase.from('grid_executions') as any)
          .update({ remaining_shares: restoredRemaining })
          .eq('id', buyExecIdToRestore);
        if (restoreError) {
          console.warn('恢复买入 remaining_shares 失败（卖出已取消，份额偏保守）:', restoreError.message);
        }
      }
    } catch (e) {
      console.warn('恢复买入 remaining_shares 异常（卖出已取消，份额偏保守）:', e);
    }
  }
}

// ============================================
// 状态推导（纯函数）
// ============================================

export function deriveGridStatuses(
  strategy: GridStrategy,
  executions: GridExecution[],
  currentNav: number
): Record<GridType, GridLevelWithStatus[]> {
  const result: Record<GridType, GridLevelWithStatus[]> = {
    small: [],
    medium: [],
    large: [],
  };

  // 清仓检测：当前净值 >= 最大网格 sell_price 时进入清仓模式
  const maxSellPrice = getMaxSellPrice(strategy);
  const isLiquidating = currentNav >= maxSellPrice;

  for (const gridType of GRID_TYPES) {
    const config = strategy.grid_config[gridType];
    if (!config) continue;

    const typeExecutions = executions.filter(e => e.grid_type === gridType);

    result[gridType] = config.grids.map(grid => {
      const buyExec = typeExecutions.find(e => e.grid_level === grid.level && e.action === 'buy' && e.status === 'executed');
      const sellExec = typeExecutions.find(e => e.grid_level === grid.level && e.action === 'sell' && e.status === 'executed');

      let status: GridLevelStatus;
      let distancePct: number;

      const safeSellPrice = grid.sell_price || 1;
      const safeTriggerPrice = grid.trigger_price || 1;

      if (sellExec) {
        status = 'executed';
        distancePct = ((currentNav - safeSellPrice) / safeSellPrice) * 100;
      } else if (buyExec) {
        if (isLiquidating) {
          status = 'executed';
        } else {
          status = currentNav >= grid.sell_price ? 'sell_triggered' : 'executed';
        }
        distancePct = ((currentNav - safeSellPrice) / safeSellPrice) * 100;
      } else if (currentNav <= grid.trigger_price) {
        status = 'triggered';
        distancePct = ((currentNav - safeTriggerPrice) / safeTriggerPrice) * 100;
      } else {
        status = 'above';
        distancePct = ((currentNav - safeTriggerPrice) / safeTriggerPrice) * 100;
      }

      return {
        ...grid,
        status,
        execution: buyExec,
        sellExecution: sellExec,
        distance_pct: Math.round(distancePct * 100) / 100,
      };
    });
  }

  return result;
}

// ============================================
// 留利润计算：根据买入份额和利润留存比例，计算应卖出份额
// ============================================

export function calculateSellShares(
  buyShares: number,
  profitRetentionPct: number
): { sellShares: number; retainShares: number } {
  const clampedPct = Math.max(0, Math.min(1, profitRetentionPct || 0));
  const retainShares = Math.round(buyShares * clampedPct * SHARE_PRECISION) / SHARE_PRECISION;
  const sellShares = Math.max(0, Math.round((buyShares - retainShares) * SHARE_PRECISION) / SHARE_PRECISION);
  return { sellShares, retainShares };
}

// ============================================
// 清仓检测：判断是否超出整个网格范围
// ============================================

export function shouldLiquidate(strategy: GridStrategy, currentNav: number): boolean {
  return currentNav >= getMaxSellPrice(strategy);
}

export function getMaxSellPrice(strategy: GridStrategy): number {
  let maxSellPrice = 0;
  let hasGrid = false;
  for (const gridType of GRID_TYPES) {
    const config = strategy.grid_config[gridType];
    if (!config) continue;
    for (const grid of config.grids) {
      hasGrid = true;
      maxSellPrice = Math.max(maxSellPrice, grid.sell_price);
    }
  }
  return hasGrid ? maxSellPrice : Infinity;
}

export function computeFundOverview(
  strategy: GridStrategy,
  executions: GridExecution[],
  currentNav: number
): GridFundOverview {
  const levelsByType = deriveGridStatuses(strategy, executions, currentNav);

  // 统计所有网格层级
  let totalGridCount = 0;
  let executedCount = 0;
  let triggeredPendingCount = 0;
  let capitalDeployed = 0;

  // 找最近的触发价
  let nearestPrice = Infinity;
  let nearestDistance = Infinity;
  let nearestGridType: GridType = 'small';
  let nearestLevel = 1;

  for (const gridType of GRID_TYPES) {
    const levels = levelsByType[gridType];
    for (const level of levels) {
      totalGridCount++;

      // 已买入（持有中或可卖出），考虑部分卖出后剩余份额。
      // H2 修复：留利润底仓（卖出后 remaining_shares>0）仍属已投入，不能因 sellExecution 存在就排除。
      if (level.execution && (!level.sellExecution || (level.execution.remaining_shares ?? 0) > 0)) {
        executedCount++;
        const exec = level.execution;
        const ratio = exec.executed_shares && exec.executed_shares > 0
          ? Math.min(1, (exec.remaining_shares ?? 0) / exec.executed_shares)
          : 1;
        capitalDeployed += Math.round(level.investment * ratio * 100) / 100;
      } else if (level.status === 'triggered') {
        triggeredPendingCount++;
      }

      // 找最近的未买入网格
      if (!level.execution) {
        const absDist = Math.abs(level.distance_pct);
        if (absDist < nearestDistance) {
          nearestDistance = absDist;
          nearestPrice = level.trigger_price;
          nearestGridType = gridType;
          nearestLevel = level.level;
        }
      }
    }
  }

  // 兜底：所有网格都已买入时，nearestPrice 为 Infinity，置 0 并避免后续除零
  if (nearestPrice === Infinity) {
    nearestPrice = 0;
    nearestDistance = 0;
  }

  const distancePct = nearestPrice > 0
    ? Math.round(((currentNav - nearestPrice) / nearestPrice) * 10000) / 100
    : 0;

  // 计算总预算
  const totalBudget =
    (strategy.grid_config.small?.grids.reduce((s, g) => s + g.investment, 0) || 0) +
    (strategy.grid_config.medium?.grids.reduce((s, g) => s + g.investment, 0) || 0) +
    (strategy.grid_config.large?.grids.reduce((s, g) => s + g.investment, 0) || 0);

  return {
    strategy,
    current_nav: currentNav,
    nearest_trigger: {
      price: nearestPrice,
      distance_pct: distancePct,
      grid_type: nearestGridType,
      level: nearestLevel,
    },
    total_budget: totalBudget,
    capital_deployed: capitalDeployed,
    executed_count: executedCount,
    total_grid_count: totalGridCount,
    triggered_pending_count: triggeredPendingCount,
  };
}

// ============================================
// 批量导入
// ============================================

export async function batchImportGridStrategies(
  jsonData: Array<{
    fund_code: string;
    fund_name: string;
    peak_price: number;
    bottom_price: number;
    grid_config: Record<GridType, GridTypeConfig>;
  }>
): Promise<{ success: number; autoFavorited: number; errors: string[] }> {
  if (!isSupabaseConfigured()) {
    return { success: 0, autoFavorited: 0, errors: ['Supabase 未配置'] };
  }

  let success = 0;
  let autoFavorited = 0;
  const errors: string[] = [];

  for (const item of jsonData) {
    try {
      // 检查是否已存在
      const { data: existing, error: queryError } = await supabase
        .from('grid_strategies')
        .select('id')
        .eq('fund_code', item.fund_code)
        .maybeSingle();

      if (queryError) {
        errors.push(`${item.fund_code}: 查询失败 - ${queryError.message}`);
        continue;
      }

      if (existing) {
        // 更新现有策略
        const { error } = await (supabase
          .from('grid_strategies') as any)
          .update({
            fund_name: item.fund_name,
            peak_price: item.peak_price,
            bottom_price: item.bottom_price,
            grid_config: item.grid_config as any,
            is_active: true,
          })
          .eq('fund_code', item.fund_code);

        if (error) {
          errors.push(`${item.fund_code}: 更新失败 - ${error.message}`);
          continue;
        }

        success++;
      } else {
        // 创建新策略
        const { error } = await (supabase
          .from('grid_strategies') as any)
          .insert({
            fund_code: item.fund_code,
            fund_name: item.fund_name,
            peak_price: item.peak_price,
            bottom_price: item.bottom_price,
            grid_config: item.grid_config as any,
            is_active: true,
          });

        if (error) {
          errors.push(`${item.fund_code}: 创建失败 - ${error.message}`);
          continue;
        }

        success++;

        const ok = await addFavoriteFund(item.fund_code, item.fund_name, '基金');
        if (ok) {
          autoFavorited++;
        } else {
          errors.push(`${item.fund_code}: 添加到收藏失败`);
        }
      }
    } catch (err) {
      errors.push(`${item.fund_code}: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  }

  return { success, autoFavorited, errors };
}

// ============================================
// 数据映射函数
// ============================================

function mapDbGridStrategy(row: any): GridStrategy {
  return {
    id: row.id,
    fund_code: row.fund_code,
    fund_name: row.fund_name,
    peak_price: Number(row.peak_price),
    bottom_price: Number(row.bottom_price),
    grid_config: row.grid_config as Record<GridType, GridTypeConfig>,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapDbGridExecution(row: any): GridExecution {
  return {
    id: row.id,
    strategy_id: row.strategy_id,
    fund_code: row.fund_code,
    grid_type: row.grid_type,
    grid_level: row.grid_level,
    action: row.action,
    status: row.status,
    transaction_id: row.transaction_id,
    executed_nav: row.executed_nav != null ? Number(row.executed_nav) : undefined,
    executed_amount: row.executed_amount != null ? Number(row.executed_amount) : undefined,
    executed_shares: row.executed_shares != null ? Number(row.executed_shares) : undefined,
    remaining_shares: row.remaining_shares != null ? Number(row.remaining_shares) : undefined,
    executed_at: row.executed_at,
  };
}
