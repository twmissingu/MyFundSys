/**
 * 同步相关的 Hooks (简化版)
 * 
 * 使用 Supabase 作为数据源
 */

import { useEffect, useState, useCallback } from 'react';
import { db } from '../db';
import { 
  syncHoldingsToSupabase,
  syncTransactionsToSupabase,
  fetchAllDataFromSupabase,
  checkSupabaseConnection,
} from '../services/syncService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Fund, Holding, Transaction, Strategy } from '../types';
import type { Database } from '../types/database';

// 类型别名
type HoldingsInsert = Database['public']['Tables']['holdings']['Insert'];
type TransactionsInsert = Database['public']['Tables']['transactions']['Insert'];

// ============================================
// 同步状态 Hook
// ============================================

export interface SyncStatus {
  isOnline: boolean;
  isConfigured: boolean;
  lastSync: Date | null;
  pendingChanges: number;
}

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isConfigured: isSupabaseConfigured(),
    lastSync: null,
    pendingChanges: 0,
  });

  useEffect(() => {
    const handleOnline = () => setStatus(s => ({ ...s, isOnline: true }));
    const handleOffline = () => setStatus(s => ({ ...s, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const triggerSync = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    
    try {
      // 从本地数据库获取数据并同步到 Supabase
      const holdings = await db.holdings.toArray();
      const transactions = await db.transactions.toArray();
      
      await Promise.all([
        syncHoldingsToSupabase(holdings),
        syncTransactionsToSupabase(transactions),
      ]);
      
      setStatus(s => ({ ...s, lastSync: new Date() }));
    } catch (error) {
      console.error('同步失败:', error);
    }
  }, []);

  return { status, triggerSync };
}

// ============================================
// 数据访问 Hooks
// ============================================

export function useFunds() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFunds = async () => {
      try {
        const data = await db.fundCache.toArray();
        setFunds(data.map(f => ({
          id: f.id,
          code: f.code,
          name: f.name,
          category: f.category || '',
          nav: f.nav,
          navDate: f.navDate,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        })));
      } finally {
        setLoading(false);
      }
    };
    loadFunds();
  }, []);

  return { funds, loading };
}

export function useHoldings() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHoldings = async () => {
      try {
        if (isSupabaseConfigured()) {
          // 从 Supabase 获取
          const { data, error } = await supabase.from('holdings').select('*');
          if (!error && data) {
            setHoldings(data.map((h: any) => ({
              id: h.id,
              fundId: h.fund_code,
              fundCode: h.fund_code,
              fundName: h.fund_name,
              shares: h.shares,
              avgCost: h.avg_nav,
              totalCost: h.total_cost,
              currentNav: h.current_nav,
              currentValue: h.market_value,
              profit: h.profit,
              profitRate: h.profit_rate,
              createdAt: h.created_at,
              updatedAt: h.updated_at,
            })));
            return;
          }
        }
        
        // 降级：从本地数据库获取
        const data = await db.holdings.toArray();
        setHoldings(data);
      } finally {
        setLoading(false);
      }
    };
    loadHoldings();
  }, []);

  const saveHolding = useCallback(async (holding: Omit<Holding, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = await db.holdings.add({
      ...holding,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Holding);
    
    // 同步到 Supabase
    if (isSupabaseConfigured()) {
      const payload: HoldingsInsert = {
        fund_code: holding.fundCode,
        fund_name: holding.fundName,
        shares: holding.shares,
        avg_nav: holding.avgCost,
        total_cost: holding.totalCost,
      };
      await supabase.from('holdings').insert([payload]);
    }
    
    return id;
  }, []);

  const removeHolding = useCallback(async (id: string) => {
    await db.holdings.delete(id);
    
    if (isSupabaseConfigured()) {
      await supabase.from('holdings').delete().eq('id', id);
    }
  }, []);

  return { holdings, loading, saveHolding, removeHolding };
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTransactions = async () => {
      try {
        if (isSupabaseConfigured()) {
          // 从 Supabase 获取
          const { data, error } = await supabase.from('transactions').select('*');
          if (!error && data) {
            setTransactions(data.map((t: any) => ({
              id: t.id,
              fundId: t.fund_code,
              fundCode: t.fund_code,
              fundName: t.fund_name,
              type: t.type,
              date: t.date,
              confirmDate: t.date,
              amount: t.amount,
              price: t.nav,
              shares: t.shares,
              fee: t.fee,
              status: t.status,
              createdAt: t.created_at,
            })));
            return;
          }
        }
        
        // 降级：从本地数据库获取
        const data = await db.transactions.toArray();
        setTransactions(data);
      } finally {
        setLoading(false);
      }
    };
    loadTransactions();
  }, []);

  const saveTransaction = useCallback(async (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
    const id = await db.transactions.add({
      ...transaction,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    } as Transaction);
    
    // 同步到 Supabase
    if (isSupabaseConfigured()) {
      const payload: TransactionsInsert = {
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
      await supabase.from('transactions').insert([payload]);
    }
    
    return id;
  }, []);

  const removeTransaction = useCallback(async (id: string) => {
    await db.transactions.delete(id);
    
    if (isSupabaseConfigured()) {
      await supabase.from('transactions').delete().eq('id', id);
    }
  }, []);

  return { transactions, loading, saveTransaction, removeTransaction };
}

// ============================================
// 工具函数
// ============================================

export function updateLocalHoldingAfterTransaction(
  holding: Holding | undefined,
  transaction: Transaction
): Holding {
  if (!holding) {
    // 新建持仓
    return {
      id: crypto.randomUUID(),
      fundId: transaction.fundId,
      fundCode: transaction.fundCode,
      fundName: transaction.fundName,
      shares: transaction.shares,
      avgCost: transaction.price,
      totalCost: transaction.amount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // 更新现有持仓
  const newShares = transaction.type === 'buy'
    ? holding.shares + transaction.shares
    : holding.shares - transaction.shares;

  const newTotalCost = transaction.type === 'buy'
    ? holding.totalCost + transaction.amount
    : holding.totalCost - transaction.amount;

  return {
    ...holding,
    shares: newShares,
    totalCost: newTotalCost,
    avgCost: newShares > 0 ? newTotalCost / newShares : 0,
    updatedAt: new Date().toISOString(),
  };
}
