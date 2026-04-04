/**
 * @fileoverview 类型定义 + Supabase 数据操作
 * @description Supabase 为唯一数据源，不再使用 IndexedDB
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ============================================
// 类型定义
// ============================================

export interface FavoriteFund {
  id: string;
  code: string;
  name: string;
  category?: string;
  createdAt: string;
}

export interface FundCacheItem {
  id: string;
  code: string;
  name: string;
  category?: string;
  nav?: number;
  navDate?: string;
  dailyChangeRate?: number;
  accNav?: number;
  pe?: number;
  pb?: number;
  dividendYield?: number;
  source: 'search' | 'import' | 'system';
  isHolding: boolean;
  holdingShares: number;
  searchCount: number;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledTask {
  id?: number;
  name: string;
  type: 'fetch_nav' | 'generate_report' | 'feishu_notify';
  enabled: boolean;
  schedule: string;
  config: any;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeishuConfig {
  id?: number;
  webhookUrl: string;
  secret?: string;
  enabled: boolean;
  notifyOn: {
    dailyReport: boolean;
    weeklyReport: boolean;
    largeFluctuation: boolean;
    transactionAdded: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Supabase 数据操作（替代原 IndexedDB 操作）
// ============================================

export async function resetDatabase(): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const tables = ['holdings', 'transactions', 'favorite_funds', 'fund_cache'];
  for (const table of tables) {
    const { data, error: fetchError } = await supabase.from(table).select('id');
    if (fetchError) {
      console.warn(`获取表 ${table} 数据失败:`, fetchError.message);
      continue;
    }
    if (data && data.length > 0) {
      const ids = data.map((row: any) => row.id);
      const { error: deleteError } = await supabase.from(table).delete().in('id', ids);
      if (deleteError) {
        console.warn(`清空表 ${table} 失败:`, deleteError.message);
      }
    }
  }
}

export async function exportDatabase(): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }

  const [holdings, transactions] = await Promise.all([
    supabase.from('holdings').select('*'),
    supabase.from('transactions').select('*'),
  ]);

  const data = {
    version: '3.0.0',
    exportDate: new Date().toISOString(),
    holdings: holdings.data || [],
    transactions: transactions.data || [],
  };

  return JSON.stringify(data, null, 2);
}

export async function importDatabase(jsonString: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }

  const data = JSON.parse(jsonString);

  if (data.holdings?.length) {
    await supabase.from('holdings').delete().neq('id', '');
    await supabase.from('holdings').insert(data.holdings);
  }
  if (data.transactions?.length) {
    await supabase.from('transactions').delete().neq('id', '');
    await supabase.from('transactions').insert(data.transactions);
  }
}
