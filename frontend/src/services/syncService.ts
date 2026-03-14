import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Holding, Transaction } from '../types';
import type { Database } from '../types/database';

// 类型别名
type HoldingsInsert = Database['public']['Tables']['holdings']['Insert'];
type TransactionsInsert = Database['public']['Tables']['transactions']['Insert'];

// ============================================
// 数据同步服务
// ============================================

export interface SyncResult {
  success: boolean;
  message: string;
  details?: any;
}

// 数据库持仓类型
interface DbHolding {
  id: string;
  fund_code: string;
  fund_name: string;
  shares: number;
  avg_nav: number;
  total_cost: number;
  current_nav?: number;
  market_value?: number;
  profit?: number;
  profit_rate?: number;
  created_at: string;
  updated_at: string;
}

// 数据库交易类型
interface DbTransaction {
  id: string;
  fund_code: string;
  fund_name: string;
  type: 'buy' | 'sell';
  shares: number;
  nav: number;
  amount: number;
  fee: number;
  date: string;
  status: 'pending' | 'completed';
  created_at: string;
  updated_at: string;
}

/**
 * 将前端 Holding 转换为数据库格式
 */
function toDbHolding(holding: Holding): HoldingsInsert {
  return {
    fund_code: holding.fundCode,
    fund_name: holding.fundName,
    shares: holding.shares,
    avg_nav: holding.avgCost,
    total_cost: holding.totalCost,
  };
}

/**
 * 将数据库 Holding 转换为前端格式
 */
function fromDbHolding(db: DbHolding): Holding {
  return {
    id: db.id,
    fundId: '', // 需要从 fund_code 查询
    fundCode: db.fund_code,
    fundName: db.fund_name,
    shares: db.shares,
    avgCost: db.avg_nav,
    totalCost: db.total_cost,
    currentNav: db.current_nav,
    currentValue: db.market_value,
    profit: db.profit,
    profitRate: db.profit_rate,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

/**
 * 将前端 Transaction 转换为数据库格式
 */
function toDbTransaction(tx: Transaction): TransactionsInsert {
  return {
    fund_code: tx.fundCode,
    fund_name: tx.fundName,
    type: tx.type,
    shares: tx.shares,
    nav: tx.price,
    amount: tx.amount,
    fee: tx.fee || 0,
    date: tx.date,
    status: tx.status || 'completed',
  };
}

/**
 * 将数据库 Transaction 转换为前端格式
 */
function fromDbTransaction(db: DbTransaction): Transaction {
  return {
    id: db.id,
    fundId: '', // 需要从 fund_code 查询
    fundCode: db.fund_code,
    fundName: db.fund_name,
    type: db.type,
    date: db.date,
    confirmDate: db.date,
    amount: db.amount,
    price: db.nav,
    shares: db.shares,
    fee: db.fee,
    status: db.status,
    createdAt: db.created_at,
  };
}

/**
 * 同步持仓数据到 Supabase
 */
export async function syncHoldingsToSupabase(holdings: Holding[]): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase 未配置' };
  }

  try {
    // 清空现有数据
    await supabase.from('holdings').delete().neq('id', '0');

    // 插入新数据
    if (holdings.length > 0) {
      const dbHoldings: HoldingsInsert[] = holdings.map(toDbHolding);
      const { error } = await supabase.from('holdings').insert(dbHoldings as any);

      if (error) throw error;
    }

    return { success: true, message: `同步了 ${holdings.length} 条持仓数据` };
  } catch (error) {
    return { success: false, message: '同步失败', details: error };
  }
}

/**
 * 同步交易记录到 Supabase
 */
export async function syncTransactionsToSupabase(transactions: Transaction[]): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase 未配置' };
  }

  try {
    // 清空现有数据
    await supabase.from('transactions').delete().neq('id', '0');

    // 插入新数据
    if (transactions.length > 0) {
      const dbTransactions: TransactionsInsert[] = transactions.map(toDbTransaction);
      const { error } = await supabase.from('transactions').insert(dbTransactions as any);

      if (error) throw error;
    }

    return { success: true, message: `同步了 ${transactions.length} 条交易记录` };
  } catch (error) {
    return { success: false, message: '同步失败', details: error };
  }
}

/**
 * 从 Supabase 获取所有数据
 */
export async function fetchAllDataFromSupabase() {
  if (!isSupabaseConfigured()) {
    return { holdings: [], transactions: [] };
  }

  try {
    const [holdingsRes, transactionsRes] = await Promise.all([
      supabase.from('holdings').select('*'),
      supabase.from('transactions').select('*'),
    ]);

    const holdings = (holdingsRes.data as DbHolding[] || []).map(fromDbHolding);
    const transactions = (transactionsRes.data as DbTransaction[] || []).map(fromDbTransaction);

    return { holdings, transactions };
  } catch (error) {
    console.error('获取数据失败:', error);
    return { holdings: [], transactions: [] };
  }
}

/**
 * 检查 Supabase 连接状态
 */
export async function checkSupabaseConnection(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const { error } = await supabase.from('holdings').select('count', { count: 'exact', head: true });
    return !error;
  } catch {
    return false;
  }
}
