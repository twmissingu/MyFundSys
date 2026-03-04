import { useEffect, useState, useCallback } from 'react';
import { supabase, getCurrentUser, isSupabaseConfigured } from '../lib/supabase';
import type { Fund, Holding, Transaction, Strategy } from '../types';
import type { User } from '@supabase/supabase-js';

// ============================================
// 认证相关 Hooks
// ============================================

// 检查 Supabase 是否配置
export function useSupabaseConfig() {
  return { isConfigured: isSupabaseConfigured() };
}

// 获取当前用户
export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setLoading(false);
    };
    getUser();

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}

// 登录
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

// 注册
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { data, error };
}

// 登出
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

// 密码重置
export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/MyFundSys/reset-password`,
  });
  return { error };
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const payload = {
    id: holding.id,
    user_id: user.id,
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const id = `t_${Date.now()}`;
  
  const payload = {
    id,
    user_id: user.id,
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // 查找现有持仓
  const { data: existingHoldings } = await supabase
    .from('holdings')
    .select('*')
    .eq('fund_code', transaction.fundCode)
    .eq('user_id', user.id);

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
          user_id: user.id,
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

  useEffect(() => {
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

    fetchStrategies();
  }, []);

  return { strategies, loading, error };
}
