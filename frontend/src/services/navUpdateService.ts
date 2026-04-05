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
    .filter(t => t.type === 'buy' && t.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date));

  const sellTxs = transactions
    .filter(t => t.type === 'sell' && t.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date));

  // 创建买入批次
  const lots: Lot[] = buyTxs.map(tx => ({
    id: tx.id,
    fundCode: tx.fundCode,
    fundName: tx.fundName,
    shares: tx.shares,
    remainingShares: tx.shares,
    cost: tx.price,
    date: tx.date,
  }));

  // 按成本升序匹配卖出（先卖成本最低的）
  for (const sell of sellTxs) {
    let remainingToSell = sell.shares;
    // 同一基金内按成本升序
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

  // 只返回还有剩余份额的批次（持仓明细）
  return lots.filter(l => l.remainingShares > 0);
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

  if (transaction.status === 'completed') {
    await updateHoldingOnSupabase(transaction.fundCode, transaction.fundName, transaction.type, transaction.shares, transaction.amount, transaction.price);
  }

  return {
    transactionId,
    holdingUpdated: transaction.status === 'completed',
  };
}

async function updateHoldingOnSupabase(
  fundCode: string,
  fundName: string,
  type: string,
  shares: number,
  amount: number,
  price: number
): Promise<void> {
  const { data: existing } = await supabase
    .from('holdings')
    .select('*')
    .eq('fund_code', fundCode)
    .limit(1)
    .maybeSingle();

  if (type === 'buy') {
    if (!existing) {
      await supabase.from('holdings').insert({
        fund_code: fundCode,
        fund_name: fundName || '',
        shares,
        avg_nav: price,
        total_cost: amount,
      } as any);
    } else {
      const newShares = existing.shares + shares;
      const newTotalCost = existing.total_cost + amount;
      await supabase.from('holdings').update({
        shares: newShares,
        avg_nav: newTotalCost / newShares,
        total_cost: newTotalCost,
      }).eq('fund_code', fundCode);
    }
  } else {
    if (existing) {
      const newShares = existing.shares - shares;
      const newTotalCost = existing.total_cost - amount;
      if (newShares <= 0) {
        await supabase.from('holdings').delete().eq('fund_code', fundCode);
      } else {
        await supabase.from('holdings').update({
          shares: newShares,
          avg_nav: newTotalCost / newShares,
          total_cost: newTotalCost,
        }).eq('fund_code', fundCode);
      }
    }
  }
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

  if (transaction.status === 'completed') {
    await reverseTransactionOnSupabase(transaction.fund_code, transaction.type, transaction.shares, transaction.amount);
  }
}

async function reverseTransactionOnSupabase(
  fundCode: string,
  type: string,
  shares: number,
  amount: number
): Promise<void> {
  const { data: existing } = await supabase
    .from('holdings')
    .select('*')
    .eq('fund_code', fundCode)
    .limit(1)
    .maybeSingle();

  if (!existing) return;

  const newShares = type === 'buy'
    ? existing.shares - shares
    : existing.shares + shares;

  const newTotalCost = type === 'buy'
    ? existing.total_cost - amount
    : existing.total_cost + amount;

  if (newShares <= 0) {
    await supabase.from('holdings').delete().eq('fund_code', fundCode);
  } else {
    await supabase.from('holdings').update({
      shares: newShares,
      avg_nav: newTotalCost / newShares,
      total_cost: newTotalCost,
    }).eq('fund_code', fundCode);
  }
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

      await updateHoldingOnSupabase(transaction.fund_code, transaction.fund_name, transaction.type, shares, amount, tradePrice);

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
