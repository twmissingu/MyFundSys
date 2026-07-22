/**
 * 净值更新服务
 * 
 * Supabase 为唯一数据源
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { fetchFundHistory } from './fundApi';
import { formatLocalDate } from '../utils/csv';
import { mapTransaction } from '../utils/mapTransaction';
import { createAlert } from './alertService';
import { isAuthenticated } from '../hooks/useSupabase';
import type { Transaction } from '../types';

declare global {
  interface Window {
    __pendingTransactionsProcessing?: boolean;
  }
}

const PENDING_ALERT_DAYS_THRESHOLD = 5;

// ============================================
// 批次（Lot）类型定义
// ============================================

export interface Lot {
  id: string;              // 原始买入交易ID
  fundCode: string;
  fundName: string;
  shares: number;          // 原始买入份额
  remainingShares: number; // 剩余份额
  cost: number;            // 买入时净值
  date: string;            // 买入日期
  isPending: boolean;      // 是否在途（净值未确认）
  amount?: number;         // 在途买入金额（仅 isPending=true 时有值）
  gridExecutionId?: string; // 关联网格执行记录（网格交易精确匹配）
}

export interface RealizedLot {
  id: string;              // 原始买入交易ID
  fundCode: string;
  fundName: string;
  buyDate: string;
  sellDate: string;
  shares: number;
  buyNav: number;
  sellNav: number;
  cost: number;            // 买入成本 = shares × buyNav
  revenue: number;         // 卖出收入 = shares × sellNav
  profit: number;
  profitRate: number;
  holdingDays: number;
}

// ============================================
// 卖出匹配核心（单一可信实现）
// ============================================
//
// 匹配优先级：
//   1. lot_id 精确匹配（手动按批次卖出 → sell.lotId 指向买入批次 id）
//   2. gridExecutionId 精确匹配（网格交易）
//   3. 成本升序 fallback（无任何精确引用的卖出）
//
// 通过回调 onMatch 把每次扣减交给调用方记账（持仓派生 / 已实现盈亏 / 删除校验等），
// 避免在多处重复实现匹配逻辑导致分歧。

export interface MatchableLot {
  id: string;
  fundCode: string;
  remainingShares: number;
  cost: number;
  isPending?: boolean;
  gridExecutionId?: string;
}

export interface MatchableSell {
  fundCode: string;
  shares: number;
  lotId?: string;
  gridExecutionId?: string;
}

export function matchSellAgainstLots<T extends MatchableLot>(
  lots: T[],
  sell: MatchableSell,
  onMatch?: (lot: T, sellFromLot: number) => void
): number {
  if (sell.shares <= 0) return 0;
  let remainingToSell = sell.shares;

  const deductFrom = (candidates: T[]) => {
    for (const lot of candidates) {
      if (remainingToSell <= 0) break;
      const sellFromLot = Math.min(lot.remainingShares, remainingToSell);
      if (sellFromLot <= 0) continue;
      lot.remainingShares -= sellFromLot;
      remainingToSell -= sellFromLot;
      onMatch?.(lot, sellFromLot);
    }
  };

  const eligible = () =>
    lots.filter(l => l.fundCode === sell.fundCode && l.remainingShares > 0 && !l.isPending);

  // 1. lot_id 精确匹配
  if (sell.lotId) {
    deductFrom(eligible().filter(l => l.id === sell.lotId));
  }

  // 2. gridExecutionId 精确匹配
  if (remainingToSell > 0 && sell.gridExecutionId) {
    deductFrom(
      eligible()
        .filter(l => l.gridExecutionId === sell.gridExecutionId)
        .sort((a, b) => a.cost - b.cost)
    );
  }

  // 3. 成本升序 fallback
  if (remainingToSell > 0) {
    deductFrom(eligible().sort((a, b) => a.cost - b.cost));
  }

  return remainingToSell;
}

/**
 * 手续费分摊后的单批次盈亏计算（统一公式，被已实现盈亏与批次溯源复用）
 * cost = 份额×买入净值 + 买入费按份额比例分摊
 * revenue = 份额×卖出净值 − 卖出费按份额比例分摊
 */
export function calcLotProfit(params: {
  soldShares: number;
  buyNav: number;
  sellNav: number;
  buyFee?: number;
  buyTotalShares?: number;
  sellFee?: number;
  sellTotalShares?: number;
}): { cost: number; revenue: number; profit: number; profitRate: number } {
  const { soldShares, buyNav, sellNav, buyFee = 0, buyTotalShares, sellFee = 0, sellTotalShares } = params;
  const buyFeeShare = buyTotalShares && buyTotalShares > 0 ? (buyFee * soldShares) / buyTotalShares : 0;
  const sellFeeShare = sellTotalShares && sellTotalShares > 0 ? (sellFee * soldShares) / sellTotalShares : 0;
  const cost = soldShares * buyNav + buyFeeShare;
  const revenue = soldShares * sellNav - sellFeeShare;
  const profit = revenue - cost;
  const profitRate = cost > 0 ? profit / cost : 0;
  return { cost, revenue, profit, profitRate };
}

function sortByDateThenCreated(a: Transaction, b: Transaction): number {
  const d = a.date.localeCompare(b.date);
  if (d !== 0) return d;
  return (a.createdAt || '').localeCompare(b.createdAt || '');
}

// ============================================
// 批次派生：从交易记录派生当前持仓批次
// ============================================

export function deriveLots(transactions: Transaction[]): Lot[] {
  const buyTxs = transactions
    .filter(t => t.type === 'buy')
    .sort(sortByDateThenCreated);

  const sellTxs = transactions
    .filter(t => t.type === 'sell' && t.status === 'completed')
    .sort(sortByDateThenCreated);

  // 创建买入批次（包含在途买入）
  const lots: Lot[] = buyTxs.map(tx => ({
    id: tx.id,
    fundCode: tx.fundCode,
    fundName: tx.fundName,
    shares: tx.shares,
    remainingShares: tx.status === 'completed' ? tx.shares : 0,
    cost: tx.price,
    date: tx.date,
    isPending: tx.status === 'pending',
    amount: tx.status === 'pending' ? tx.amount : undefined,
    gridExecutionId: tx.gridExecutionId,
  }));

  // 匹配卖出：lot_id 精确 → gridExecutionId 精确 → 成本升序
  for (const sell of sellTxs) {
    matchSellAgainstLots(lots, {
      fundCode: sell.fundCode,
      shares: sell.shares,
      lotId: sell.lotId,
      gridExecutionId: sell.gridExecutionId,
    });
  }

  // 返回所有批次（包含在途）
  return lots.filter(l => l.remainingShares > 0 || l.isPending);
}

// ============================================
// 已实现盈亏派生：从交易记录派生已卖出批次
// ============================================

export function deriveRealizedLots(transactions: Transaction[]): RealizedLot[] {
  const buyTxs = transactions
    .filter(t => t.type === 'buy' && t.status === 'completed')
    .sort(sortByDateThenCreated);

  const sellTxs = transactions
    .filter(t => t.type === 'sell' && t.status === 'completed')
    .sort(sortByDateThenCreated);

  // 携带原始买入信息用于盈亏与手续费分摊
  interface RealizingLot extends MatchableLot {
    fundName: string;
    buyNav: number;
    buyDate: string;
    buyFee: number;
    buyTotalShares: number;
  }

  const lots: RealizingLot[] = buyTxs.map(tx => ({
    id: tx.id,
    fundCode: tx.fundCode,
    fundName: tx.fundName,
    remainingShares: tx.shares,
    cost: tx.price,
    gridExecutionId: tx.gridExecutionId,
    buyNav: tx.price,
    buyDate: tx.date,
    buyFee: tx.fee || 0,
    buyTotalShares: tx.shares,
  }));

  const realizedLots: RealizedLot[] = [];

  for (const sell of sellTxs) {
    matchSellAgainstLots(
      lots,
      {
        fundCode: sell.fundCode,
        shares: sell.shares,
        lotId: sell.lotId,
        gridExecutionId: sell.gridExecutionId,
      },
      (lot, sellFromLot) => {
        const { cost, revenue, profit, profitRate } = calcLotProfit({
          soldShares: sellFromLot,
          buyNav: lot.buyNav,
          sellNav: sell.price,
          buyFee: lot.buyFee,
          buyTotalShares: lot.buyTotalShares,
          sellFee: sell.fee,
          sellTotalShares: sell.shares,
        });
        const holdingDays = Math.max(
          0,
          Math.round((new Date(sell.date).getTime() - new Date(lot.buyDate).getTime()) / (1000 * 60 * 60 * 24))
        );
        realizedLots.push({
          id: lot.id,
          fundCode: lot.fundCode,
          fundName: lot.fundName,
          buyDate: lot.buyDate,
          sellDate: sell.date,
          shares: sellFromLot,
          buyNav: lot.buyNav,
          sellNav: sell.price,
          cost,
          revenue,
          profit,
          profitRate,
          holdingDays,
        });
      }
    );
  }

  // 按卖出日期倒序
  return realizedLots.sort((a, b) => b.sellDate.localeCompare(a.sellDate));
}

// ============================================
// 持仓汇总：从批次派生基金级汇总
// ============================================

export interface HoldingSummary {
  fundCode: string;
  fundName: string;
  shares: number;
  totalCost: number;
  avgCost: number;
  currentNav?: number;
  currentValue?: number;
  profit?: number;
  profitRate?: number;
}

export function summarizeHoldings(lots: Lot[]): HoldingSummary[] {
  const byFund: Record<string, HoldingSummary> = {};

  for (const lot of lots) {
    if (!byFund[lot.fundCode]) {
      byFund[lot.fundCode] = {
        fundCode: lot.fundCode,
        fundName: lot.fundName,
        shares: 0,
        totalCost: 0,
        avgCost: 0,
      };
    }
    const summary = byFund[lot.fundCode];
    summary.shares += lot.remainingShares;
    summary.totalCost += lot.remainingShares * lot.cost;
  }

  // 计算平均成本
  for (const summary of Object.values(byFund)) {
    summary.avgCost = summary.shares > 0 ? summary.totalCost / summary.shares : 0;
  }

  return Object.values(byFund);
}

// ============================================
// 卖出匹配：按成本最低批次匹配
// ============================================

export interface SellMatchResult {
  lotsUsed: { lotId: string; shares: number; cost: number }[];
  remainingShares: number;
}

export function matchSellLots(
  lots: Lot[],
  fundCode: string,
  sellShares: number,
  gridExecutionId?: string,
  lotId?: string
): SellMatchResult {
  // 使用副本避免修改输入数组
  const fundLots = lots
    .filter(l => l.fundCode === fundCode && l.remainingShares > 0)
    .map(l => ({ ...l }));

  const lotsUsed: SellMatchResult['lotsUsed'] = [];

  const remainingShares = matchSellAgainstLots(
    fundLots,
    { fundCode, shares: sellShares, lotId, gridExecutionId },
    (lot, sellFromLot) => {
      lotsUsed.push({ lotId: lot.id, shares: sellFromLot, cost: lot.cost });
    }
  );

  return { lotsUsed, remainingShares };
}

// ============================================
// 删除交易验证：检查是否已被部分卖出
// ============================================

export interface DeleteCheckResult {
  canDelete: boolean;
  reason?: string;
}

/**
 * 检查是否可以安全删除某笔交易
 * 如果是买入交易，检查是否有卖出交易已经匹配了该批次
 */
export function canDeleteTransaction(
  transactions: Transaction[],
  transactionId: string
): DeleteCheckResult {
  const tx = transactions.find(t => t.id === transactionId);
  if (!tx) return { canDelete: false, reason: '交易不存在' };

  if (tx.type === 'sell') {
    // 卖出交易：检查是否还有其他卖出依赖它
    // 简化处理：卖出交易可以删除（会回滚到对应批次）
    return { canDelete: true };
  }

  // 买入交易：按日期排序（与 deriveLots 保持一致）
  const buyTxs = transactions
    .filter(t => t.type === 'buy' && t.status === 'completed')
    .sort(sortByDateThenCreated);

  const sellTxs = transactions
    .filter(t => t.type === 'sell' && t.status === 'completed')
    .sort(sortByDateThenCreated);

  // 模拟批次派生（与 deriveLots 一致：lot_id → gridExecutionId → 成本升序）
  const lots = buyTxs.map(b => ({
    id: b.id,
    fundCode: b.fundCode,
    shares: b.shares,
    remainingShares: b.shares,
    cost: b.price,
    gridExecutionId: b.gridExecutionId,
  }));

  for (const sell of sellTxs) {
    matchSellAgainstLots(lots, {
      fundCode: sell.fundCode,
      shares: sell.shares,
      lotId: sell.lotId,
      gridExecutionId: sell.gridExecutionId,
    });
  }

  // 检查目标买入批次是否被卖出过
  const targetLot = lots.find(l => l.id === transactionId);
  if (targetLot && targetLot.remainingShares < targetLot.shares) {
    const soldShares = targetLot.shares - targetLot.remainingShares;
    return {
      canDelete: false,
      reason: `该笔买入已有 ${soldShares.toFixed(2)} 份被卖出，无法删除。请先在持仓明细中卖出剩余份额后再删除交易记录。`,
    };
  }

  return { canDelete: true };
}

/**
 * 返回指定基金当前可卖份额（已完成买入批次剩余份额之和，不含在途）。
 * 用于卖出前防超卖校验。
 */
export function getFundAvailableShares(transactions: Transaction[], fundCode: string): number {
  const lots = deriveLots(transactions);
  return lots
    .filter(l => l.fundCode === fundCode && !l.isPending)
    .reduce((sum, l) => sum + l.remainingShares, 0);
}

// ============================================
// 原子性交易操作
// ============================================

/**
 * 添加交易记录并自动更新持仓
 * @param transaction 交易数据（不含 id 和 createdAt）
 * @returns 插入结果，包含 transactionId 和 holdingUpdated 状态
 * @throws 插入失败时抛出错误
 */
export async function addTransactionWithHoldingUpdate(
  transaction: Omit<Transaction, 'id' | 'createdAt'>
): Promise<{ transactionId: string; holdingUpdated: boolean }> {
  if (!isAuthenticated()) throw new Error('认证已过期，请刷新页面重新登录');
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }

  // H5 服务层守卫：卖出（已确认）时校验不超过当前持仓，杜绝绕过 UI 的超卖。
  // 与 executeGrid 的服务层校验一致；pending 卖出无确认份额，跳过。
  if (transaction.type === 'sell' && (transaction.status || 'completed') === 'completed') {
    const { data: existingTxs, error: fetchErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('fund_code', transaction.fundCode);
    if (fetchErr) throw new Error(`查询持仓失败: ${fetchErr.message}`);
    const available = getFundAvailableShares(
      (existingTxs as any[] || []).map(mapTransaction),
      transaction.fundCode
    );
    if (transaction.shares > available + 1e-4) {
      throw new Error(`卖出份额(${transaction.shares})超过当前持仓(${available.toFixed(4)})`);
    }
  }

  const transactionId = crypto.randomUUID();

  function buildPayload(includeOptional: boolean): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      id: transactionId,
      fund_code: transaction.fundCode,
      fund_name: transaction.fundName,
      type: transaction.type,
      shares: transaction.shares,
      nav: transaction.price,
      amount: transaction.amount,
      fee: transaction.fee || 0,
      date: transaction.date,
      status: transaction.status || 'completed',
    };
    if (includeOptional) {
      if (transaction.source && transaction.source !== 'manual') {
        payload.source = transaction.source;
      }
      if (transaction.confirmDate) {
        payload.confirm_date = transaction.confirmDate;
      }
      if (transaction.gridExecutionId) {
        payload.grid_execution_id = transaction.gridExecutionId;
      }
      if (transaction.lotId) {
        payload.lot_id = transaction.lotId;
      }
    }
    return payload;
  }

  // 先尝试包含可选列（source / confirm_date / grid_execution_id / lot_id）
  // 若失败（schema cache 未刷新），回退到仅基础列
  for (let attempt = 0; attempt < 2; attempt++) {
    const withOptional = attempt === 0;
    const { data, error } = await supabase
      .from('transactions')
      .insert(buildPayload(withOptional) as any)
      .select()
      .single();

    if (!error && data) {
      return {
        transactionId: (data as any).id,
        holdingUpdated: transaction.status === 'completed',
      };
    }

    if (!error && !data) {
      throw new Error('插入交易记录成功但未返回数据');
    }

    if (withOptional) {
      const msg = error.message || '';
      if (msg.includes('Could not find') && msg.includes('schema cache')) {
        continue;
      }
    }

    throw new Error(`插入交易记录失败: ${error?.message || '未知错误'}`);
  }

  throw new Error('插入交易记录失败');
}

export async function removeTransactionWithHoldingUpdate(
  transactionId: string
): Promise<void> {
  if (!isAuthenticated()) throw new Error('认证已过期，请刷新页面重新登录');
  if (!isSupabaseConfigured()) return;

  const { data: txData, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .limit(1)
    .maybeSingle();
  if (txError) {
    throw new Error(`查询交易失败: ${txError.message}`);
  }
  const transaction = txData as any;

  if (!transaction) return;

  // 修复 K：删除网格交易时同步 grid_executions，避免持仓派生与网格状态永久脱节。
  // 通用删除入口此前不感知 grid_execution_id，删网格卖出会让批次份额"复活"而网格 remaining_shares 不回补。
  await syncGridOnTransactionDelete(transaction);

  const { error } = await supabase.from('transactions').delete().eq('id', transactionId);
  if (error) {
    throw new Error(`删除交易失败: ${error.message}`);
  }
}

/**
 * 删除某笔网格交易前，同步对应的 grid_executions：
 * - 删网格卖出：回补买入 execution 的 remaining_shares（封顶 executed_shares），并将该卖出 execution 标记 cancelled
 * - 删网格买入：若已被卖出引用则阻止删除；否则将该买入 execution 标记 cancelled 并清空 transaction_id
 * 非网格交易直接返回。
 */
async function syncGridOnTransactionDelete(transaction: any): Promise<void> {
  // 找到 transaction_id 指向该交易的 grid_executions 记录
  const { data: execData, error: execErr } = await (supabase
    .from('grid_executions') as any)
    .select('*')
    .eq('transaction_id', transaction.id)
    .maybeSingle();
  if (execErr) throw new Error(`查询网格执行记录失败: ${execErr.message}`);
  const exec = execData as any;

  // 删网格卖出交易：回补买入 execution 的剩余份额
  if (transaction.type === 'sell') {
    const buyExecId = transaction.grid_execution_id;
    if (buyExecId) {
      const { data: buyExec, error: buyErr } = await (supabase
        .from('grid_executions') as any)
        .select('remaining_shares, executed_shares')
        .eq('id', buyExecId)
        .maybeSingle();
      if (buyErr) throw new Error(`查询买入执行记录失败: ${buyErr.message}`);
      if (buyExec) {
        const restoreShares = exec?.executed_shares ?? transaction.shares ?? 0;
        const currentRemaining = buyExec.remaining_shares ?? 0;
        const cap = buyExec.executed_shares ?? Number.POSITIVE_INFINITY;
        const restored = Math.min(cap, Math.round((currentRemaining + restoreShares) * 10000) / 10000);
        const { error: restoreErr } = await (supabase.from('grid_executions') as any)
          .update({ remaining_shares: restored })
          .eq('id', buyExecId);
        if (restoreErr) throw new Error(`回补买入份额失败: ${restoreErr.message}`);
      }
    }
    if (exec && exec.action === 'sell') {
      const { error: cancelErr } = await (supabase.from('grid_executions') as any)
        .update({ status: 'cancelled', transaction_id: null })
        .eq('id', exec.id);
      if (cancelErr) throw new Error(`取消卖出执行记录失败: ${cancelErr.message}`);
    }
    return;
  }

  // 删网格买入交易：若已被卖出引用则阻止
  if (transaction.type === 'buy' && exec && exec.action === 'buy') {
    const { data: sellTxs, error: sellErr } = await supabase
      .from('transactions')
      .select('id')
      .eq('grid_execution_id', exec.id)
      .eq('type', 'sell')
      .limit(1);
    // fail-closed：查询失败时拒绝删除以保护数据一致性（修复前 fail-open 会放行取消买入→数据损坏）
    if (sellErr) throw new Error('检查卖出引用失败，拒绝删除以保护数据一致性');
    if (sellTxs && sellTxs.length > 0) {
      throw new Error('该网格买入已被卖出引用，无法删除。请先删除对应的卖出记录。');
    }
    const { error: cancelErr } = await (supabase.from('grid_executions') as any)
      .update({ status: 'cancelled', transaction_id: null })
      .eq('id', exec.id);
    if (cancelErr) throw new Error(`取消买入执行记录失败: ${cancelErr.message}`);
  }
}

/**
 * 删除持仓及其关联的所有交易记录
 * @param holdingId holdings 表中的记录 ID（兼容性参数，实际不使用）
 * @param fundCode 基金代码，用于定位要删除的交易记录
 */
export async function removeHoldingWithTransactions(fundCode: string): Promise<void> {
  if (!isAuthenticated()) throw new Error('认证已过期，请刷新页面重新登录');
  if (!isSupabaseConfigured()) return;
  if (!fundCode) throw new Error('fundCode 不能为空');

  // 删除该基金的所有交易记录
  const { error: txError } = await supabase.from('transactions').delete().eq('fund_code', fundCode);
  if (txError) throw new Error(`删除交易记录失败: ${txError.message}`);
  // holdings 表不再使用（从 transactions 派生），无需额外操作
}

// ============================================
// 在途交易处理
// ============================================

async function buildPendingNavCache(
  pendingTransactions: any[]
): Promise<{ navCache: Map<string, { nav: number; navDate: string }>; errors: string[] }> {
  const fundGroups = new Map<string, { confirmDates: string[] }>();
  for (const tx of pendingTransactions) {
    const code = tx.fund_code;
    const confirmDate = tx.confirm_date || tx.date;
    if (!fundGroups.has(code)) fundGroups.set(code, { confirmDates: [] });
    fundGroups.get(code)!.confirmDates.push(confirmDate);
  }

  const navCache = new Map<string, { nav: number; navDate: string }>();
  const errors: string[] = [];

  for (const [code, group] of fundGroups) {
    try {
      const sortedDates = [...new Set(group.confirmDates)].sort((a, b) => a.localeCompare(b));
      const earliest = sortedDates[0];
      const today = formatLocalDate(new Date());
      const history = await fetchFundHistory(code, 100, 1, earliest, today);

      for (const confirmDate of sortedDates) {
        const match = history.find(h => h.date === confirmDate && h.nav > 0);
        if (match) {
          navCache.set(`${code}_${confirmDate}`, { nav: match.nav, navDate: match.date });
        }
      }
    } catch (err) {
      errors.push(`${code}: 净值获取失败 — ${err instanceof Error ? err.message : '未知错误'}`);
    }
  }

  return { navCache, errors };
}

export interface ProcessPendingResult {
  processedCount: number;
  pendingCount: number;
  errors: string[];
}

/**
 * 处理在途交易
 * 使用全局标记避免多页面重复调用
 */
export async function processPendingTransactions(): Promise<ProcessPendingResult> {
  // 防止多页面/多组件重复调用
  if (window.__pendingTransactionsProcessing) {
    return { processedCount: 0, pendingCount: 0, errors: [] };
  }
  window.__pendingTransactionsProcessing = true;

  try {
    if (!isSupabaseConfigured()) {
      return { processedCount: 0, pendingCount: 0, errors: [] };
    }

    const { data: pendingTxData, error: pendingError } = await supabase
      .from('transactions')
      .select('*')
      .eq('status', 'pending');
    if (pendingError) {
      return { processedCount: 0, pendingCount: 0, errors: [`查询在途交易失败: ${pendingError.message}`] };
    }
    const pendingTransactions = pendingTxData as any[] | null;
  
    if (!pendingTransactions || pendingTransactions.length === 0) {
      return { processedCount: 0, pendingCount: 0, errors: [] };
    }
  
    const { navCache, errors } = await buildPendingNavCache(pendingTransactions);

    let processedCount = 0;
  
    for (const transaction of pendingTransactions) {
      const confirmDate = transaction.confirm_date || transaction.date;
      try {
        const cacheKey = `${transaction.fund_code}_${confirmDate}`;
        const navInfo = navCache.get(cacheKey);
        if (!navInfo) {
          // 修复 #3：取不到确认日真实净值时不降级成交。
          // 确认日尚未到期（未来日期）→ 正常等待，静默保持 pending；
          // 确认日已过且超过阈值仍无净值 → 写告警提示人工处理。
          const todayStr = formatLocalDate(new Date());
          const confirmObj = new Date(confirmDate);
          const isPast = !isNaN(confirmObj.getTime()) && confirmDate < todayStr;
          if (isPast) {
            const daysSinceConfirm = Math.floor((Date.now() - confirmObj.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSinceConfirm > PENDING_ALERT_DAYS_THRESHOLD) {
              await createAlert({
                transactionId: transaction.id,
                fundCode: transaction.fund_code,
                confirmDate,
                reason: 'no_nav_data',
                detail: `无法获取 ${transaction.fund_code} 在 ${confirmDate} 的净值（已超过 ${PENDING_ALERT_DAYS_THRESHOLD} 天）`,
              });
              errors.push(`${transaction.fund_code}: 无法获取净值`);
            }
          }
          // 保持 pending，等待真实净值
          continue;
        }
  
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const confirmDateObj = new Date(confirmDate);
        const navDateObj = new Date(navInfo.navDate);
  
        if (isNaN(confirmDateObj.getTime()) || isNaN(navDateObj.getTime())) {
          await createAlert({
            transactionId: transaction.id,
            fundCode: transaction.fund_code,
            confirmDate,
            reason: 'api_error',
            detail: `无效日期: confirmDate=${confirmDate}, navDate=${navInfo.navDate}`,
          });
          errors.push(`${transaction.fund_code}: 日期无效`);
          continue;
        }
  
        if (navDateObj.getTime() < confirmDateObj.getTime()) {
          if (confirmDateObj < today) {
            const daysSinceConfirm = Math.floor((today.getTime() - confirmDateObj.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSinceConfirm > PENDING_ALERT_DAYS_THRESHOLD) {
              await createAlert({
                transactionId: transaction.id,
                fundCode: transaction.fund_code,
                confirmDate,
                reason: 'nav_date_mismatch',
                detail: `净值日期(${navInfo.navDate})早于确认日期(${confirmDate})超过5天`,
              });
              continue;
            }
          } else {
            continue;
          }
        }
  
        const tradePrice = navInfo.nav;
        let shares: number;
        let amount: number;
  
        if (transaction.type === 'buy') {
          amount = transaction.amount;
          shares = amount / tradePrice;
        } else {
          shares = transaction.shares;
          amount = shares * tradePrice;
        }
  
        if (!Number.isFinite(shares) || !Number.isFinite(amount)) {
          throw new Error(`计算结果无效: shares=${shares}, amount=${amount}`);
        }
  
        const roundedShares = Math.round(shares * 10000) / 10000;
        const roundedAmount = Math.round(amount * 100) / 100;
  
        // H5 闭环：pending 卖出确认时也校验超卖（创建时 UI/服务层均跳过 pending，否则可创建 pending 卖出 999999 份后自动确认超卖）
        if (transaction.type === 'sell') {
          const { data: fundTxs, error: fundTxErr } = await supabase
            .from('transactions')
            .select('*')
            .eq('fund_code', transaction.fund_code);
          if (fundTxErr) throw new Error(`查询持仓失败: ${fundTxErr.message}`);
          const available = getFundAvailableShares(
            (fundTxs as any[] || []).map(mapTransaction),
            transaction.fund_code
          );
          if (roundedShares > available + 1e-4) {
            try {
              await createAlert({
                transactionId: transaction.id,
                fundCode: transaction.fund_code,
                confirmDate,
                reason: 'oversell',
                detail: `卖出 ${roundedShares} 份超过当前持仓 ${available.toFixed(4)} 份，未自动确认`,
              });
            } catch { /* 告警失败不影响主流程 */ }
            errors.push(`${transaction.fund_code}: 卖出超过持仓，未确认`);
            continue;
          }
        }
  
        const { error: updateError } = await (supabase.from('transactions') as any).update({
          nav: tradePrice,
          shares: roundedShares,
          amount: roundedAmount,
          status: 'completed',
        }).eq('id', transaction.id);
  
        if (updateError) {
          throw new Error(`更新失败: ${updateError.message}`);
        }
  
        // 修复 #6：网格买入在途确认后，把真实成交净值/份额回填到 grid_executions，
        // 避免网格的 remaining_shares / capital_deployed 永久停留在下单时的估值。
        if (transaction.type === 'buy' && transaction.grid_execution_id) {
          try {
            await (supabase.from('grid_executions') as any).update({
              executed_nav: tradePrice,
              executed_amount: roundedAmount,
              executed_shares: roundedShares,
              remaining_shares: roundedShares,
            }).eq('id', transaction.grid_execution_id);
          } catch (e) {
            console.warn(`回填 grid_execution 成交净值失败: ${e}`);
          }
        }
  
        processedCount++;
      } catch (error) {
        const msg = `${transaction.fund_code}: ${error instanceof Error ? error.message : String(error)}`;
        try {
          await createAlert({
            transactionId: transaction.id,
            fundCode: transaction.fund_code,
            confirmDate,
            reason: 'api_error',
            detail: msg,
          });
        } catch (e) { /* 告警创建失败不影响主流程，但记录以便排查 */
          console.warn('告警创建失败:', e);
        }
        errors.push(msg);
      }
    }
  
    return {
      processedCount,
      pendingCount: pendingTransactions.length - processedCount,
      errors,
    };
  } finally {
    // 处理完成后重置标记，允许下次调用
    window.__pendingTransactionsProcessing = false;
  }
}
