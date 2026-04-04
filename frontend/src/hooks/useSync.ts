/**
 * 数据访问 Hooks
 * 
 * Supabase 为唯一数据源
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { removeTransactionWithHoldingUpdate, removeHoldingWithTransactions } from '../services/navUpdateService';
import type { Holding, Transaction } from '../types';
import type { Database } from '../types/database';

type HoldingsInsert = Database['public']['Tables']['holdings']['Insert'];
type TransactionsInsert = Database['public']['Tables']['transactions']['Insert'];

// ============================================
// 同步状态 Hook
// ============================================

export interface SyncStatus {
  isOnline: boolean;
  isConfigured: boolean;
  isSyncing: boolean;
  lastSync: Date | null;
  lastSyncTime: Date | null;
  pendingChanges: number;
}

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isConfigured: isSupabaseConfigured(),
    isSyncing: false,
    lastSync: null,
    lastSyncTime: null,
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
    
    setStatus(s => ({ ...s, isSyncing: true }));
    
    try {
      await Promise.all([
        supabase.from('holdings').select('*'),
        supabase.from('transactions').select('*'),
      ]);
      
      setStatus(s => ({ 
        ...s, 
        isSyncing: false,
        lastSync: new Date(),
        lastSyncTime: new Date(),
        pendingChanges: 0,
      }));
    } catch (error) {
      console.error('同步失败:', error);
      setStatus(s => ({ ...s, isSyncing: false }));
    }
  }, []);

  return { status, triggerSync };
}

// ============================================
// 数据访问 Hooks
// ============================================

function mapHolding(h: any): Holding {
  return {
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
  };
}

function mapTransaction(t: any): Transaction {
  return {
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
  };
}

export function useHoldings() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHoldings = useCallback(async () => {
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.from('holdings').select('*');
        if (!error && data) {
          setHoldings(data.map(mapHolding));
          return;
        }
      }
      setHoldings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHoldings();
  }, [loadHoldings]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadHoldings();
  }, [loadHoldings]);

  const saveHolding = useCallback(async (holding: Omit<Holding, 'id' | 'createdAt' | 'updatedAt'>) => {
    const payload: HoldingsInsert = {
      fund_code: holding.fundCode,
      fund_name: holding.fundName,
      shares: holding.shares,
      avg_nav: holding.avgCost,
      total_cost: holding.totalCost,
    };
    const { data } = await (supabase.from('holdings').insert as any)(payload).select();
    return data?.[0]?.id;
  }, []);

  const removeHolding = useCallback(async (id: string) => {
    await removeHoldingWithTransactions(id);
  }, []);

  return { holdings, loading, saveHolding, removeHolding, refresh };
}

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTransactions = useCallback(async () => {
    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.from('transactions').select('*');
        if (!error && data) {
          setTransactions(data.map(mapTransaction));
          return;
        }
      }
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadTransactions();
  }, [loadTransactions]);

  const saveTransaction = useCallback(async (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
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
    const { data } = await supabase.from('transactions').insert(payload as any).select();
    return data?.[0]?.id;
  }, []);

  const removeTransaction = useCallback(async (id: string) => {
    await removeTransactionWithHoldingUpdate(id);
  }, []);

  return { transactions, loading, saveTransaction, removeTransaction, refresh };
}

// ============================================
// 策略 Hooks
// ============================================

export function useStrategies() {
  const [strategies, setStrategies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStrategies = useCallback(async () => {
    setLoading(true);
    try {
      setStrategies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  const refresh = useCallback(async () => {
    await loadStrategies();
  }, [loadStrategies]);

  return { strategies, loading, refresh };
}
