/**
 * 数据同步服务
 * 
 * 架构：离线优先 (Offline-First)
 * - 所有读写操作先在 IndexedDB 完成
 - 网络可用时自动同步到 Supabase
 * - 支持多端数据冲突解决
 */

import { db } from '../db';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Fund, Holding, Transaction } from '../types';

// ============================================
// 同步状态管理
// ============================================

interface SyncStatus {
  lastSyncTime: number | null;
  isSyncing: boolean;
  pendingChanges: number;
  isOnline: boolean;
}

let syncStatus: SyncStatus = {
  lastSyncTime: null,
  isSyncing: false,
  pendingChanges: 0,
  isOnline: navigator.onLine,
};

const statusListeners: Set<(status: SyncStatus) => void> = new Set();

export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

export function subscribeToSyncStatus(callback: (status: SyncStatus) => void) {
  statusListeners.add(callback);
  callback(syncStatus);
  return () => statusListeners.delete(callback);
}

function updateSyncStatus(updates: Partial<SyncStatus>) {
  syncStatus = { ...syncStatus, ...updates };
  statusListeners.forEach(cb => cb(syncStatus));
}

// ============================================
// 网络状态检测
// ============================================

export function initNetworkListener() {
  const handleOnline = () => {
    updateSyncStatus({ isOnline: true });
    // 恢复网络时自动同步
    setTimeout(() => syncToCloud(), 1000);
  };

  const handleOffline = () => {
    updateSyncStatus({ isOnline: false });
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

// ============================================
// 基金数据操作（只读，从云端同步到本地）
// ============================================

export async function syncFundsFromCloud(): Promise<boolean> {
  if (!isSupabaseConfigured() || !navigator.onLine) return false;

  try {
    const { data, error } = await supabase
      .from('funds')
      .select('*')
      .order('code');

    if (error) throw error;

    if (data) {
      const funds: Fund[] = data.map((f: any) => ({
        id: f.id,
        code: f.code,
        name: f.name,
        category: f.category,
        nav: f.nav ?? undefined,
        navDate: f.nav_date ?? undefined,
        pe: f.pe ?? undefined,
        pb: f.pb ?? undefined,
        dividendYield: f.dividend_yield ?? undefined,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
      }));

      // 保存到 IndexedDB
      await db.funds.clear();
      await db.funds.bulkAdd(funds);
      
      return true;
    }
  } catch (error) {
    console.error('Sync funds failed:', error);
  }

  return false;
}

// 从本地获取基金列表（优先本地，自动同步）
export async function getFunds(): Promise<Fund[]> {
  // 先尝试从云端同步
  if (navigator.onLine && isSupabaseConfigured()) {
    await syncFundsFromCloud();
  }
  
  // 从本地返回
  return db.funds.toArray();
}

// ============================================
// 持仓数据操作（读写同步）
// ============================================

// 添加或更新持仓
export async function saveHolding(holding: Omit<Holding, 'createdAt' | 'updatedAt'>) {
  const now = new Date().toISOString();
  const holdingWithTime = {
    ...holding,
    updatedAt: now,
  };

  // 1. 先保存到本地
  await db.holdings.put(holdingWithTime as Holding);
  
  // 2. 记录待同步
  await db.syncQueue.add({
    table: 'holdings',
    action: holding.id ? 'update' : 'insert',
    data: holdingWithTime,
    synced: 0,
    createdAt: now,
  });

  updateSyncStatus({ pendingChanges: syncStatus.pendingChanges + 1 });

  // 3. 尝试同步到云端
  if (navigator.onLine && isSupabaseConfigured()) {
    await syncToCloud();
  }

  return holdingWithTime;
}

// 删除持仓
export async function removeHolding(id: string) {
  // 1. 从本地删除
  await db.holdings.delete(id);
  
  // 2. 记录待同步
  await db.syncQueue.add({
    table: 'holdings',
    action: 'delete',
    data: { id },
    synced: 0,
    createdAt: new Date().toISOString(),
  });

  updateSyncStatus({ pendingChanges: syncStatus.pendingChanges + 1 });

  // 3. 尝试同步到云端
  if (navigator.onLine && isSupabaseConfigured()) {
    await syncToCloud();
  }
}

// 获取持仓列表（优先本地）
export async function getHoldings(): Promise<Holding[]> {
  return db.holdings.toArray();
}

// ============================================
// 交易记录操作（读写同步）
// ============================================

export async function saveTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>) {
  const now = new Date().toISOString();
  const id = `t_${Date.now()}`;
  
  const transactionWithId = {
    ...transaction,
    id,
    createdAt: now,
  };

  // 1. 保存到本地
  await db.transactions.add(transactionWithId as Transaction);
  
  // 2. 记录待同步
  await db.syncQueue.add({
    table: 'transactions',
    action: 'insert',
    data: transactionWithId,
    synced: 0,
    createdAt: now,
  });

  updateSyncStatus({ pendingChanges: syncStatus.pendingChanges + 1 });

  // 3. 更新本地持仓
  await updateLocalHoldingAfterTransaction(transaction);

  // 4. 尝试同步到云端
  if (navigator.onLine && isSupabaseConfigured()) {
    await syncToCloud();
  }

  return transactionWithId;
}

export async function removeTransaction(id: string) {
  // 1. 从本地删除
  await db.transactions.delete(id);
  
  // 2. 记录待同步
  await db.syncQueue.add({
    table: 'transactions',
    action: 'delete',
    data: { id },
    synced: 0,
    createdAt: new Date().toISOString(),
  });

  updateSyncStatus({ pendingChanges: syncStatus.pendingChanges + 1 });

  // 3. 重新计算持仓
  await recalculateLocalHoldings();

  // 4. 尝试同步到云端
  if (navigator.onLine && isSupabaseConfigured()) {
    await syncToCloud();
  }
}

export async function getTransactions(fundCode?: string): Promise<Transaction[]> {
  if (fundCode) {
    return db.transactions.where('fundCode').equals(fundCode).reverse().sortBy('date');
  }
  return db.transactions.orderBy('date').reverse().toArray();
}

// ============================================
// 本地持仓计算
// ============================================

export async function updateLocalHoldingAfterTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>) {
  const existing = await db.holdings.where('fundCode').equals(transaction.fundCode).first();

  if (transaction.type === 'buy') {
    if (existing) {
      const newTotalCost = existing.totalCost + transaction.amount;
      const newShares = existing.shares + transaction.shares;
      
      await db.holdings.update(existing.id, {
        shares: newShares,
        avgCost: newTotalCost / newShares,
        totalCost: newTotalCost,
        updatedAt: new Date().toISOString(),
      });
    } else {
      const id = `h_${Date.now()}`;
      await db.holdings.add({
        id,
        fundId: transaction.fundId,
        fundCode: transaction.fundCode,
        fundName: transaction.fundName,
        shares: transaction.shares,
        avgCost: transaction.price,
        totalCost: transaction.amount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  } else if (transaction.type === 'sell' && existing) {
    const newShares = existing.shares - transaction.shares;
    
    if (newShares > 0) {
      const costReduction = (transaction.shares / existing.shares) * existing.totalCost;
      await db.holdings.update(existing.id, {
        shares: newShares,
        totalCost: existing.totalCost - costReduction,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await db.holdings.delete(existing.id);
    }
  }
}

async function recalculateLocalHoldings() {
  const transactions = await db.transactions.orderBy('date').toArray();
  
  // 清空持仓
  await db.holdings.clear();
  
  // 重新计算
  for (const tx of transactions) {
    await updateLocalHoldingAfterTransaction(tx);
  }
}

// ============================================
// 云端同步逻辑
// ============================================

export async function syncToCloud(): Promise<boolean> {
  if (!isSupabaseConfigured() || !navigator.onLine || syncStatus.isSyncing) {
    return false;
  }

  updateSyncStatus({ isSyncing: true });

  try {
    // 获取待同步队列
    const pendingItems = await db.syncQueue.where('synced').equals(0).toArray();
    
    if (pendingItems.length === 0) {
      // 没有待同步项，尝试从云端拉取更新
      await pullFromCloud();
      updateSyncStatus({ 
        isSyncing: false, 
        lastSyncTime: Date.now(),
        pendingChanges: 0,
      });
      return true;
    }

    // 按顺序处理同步队列
    for (const item of pendingItems) {
      try {
        if (item.table === 'holdings') {
          await syncHoldingToCloud(item.data, item.action as 'insert' | 'update' | 'delete');
        } else if (item.table === 'transactions') {
          await syncTransactionToCloud(item.data, item.action as 'insert' | 'delete');
        }
        
        // 标记为已同步
        await db.syncQueue.update(item.id!, { synced: 1 });
      } catch (error) {
        console.error(`Sync failed for ${item.table}:`, error);
        // 继续处理其他项
      }
    }

    // 清理已同步的记录
    await db.syncQueue.where('synced').equals(1).delete();

    // 从云端拉取最新数据
    await pullFromCloud();

    updateSyncStatus({ 
      isSyncing: false, 
      lastSyncTime: Date.now(),
      pendingChanges: 0,
    });

    return true;
  } catch (error) {
    console.error('Sync to cloud failed:', error);
    updateSyncStatus({ isSyncing: false });
    return false;
  }
}

async function syncHoldingToCloud(data: any, action: string) {
  if (action === 'delete') {
    await supabase.from('holdings').delete().eq('id', data.id);
  } else {
    const payload = {
      id: data.id,
      fund_id: data.fundId,
      fund_code: data.fundCode,
      fund_name: data.fundName,
      shares: data.shares,
      avg_cost: data.avgCost,
      total_cost: data.totalCost,
      current_nav: data.currentNav,
      current_value: data.currentValue,
      profit: data.profit,
      profit_rate: data.profitRate,
    };

    await supabase.from('holdings').upsert(payload);
  }
}

async function syncTransactionToCloud(data: any, action: string) {
  if (action === 'delete') {
    await supabase.from('transactions').delete().eq('id', data.id);
  } else {
    const payload = {
      id: data.id,
      fund_id: data.fundId,
      fund_code: data.fundCode,
      fund_name: data.fundName,
      type: data.type,
      date: data.date,
      amount: data.amount,
      price: data.price,
      shares: data.shares,
      fee: data.fee,
      remark: data.remark,
    };

    await supabase.from('transactions').insert(payload);
  }
}

async function pullFromCloud() {
  try {
    // 拉取持仓
    const { data: holdingsData } = await supabase
      .from('holdings')
      .select('*');

    if (holdingsData) {
      const holdings: Holding[] = holdingsData.map((h: any) => ({
        id: h.id,
        fundId: h.fund_id,
        fundCode: h.fund_code,
        fundName: h.fund_name,
        shares: Number(h.shares),
        avgCost: Number(h.avg_cost),
        totalCost: Number(h.total_cost),
        currentNav: h.current_nav ?? undefined,
        currentValue: h.current_value ?? undefined,
        profit: h.profit ?? undefined,
        profitRate: h.profit_rate ?? undefined,
        createdAt: h.created_at,
        updatedAt: h.updated_at,
      }));

      await db.holdings.clear();
      await db.holdings.bulkAdd(holdings);
    }

    // 拉取交易记录
    const { data: transactionsData } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });

    if (transactionsData) {
      const transactions: Transaction[] = transactionsData.map((t: any) => ({
        id: t.id,
        fundId: t.fund_id,
        fundCode: t.fund_code,
        fundName: t.fund_name,
        type: t.type as 'buy' | 'sell',
        date: t.date,
        amount: Number(t.amount),
        price: Number(t.price),
        shares: Number(t.shares),
        fee: t.fee ?? undefined,
        remark: t.remark ?? undefined,
        createdAt: t.created_at,
      }));

      await db.transactions.clear();
      await db.transactions.bulkAdd(transactions);
    }
  } catch (error) {
    console.error('Pull from cloud failed:', error);
  }
}

// ============================================
// 强制完全同步（手动触发）
// ============================================

export async function forceFullSync(): Promise<boolean> {
  // 清除同步队列
  await db.syncQueue.clear();
  
  // 重新上传所有本地数据
  const holdings = await db.holdings.toArray();
  const transactions = await db.transactions.toArray();

  for (const h of holdings) {
    await db.syncQueue.add({
      table: 'holdings',
      action: 'insert',
      data: h,
      synced: 0,
      createdAt: new Date().toISOString(),
    });
  }

  for (const t of transactions) {
    await db.syncQueue.add({
      table: 'transactions',
      action: 'insert',
      data: t,
      synced: 0,
      createdAt: new Date().toISOString(),
    });
  }

  updateSyncStatus({ pendingChanges: holdings.length + transactions.length });

  return syncToCloud();
}

// ============================================
// 实时订阅（可选）
// ============================================

export function subscribeToCloudChanges(callback: () => void) {
  if (!isSupabaseConfigured()) return () => {};

  const subscription = supabase
    .channel('db_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'holdings' }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, callback)
    .subscribe();

  return () => subscription.unsubscribe();
}
