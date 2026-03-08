/**
 * 同步相关的 Hooks
 * 
 * 提供离线优先的数据访问能力：
 * - 自动处理网络状态变化
 * - 本地数据优先，后台同步到云端
 * - 同步状态可视化
 */

import { useEffect, useState, useCallback } from 'react';
import { db } from '../db';
import { 
  getSyncStatus, 
  subscribeToSyncStatus, 
  initNetworkListener,
  getFunds,
  getHoldings,
  getTransactions,
  saveHolding,
  removeHolding,
  saveTransaction,
  removeTransaction,
  syncToCloud,
  forceFullSync,
  subscribeToCloudChanges,
} from '../services/syncService';
import type { Fund, Holding, Transaction, Strategy } from '../types';

// ============================================
// 同步状态 Hook
// ============================================

export function useSyncStatus() {
  const [status, setStatus] = useState(getSyncStatus());

  useEffect(() => {
    // 初始化网络监听
    const cleanup = initNetworkListener();
    
    // 订阅状态变化
    const unsubscribe = subscribeToSyncStatus(setStatus);

    return () => {
      cleanup();
      unsubscribe();
    };
  }, []);

  const triggerSync = useCallback(async () => {
    await syncToCloud();
  }, []);

  const triggerFullSync = useCallback(async () => {
    await forceFullSync();
  }, []);

  return {
    ...status,
    triggerSync,
    triggerFullSync,
  };
}

// ============================================
// 基金数据 Hook
// ============================================

export function useFunds() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getFunds();
      setFunds(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { funds, loading, error, refresh };
}

// ============================================
// 持仓数据 Hook
// ============================================

export function useHoldings() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getHoldings();
      setHoldings(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    // 监听云端变化
    const unsubscribe = subscribeToCloudChanges(() => {
      console.log('[useHoldings] 检测到云端变化，刷新数据');
      refresh();
    });

    return () => unsubscribe();
  }, [refresh]);

  const addHolding = useCallback(async (holding: Omit<Holding, 'createdAt' | 'updatedAt'>) => {
    await saveHolding(holding);
    await refresh();
  }, [refresh]);

  const deleteHolding = useCallback(async (id: string) => {
    await removeHolding(id);
    await refresh();
  }, [refresh]);

  return { 
    holdings, 
    loading, 
    error, 
    refresh,
    addHolding,
    deleteHolding,
  };
}

// 导出单独的函数供直接使用
export { saveHolding as addHolding, removeHolding as deleteHolding };

// ============================================
// 交易记录 Hook
// ============================================

export function useTransactions(fundCode?: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getTransactions(fundCode);
      setTransactions(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [fundCode]);

  useEffect(() => {
    refresh();

    // 监听云端变化
    const unsubscribe = subscribeToCloudChanges(() => {
      console.log('[useTransactions] 检测到云端变化，刷新数据');
      refresh();
    });

    return () => unsubscribe();
  }, [refresh]);

  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id' | 'createdAt'>) => {
    await saveTransaction(transaction);
    await refresh();
  }, [refresh]);

  const deleteTransaction = useCallback(async (id: string) => {
    await removeTransaction(id);
    await refresh();
  }, [refresh]);

  return { 
    transactions, 
    loading, 
    error, 
    refresh,
    addTransaction,
    deleteTransaction,
  };
}

// 导出单独的函数供直接使用
export { saveTransaction as addTransaction, removeTransaction as deleteTransaction };

// ============================================
// 策略数据 Hook
// ============================================

export function useStrategies() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await db.strategies.toArray();
      setStrategies(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { strategies, loading, error, refresh };
}

// ============================================
// 认证状态 Hook（简化版）
// ============================================

export function useAuthStatus() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const auth = localStorage.getItem('myfundsys_auth');
      const authTime = localStorage.getItem('myfundsys_auth_time');
      
      if (auth === 'true' && authTime) {
        // 检查登录是否过期（30天）
        const elapsed = Date.now() - parseInt(authTime);
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        
        if (elapsed < thirtyDays) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('myfundsys_auth');
          localStorage.removeItem('myfundsys_auth_time');
          setIsAuthenticated(false);
        }
      }
      setLoading(false);
    };
    
    checkAuth();
  }, []);

  return { isAuthenticated, loading };
}

// ============================================
// 登出函数
// ============================================

export async function signOut() {
  localStorage.removeItem('myfundsys_auth');
  localStorage.removeItem('myfundsys_auth_time');
  return { error: null };
}
