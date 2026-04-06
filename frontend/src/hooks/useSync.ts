/**
 * 数据访问 Hooks
 * 
 * Supabase 为唯一数据源
 * 持仓从交易记录派生，不再依赖 holdings 表
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { removeTransactionWithHoldingUpdate, removeHoldingWithTransactions, deriveLots, summarizeHoldings } from '../services/navUpdateService';
import { batchFetchNav } from '../services/fundApi';
import { fetchFundNav } from '../services/fundApi';
import type { Holding, Transaction } from '../types';
import type { Lot, RealizedLot } from '../services/navUpdateService';
import type { Database } from '../types/database';

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
      await supabase.from('transactions').select('*');
      
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

function mapTransaction(t: any): Transaction {
  return {
    id: t.id,
    fundId: t.fund_code,
    fundCode: t.fund_code,
    fundName: t.fund_name,
    type: t.type,
    date: t.date,
    confirmDate: t.confirm_date || t.date,
    amount: t.amount,
    price: t.nav,
    shares: t.shares,
    fee: t.fee,
    status: t.status,
    createdAt: t.created_at,
  };
}

/**
 * 持仓 Hook
 * 从交易记录派生批次，汇总为基金级持仓，再获取最新净值计算盈亏
 */
export function useHoldings() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHoldings = useCallback(async () => {
    try {
      if (isSupabaseConfigured()) {
        const { data: txData, error } = await supabase.from('transactions').select('*');
        if (!error && txData) {
          const transactions = txData.map(mapTransaction);
          // 从交易派生批次
          const derivedLots = deriveLots(transactions);
          setLots(derivedLots);
          // 汇总为基金级持仓
          const summaries = summarizeHoldings(derivedLots);
          // 获取最新净值，计算市值和盈亏
          const enriched = await enrichHoldingsWithNav(summaries);
          setHoldings(enriched);
          return;
        }
      }
      setHoldings([]);
      setLots([]);
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

  const removeHolding = useCallback(async (id: string) => {
    await removeHoldingWithTransactions(id);
  }, []);

  return { holdings, lots, loading, removeHolding, refresh };
}

/**
 * 交易记录 Hook
 */
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

/**
 * 批量获取持仓的最新净值，实时计算市值和盈亏
 */
async function enrichHoldingsWithNav(summaries: ReturnType<typeof summarizeHoldings>): Promise<Holding[]> {
  if (summaries.length === 0) return [];

  const fundCodes = [...new Set(summaries.map(s => s.fundCode))];
  const navMap = await batchFetchNav(fundCodes);

  return summaries.map(summary => {
    const navInfo = navMap.get(summary.fundCode);
    if (navInfo) {
      const currentValue = navInfo.nav * summary.shares;
      const profit = currentValue - summary.totalCost;
      const profitRate = summary.totalCost > 0 ? profit / summary.totalCost : 0;
      return {
        id: summary.fundCode,
        fundId: summary.fundCode,
        fundCode: summary.fundCode,
        fundName: summary.fundName || navInfo.name || summary.fundCode,
        shares: summary.shares,
        avgCost: summary.avgCost,
        totalCost: summary.totalCost,
        currentNav: navInfo.nav,
        currentValue,
        profit,
        profitRate,
        createdAt: '',
        updatedAt: '',
      };
    }
    return {
      id: summary.fundCode,
      fundId: summary.fundCode,
      fundCode: summary.fundCode,
      fundName: summary.fundName,
      shares: summary.shares,
      avgCost: summary.avgCost,
      totalCost: summary.totalCost,
      currentValue: summary.totalCost,
      profit: 0,
      profitRate: 0,
      createdAt: '',
      updatedAt: '',
    };
  });
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
      // 从 localStorage 加载自定义策略
      const customStrategies = JSON.parse(localStorage.getItem('customStrategies') || '[]');
      setStrategies(customStrategies);
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
