/**
 * @fileoverview Supabase 客户端配置
 * @description 配置 Supabase 客户端，用于数据持久化和实时同步
 * @module lib/supabase
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

// Supabase 配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Supabase 客户端实例
 * @description 用于数据库操作和实时订阅
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

/**
 * 检查 Supabase 是否已配置
 * @returns {boolean} 是否已配置
 */
export const isSupabaseConfigured = (): boolean => {
  return !!supabaseUrl && !!supabaseKey;
};

/**
 * 获取基金净值（通过 Edge Function）
 * @param code - 基金代码
 * @returns 基金净值数据
 */
export async function fetchFundNavFromEdge(code: string) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }

  const { data, error } = await supabase.functions.invoke('fund-nav', {
    body: { code },
  });

  if (error) throw error;
  return data;
}

/**
 * 搜索基金（通过 Edge Function）
 * @param keyword - 搜索关键词
 * @returns 基金列表
 */
export async function searchFundsFromEdge(keyword: string) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }

  const { data, error } = await supabase.functions.invoke('fund-search', {
    body: { keyword },
  });

  if (error) throw error;
  return data;
}

/**
 * 订阅交易数据变化
 * @param callback - 数据变化回调函数
 * @returns 订阅对象
 */
export function subscribeTransactions(callback: (payload: any) => void) {
  return supabase
    .channel('transactions')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'transactions' },
      callback
    )
    .subscribe();
}

/**
 * 订阅持仓数据变化
 * @param callback - 数据变化回调函数
 * @returns 订阅对象
 */
export function subscribeHoldings(callback: (payload: any) => void) {
  return supabase
    .channel('holdings')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'holdings' },
      callback
    )
    .subscribe();
}
