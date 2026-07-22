/**
 * @fileoverview 类型定义 + Supabase 数据操作
 * @description Supabase 为唯一数据源，不再使用 IndexedDB
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ============================================
// 类型定义（与实际数据库表结构匹配）
// ============================================

/**
 * 收藏基金（对应 favorite_funds 表）
 */
export interface FavoriteFund {
  id?: string;
  fund_code: string;
  fund_name: string;
  category?: string;
  created_at?: string;
}

// ============================================
// Supabase 数据操作（替代原 IndexedDB 操作）
// ============================================

async function getAllIds(table: string): Promise<string[]> {
  const { data, error } = await supabase.from(table).select('id');
  if (error) throw new Error(`查询 ${table} ID 失败: ${error.message}`);
  return (data || []).map((r: any) => r.id);
}

async function deleteByIds(table: string, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const { error } = await supabase.from(table).delete().in('id', batch);
    if (error) throw new Error(`删除 ${table} 失败: ${error.message}`);
  }
}

export async function resetDatabase(): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const errors: string[] = [];

  try {
    // 1. 断开 FK 循环引用：先获取所有 transactions 和 grid_executions 的 ID
    const txIds = await getAllIds('transactions');
    const geIds = await getAllIds('grid_executions');

    // 逐条清除 FK 引用（按具体 ID 操作，避免 PostgREST 运算符兼容性问题）
    for (const id of txIds) {
      const { error } = await (supabase.from('transactions') as any).update({ grid_execution_id: null }).eq('id', id);
      if (error) errors.push(`解除 transactions(${id}) FK 失败: ${error.message}`);
    }
    for (const id of geIds) {
      const { error } = await (supabase.from('grid_executions') as any).update({ transaction_id: null }).eq('id', id);
      if (error) errors.push(`解除 grid_executions(${id}) FK 失败: ${error.message}`);
    }

    // 2. 按依赖顺序逐表删除
    const tables = ['grid_executions', 'transactions', 'grid_strategies', 'holdings', 'favorite_funds', 'fund_cache', 'fund_search_history'];
    for (const table of tables) {
      const ids = await getAllIds(table);
      if (ids.length > 0) {
        await deleteByIds(table, ids);
      }
    }
  } catch (e) {
    errors.push(`${e instanceof Error ? e.message : String(e)}`);
  }

  if (errors.length > 0) {
    throw new Error(`重置数据失败:\n${errors.join('\n')}`);
  }
}

export async function exportDatabase(): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }

  const [holdings, transactions, gridStrategies, gridExecutions, favoriteFunds] = await Promise.all([
    supabase.from('holdings').select('*'),
    supabase.from('transactions').select('*'),
    supabase.from('grid_strategies').select('*'),
    supabase.from('grid_executions').select('*'),
    supabase.from('favorite_funds').select('*'),
  ]);

  // 修复：任一查询失败则拒绝导出，避免 `|| []` 兜底产生看似有效实则全空的备份（数据丢失）
  const results: Array<[string, { data: unknown; error: { message: string } | null }]> = [
    ['holdings', holdings],
    ['transactions', transactions],
    ['grid_strategies', gridStrategies],
    ['grid_executions', gridExecutions],
    ['favorite_funds', favoriteFunds],
  ];
  for (const [table, res] of results) {
    if (res.error) throw new Error(`导出失败：查询 ${table} 失败: ${res.error.message}`);
  }

  const data = {
    version: '3.0.0',
    exportDate: new Date().toISOString(),
    holdings: holdings.data || [],
    transactions: transactions.data || [],
    grid_strategies: gridStrategies.data || [],
    grid_executions: gridExecutions.data || [],
    favorite_funds: favoriteFunds.data || [],
  };

  return JSON.stringify(data, null, 2);
}

function validateImportData(data: unknown): { holdings: unknown[]; transactions: unknown[] } {
  if (!data || typeof data !== 'object') {
    throw new Error('导入数据格式无效：应为 JSON 对象');
  }
  const obj = data as Record<string, unknown>;
  const holdings = Array.isArray(obj.holdings) ? obj.holdings : [];
  const transactions = Array.isArray(obj.transactions) ? obj.transactions : [];
  if (holdings.length === 0 && transactions.length === 0) {
    throw new Error('导入数据为空');
  }
  if (holdings.length > 10000 || transactions.length > 100000) {
    throw new Error('导入数据量超限');
  }
  return { holdings, transactions };
}

export async function importDatabase(jsonString: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }

  let data: unknown;
  try {
    data = JSON.parse(jsonString, (key) => {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) {
        throw new Error('导入数据包含非法键');
      }
      return undefined;
    });
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error('导入数据不是有效的 JSON');
    }
    throw e;
  }
  const { holdings, transactions } = validateImportData(data);

  const obj = data as Record<string, unknown>;
  const gridStrategies = Array.isArray(obj.grid_strategies) ? obj.grid_strategies : [];
  const gridExecutions = Array.isArray(obj.grid_executions) ? obj.grid_executions : [];
  const favoriteFunds = Array.isArray(obj.favorite_funds) ? obj.favorite_funds : [];

  // 修复 J：先清空旧数据，再插入导入数据。
  // 旧实现「插入后又按导入数据的 id 删除」是逻辑反转，会把刚导入的数据删光（数据丢失）。
  // Supabase JS client 无事务；按依赖顺序操作以尽量保证一致性：
  //   ① 解除 FK 循环引用（transactions.grid_execution_id ↔ grid_executions.transaction_id）
  //   ② 按子→父顺序清空旧数据
  //   ③ 按父→子顺序插入导入数据
  const txIds = await getAllIds('transactions');
  const geIds = await getAllIds('grid_executions');
  for (const id of txIds) {
    const { error: fkErr } = await (supabase.from('transactions') as any).update({ grid_execution_id: null, lot_id: null }).eq('id', id);
    if (fkErr) throw new Error(`清空交易外键失败: ${fkErr.message}`);
  }
  for (const id of geIds) {
    const { error: fkErr } = await (supabase.from('grid_executions') as any).update({ transaction_id: null }).eq('id', id);
    if (fkErr) throw new Error(`清空网格执行外键失败: ${fkErr.message}`);
  }

  // ② 清空旧数据（子表在前）
  const clearOrder = ['grid_executions', 'transactions', 'grid_strategies', 'holdings', 'favorite_funds'];
  for (const table of clearOrder) {
    const ids = await getAllIds(table);
    if (ids.length > 0) await deleteByIds(table, ids);
  }

  // ③ 插入导入数据（父表在前；strategies/buy executions 先于引用它们的记录）
  const insertSteps: Array<{ table: string; rows: unknown[] }> = [
    { table: 'favorite_funds', rows: favoriteFunds },
    { table: 'holdings', rows: holdings },
    { table: 'grid_strategies', rows: gridStrategies },
    { table: 'transactions', rows: transactions },
    { table: 'grid_executions', rows: gridExecutions },
  ];
  const errors: string[] = [];
  for (const step of insertSteps) {
    if (step.rows.length === 0) continue;
    const { error } = await supabase.from(step.table as any).insert(step.rows as any);
    if (error) errors.push(`导入 ${step.table} 失败: ${error.message}`);
  }
  if (errors.length > 0) {
    throw new Error(`导入部分失败:\n${errors.join('\n')}`);
  }
}
