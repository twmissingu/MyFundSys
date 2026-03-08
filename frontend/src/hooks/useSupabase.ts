import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Fund, Holding, Transaction, Strategy } from '../types';

// ============================================
// 认证相关 Hooks (简化版 - 本地密码验证)
// ============================================

// 检查 Supabase 是否配置
export function useSupabaseConfig() {
  return { isConfigured: isSupabaseConfigured() };
}

// 检查是否已登录
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
          // 登录过期，清除状态
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

// 登出
export async function signOut() {
  localStorage.removeItem('myfundsys_auth');
  localStorage.removeItem('myfundsys_auth_time');
  return { error: null };
}

// ============================================
// 基金数据 Hooks
// ============================================

// 获取所有基金
export function useFunds() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchFunds = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('funds')
        .select('*')
        .order('code');

      if (error) throw error;
      
      // 转换数据格式
      const formattedFunds: Fund[] = (data as any[])?.map(f => ({
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
      })) || [];

      setFunds(formattedFunds);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFunds();
  }, [fetchFunds]);

  return { funds, loading, error, refresh: fetchFunds };
}

// ============================================
// 持仓数据 Hooks (带实时订阅)
// ============================================

export function useHoldings() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchHoldings = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('holdings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedHoldings: Holding[] = (data as any[])?.map(h => ({
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
      })) || [];

      setHoldings(formattedHoldings);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHoldings();

    // 订阅实时变化
    const subscription = supabase
      .channel('holdings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'holdings',
        },
        (payload: any) => {
          console.log('Holdings change received:', payload);
          fetchHoldings();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchHoldings]);

  return { holdings, loading, error, refresh: fetchHoldings };
}

// 添加或更新持仓
export async function upsertHolding(holding: Omit<Holding, 'createdAt' | 'updatedAt'>) {
  const payload = {
    id: holding.id,
    fund_id: holding.fundId,
    fund_code: holding.fundCode,
    fund_name: holding.fundName,
    shares: holding.shares,
    avg_cost: holding.avgCost,
    total_cost: holding.totalCost,
    current_nav: holding.currentNav,
    current_value: holding.currentValue,
    profit: holding.profit,
    profit_rate: holding.profitRate,
  };

  const { data, error } = await supabase
    .from('holdings')
    .upsert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 删除持仓
export async function deleteHolding(id: string) {
  const { error } = await supabase
    .from('holdings')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================
// 交易记录 Hooks (带实时订阅)
// ============================================

export function useTransactions(fundCode?: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

      if (fundCode) {
        query = query.eq('fund_code', fundCode);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedTransactions: Transaction[] = (data as any[])?.map(t => ({
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
      })) || [];

      setTransactions(formattedTransactions);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [fundCode]);

  useEffect(() => {
    fetchTransactions();

    // 订阅实时变化
    const subscription = supabase
      .channel('transactions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
        },
        (payload: any) => {
          console.log('Transactions change received:', payload);
          fetchTransactions();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchTransactions]);

  return { transactions, loading, error, refresh: fetchTransactions };
}

// 添加交易记录
export async function addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>) {
  const id = `t_${Date.now()}`;
  
  const payload = {
    id,
    fund_id: transaction.fundId,
    fund_code: transaction.fundCode,
    fund_name: transaction.fundName,
    type: transaction.type,
    date: transaction.date,
    amount: transaction.amount,
    price: transaction.price,
    shares: transaction.shares,
    fee: transaction.fee,
    remark: transaction.remark,
  };
  
  const { data, error } = await supabase
    .from('transactions')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  // 更新持仓
  await updateHoldingAfterTransaction(transaction);

  return data;
}

// 删除交易记录
export async function deleteTransaction(id: string) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// 更新持仓（内部函数）
async function updateHoldingAfterTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>) {
  // 查找现有持仓
  const { data: existingHoldings } = await supabase
    .from('holdings')
    .select('*')
    .eq('fund_code', transaction.fundCode);

  const existingHolding = (existingHoldings as any[])?.[0];

  if (transaction.type === 'buy') {
    if (existingHolding) {
      // 更新现有持仓
      const newTotalCost = Number(existingHolding.total_cost) + transaction.amount;
      const newShares = Number(existingHolding.shares) + transaction.shares;
      
      await supabase
        .from('holdings')
        .update({
          shares: newShares,
          total_cost: newTotalCost,
          avg_cost: newTotalCost / newShares,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingHolding.id);
    } else {
      // 创建新持仓
      const id = `h_${Date.now()}`;
      await supabase
        .from('holdings')
        .insert({
          id,
          fund_id: transaction.fundId,
          fund_code: transaction.fundCode,
          fund_name: transaction.fundName,
          shares: transaction.shares,
          avg_cost: transaction.price,
          total_cost: transaction.amount,
        });
    }
  } else if (transaction.type === 'sell' && existingHolding) {
    const newShares = Number(existingHolding.shares) - transaction.shares;
    
    if (newShares > 0) {
      const costReduction = (transaction.shares / Number(existingHolding.shares)) * Number(existingHolding.total_cost);
      await supabase
        .from('holdings')
        .update({
          shares: newShares,
          total_cost: Number(existingHolding.total_cost) - costReduction,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingHolding.id);
    } else {
      // 清仓，删除持仓
      await supabase
        .from('holdings')
        .delete()
        .eq('id', existingHolding.id);
    }
  }
}

// ============================================
// 策略数据 Hooks
// ============================================

export function useStrategies() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStrategies = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .order('name');

      if (error) throw error;

      const formattedStrategies: Strategy[] = (data as any[])?.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description || '',
        type: s.type as 'valuation' | 'trend' | 'grid' | 'custom',
        rules: (s.rules as any[])?.map(r => ({
          condition: r.condition,
          action: r.action,
          params: r.params,
        })) || [],
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      })) || [];

      setStrategies(formattedStrategies);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategies();
  }, []);

  return { strategies, loading, error, refresh: fetchStrategies };
}
