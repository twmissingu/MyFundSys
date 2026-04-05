/**
 * 净值更新服务
 * 
 * Supabase 为唯一数据源
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { fetchFundNav } from './fundApi';
import type { Holding, Transaction } from '../types';

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
// 批次派生：从交易记录派生当前持仓批次
// ============================================

export function deriveLots(transactions: Transaction[]): Lot[] {
  const buyTxs = transactions
    .filter(t => t.type === 'buy')
    .sort((a, b) => a.date.localeCompare(b.date));

  const sellTxs = transactions
    .filter(t => t.type === 'sell' && t.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date));

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
  }));

  // 按成本升序匹配卖出（先卖成本最低的，跳过在途批次）
  for (const sell of sellTxs) {
    let remainingToSell = sell.shares;
    const fundLots = lots
      .filter(l => l.fundCode === sell.fundCode && l.remainingShares > 0 && !l.isPending)
      .sort((a, b) => a.cost - b.cost);

    for (const lot of fundLots) {
      if (remainingToSell <= 0) break;
      const sellFromLot = Math.min(lot.remainingShares, remainingToSell);
      lot.remainingShares -= sellFromLot;
      remainingToSell -= sellFromLot;
    }
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
    .sort((a, b) => a.date.localeCompare(b.date));

  const sellTxs = transactions
    .filter(t => t.type === 'sell' && t.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date));

  const lots: Lot[] = buyTxs.map(tx => ({
    id: tx.id,
    fundCode: tx.fundCode,
    fundName: tx.fundName,
    shares: tx.shares,
    remainingShares: tx.shares,
    cost: tx.price,
    date: tx.date,
  }));

  const realizedLots: RealizedLot[] = [];

  for (const sell of sellTxs) {
    let remainingToSell = sell.shares;
    const fundLots = lots
      .filter(l => l.fundCode === sell.fundCode && l.remainingShares > 0)
      .sort((a, b) => a.cost - b.cost);

    for (const lot of fundLots) {
      if (remainingToSell <= 0) break;
      const sellFromLot = Math.min(lot.remainingShares, remainingToSell);
      lot.remainingShares -= sellFromLot;

      // 如果该批次全部卖出，记录已实现盈亏
      if (lot.remainingShares === 0) {
        const sellDate = new Date(sell.date);
        const buyDate = new Date(lot.date);
        const holdingDays = Math.max(0, Math.floor((sellDate.getTime() - buyDate.getTime()) / (1000 * 60 * 60 * 24)));
        const cost = sellFromLot * lot.cost;
        const revenue = sellFromLot * sell.price;
        const profit = revenue - cost;
        const profitRate = cost > 0 ? profit / cost : 0;

        realizedLots.push({
          id: lot.id,
          fundCode: lot.fundCode,
          fundName: lot.fundName,
          buyDate: lot.date,
          sellDate: sell.date,
          shares: sellFromLot,
          buyNav: lot.cost,
          sellNav: sell.price,
          cost,
          revenue,
          profit,
          profitRate,
          holdingDays,
        });
      }
    }
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
  sellShares: number
): SellMatchResult {
  const fundLots = lots
    .filter(l => l.fundCode === fundCode && l.remainingShares > 0)
    .sort((a, b) => a.cost - b.cost);

  let remainingToSell = sellShares;
  const lotsUsed: SellMatchResult['lotsUsed'] = [];

  for (const lot of fundLots) {
    if (remainingToSell <= 0) break;
    const sellFromLot = Math.min(lot.remainingShares, remainingToSell);
    lotsUsed.push({ lotId: lot.id, shares: sellFromLot, cost: lot.cost });
    lot.remainingShares -= sellFromLot;
    remainingToSell -= sellFromLot;
  }

  return { lotsUsed, remainingShares: remainingToSell };
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

  // 买入交易：检查是否有卖出交易匹配了该批次
  const buyTxs = transactions
    .filter(t => t.type === 'buy' && t.status === 'completed')
    .sort((a, b) => a.price - b.price || a.date.localeCompare(b.date));

  const sellTxs = transactions
    .filter(t => t.type === 'sell' && t.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date));

  // 模拟批次派生
  const lots = buyTxs.map(b => ({
    id: b.id,
    fundCode: b.fundCode,
    shares: b.shares,
    remainingShares: b.shares,
    cost: b.price,
  }));

  // 模拟卖出匹配
  for (const sell of sellTxs) {
    let remainingToSell = sell.shares;
    const fundLots = lots
      .filter(l => l.fundCode === sell.fundCode && l.remainingShares > 0)
      .sort((a, b) => a.cost - b.cost);

    for (const lot of fundLots) {
      if (remainingToSell <= 0) break;
      const sellFromLot = Math.min(lot.remainingShares, remainingToSell);
      lot.remainingShares -= sellFromLot;
      remainingToSell -= sellFromLot;
    }
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

// ============================================
// 持仓更新工具函数
// ============================================

export function updateLocalHoldingAfterTransaction(
  holding: Holding | undefined,
  transaction: Transaction
): { holding: Holding | null; shouldDelete: boolean } {
  if (!holding) {
    if (transaction.type === 'sell') {
      return { holding: null, shouldDelete: false };
    }
    return {
      holding: {
        id: crypto.randomUUID(),
        fundId: transaction.fundId,
        fundCode: transaction.fundCode,
        fundName: transaction.fundName,
        shares: transaction.shares,
        avgCost: transaction.price,
        totalCost: transaction.amount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      shouldDelete: false,
    };
  }

  const newShares = transaction.type === 'buy'
    ? holding.shares + transaction.shares
    : holding.shares - transaction.shares;

  const newTotalCost = transaction.type === 'buy'
    ? holding.totalCost + transaction.amount
    : holding.totalCost - transaction.amount;

  if (newShares <= 0) {
    return { holding: null, shouldDelete: true };
  }

  return {
    holding: {
      ...holding,
      shares: newShares,
      totalCost: newTotalCost,
      avgCost: newTotalCost / newShares,
      updatedAt: new Date().toISOString(),
    },
    shouldDelete: false,
  };
}

export function reverseTransactionOnHolding(
  holding: Holding | undefined,
  transaction: Transaction
): { holding: Holding | null; shouldDelete: boolean } {
  if (!holding) {
    return { holding: null, shouldDelete: false };
  }

  const newShares = transaction.type === 'buy'
    ? holding.shares - transaction.shares
    : holding.shares + transaction.shares;

  const newTotalCost = transaction.type === 'buy'
    ? holding.totalCost - transaction.amount
    : holding.totalCost + transaction.amount;

  if (newShares <= 0) {
    return { holding: null, shouldDelete: true };
  }

  return {
    holding: {
      ...holding,
      shares: newShares,
      totalCost: newTotalCost,
      avgCost: newTotalCost / newShares,
      updatedAt: new Date().toISOString(),
    },
    shouldDelete: false,
  };
}

// ============================================
// 原子性交易操作
// ============================================

export async function addTransactionWithHoldingUpdate(
  transaction: Omit<Transaction, 'id' | 'createdAt'>
): Promise<{ transactionId: string; holdingUpdated: boolean }> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }

  const transactionId = crypto.randomUUID();

  const txPayload = {
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

  await supabase.from('transactions').insert(txPayload as any);

  return {
    transactionId,
    holdingUpdated: transaction.status === 'completed',
  };
}

export async function removeTransactionWithHoldingUpdate(
  transactionId: string
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const { data: transaction } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transactionId)
    .limit(1)
    .maybeSingle();

  if (!transaction) return;

  await supabase.from('transactions').delete().eq('id', transactionId);
}

export async function removeHoldingWithTransactions(holdingId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const { data: holding } = await supabase
    .from('holdings')
    .select('fund_code')
    .eq('id', holdingId)
    .limit(1)
    .maybeSingle();

  if (!holding) return;

  await supabase.from('holdings').delete().eq('id', holdingId);
  await supabase.from('transactions').delete().eq('fund_code', holding.fund_code);
}

// ============================================
// 在途交易处理
// ============================================

export interface ProcessPendingResult {
  processedCount: number;
  pendingCount: number;
  errors: string[];
}

export async function processPendingTransactions(): Promise<ProcessPendingResult> {
  if (!isSupabaseConfigured()) {
    return { processedCount: 0, pendingCount: 0, errors: [] };
  }

  const { data: pendingTransactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('status', 'pending');

  if (!pendingTransactions || pendingTransactions.length === 0) {
    return { processedCount: 0, pendingCount: 0, errors: [] };
  }

  console.log(`[Pending] 发现 ${pendingTransactions.length} 笔在途交易`);

  const fundCodes = [...new Set(pendingTransactions.map((t: any) => t.fund_code))];
  const navCache = new Map<string, { nav: number; navDate: string }>();

  for (const code of fundCodes) {
    try {
      const navData = await fetchFundNav(code);
      if (navData && navData.nav > 0) {
        navCache.set(code, {
          nav: navData.nav,
          navDate: navData.navDate || new Date().toISOString().split('T')[0],
        });
      }
    } catch (error) {
      console.error(`[Pending] 获取净值失败 ${code}:`, error);
    }
  }

  let processedCount = 0;
  const errors: string[] = [];

  for (const transaction of pendingTransactions) {
    try {
      const navInfo = navCache.get(transaction.fund_code);
      if (!navInfo) {
        errors.push(`${transaction.fund_code}: 无法获取净值`);
        continue;
      }

      const confirmDate = transaction.confirm_date || transaction.date;

      const confirmDateObj = new Date(confirmDate);
      const navDateObj = new Date(navInfo.navDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (navInfo.navDate >= confirmDate) {
        // 正常处理
      } else if (confirmDateObj < today) {
        const daysSinceNav = Math.floor((today.getTime() - navDateObj.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceNav > 5) {
          console.log(`[Pending] 净值过旧，等待中: ${transaction.fund_code}, 确认日: ${confirmDate}, 净值日: ${navInfo.navDate}`);
          continue;
        }
      } else {
        console.log(`[Pending] 净值未更新，等待中: ${transaction.fund_code}, 确认日: ${confirmDate}, 净值日: ${navInfo.navDate}`);
        continue;
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

      await supabase.from('transactions').update({
        nav: tradePrice,
        shares,
        amount,
        status: 'completed',
      }).eq('id', transaction.id);

      processedCount++;
      console.log(`[Pending] 处理完成: ${transaction.fund_code}, 确认日: ${confirmDate}, 净值: ${tradePrice}`);
    } catch (error) {
      const msg = `${transaction.fund_code}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(msg);
      console.error(`[Pending] 处理失败 ${transaction.fund_code}:`, error);
    }
  }

  return {
    processedCount,
    pendingCount: pendingTransactions.length - processedCount,
    errors,
  };
}
