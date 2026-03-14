import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Fund, Holding, Transaction } from '../types';

// ============================================
// 数据同步服务
// ============================================

export interface SyncResult {
  success: boolean;
  message: string;
  details?: any;
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
    await supabase.from('holdings').delete().neq('id', '');

    // 插入新数据
    if (holdings.length > 0) {
      const { error } = await supabase.from('holdings').insert(
        holdings.map(h => ({
          fund_code: h.fund_code,
          fund_name: h.fund_name,
          shares: h.shares,
          avg_nav: h.avg_nav || 0,
          total_cost: h.total_cost || 0,
        }))
      );

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
    await supabase.from('transactions').delete().neq('id', '');

    // 插入新数据
    if (transactions.length > 0) {
      const { error } = await supabase.from('transactions').insert(
        transactions.map(t => ({
          fund_code: t.fund_code,
          fund_name: t.fund_name,
          type: t.type,
          shares: t.shares,
          nav: t.nav || 0,
          amount: t.amount,
          fee: t.fee || 0,
          date: t.date,
          status: t.status || 'completed',
        }))
      );

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

    return {
      holdings: holdingsRes.data || [],
      transactions: transactionsRes.data || [],
    };
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
    const { error } = await supabase.from('holdings').select('count').single();
    return !error;
  } catch {
    return false;
  }
}
