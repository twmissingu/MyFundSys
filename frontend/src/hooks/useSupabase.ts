import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Holding, Transaction } from '../types';

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
  window.location.href = '/login';
}

// 验证密码
export function verifyPassword(password: string): boolean {
  const correctPassword = import.meta.env.VITE_APP_PASSWORD;
  return password === correctPassword;
}

// 设置登录状态
export function setAuthenticated() {
  localStorage.setItem('myfundsys_auth', 'true');
  localStorage.setItem('myfundsys_auth_time', Date.now().toString());
}

// ============================================
// 数据同步 Hooks
// ============================================

// 使用 Supabase 获取持仓数据
export function useSupabaseHoldings() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const fetchHoldings = async () => {
      try {
        const { data, error } = await supabase
          .from('holdings')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        // 转换数据库格式为前端格式
        const formattedHoldings: Holding[] = (data || []).map((item: any) => ({
          id: item.id,
          fundId: item.fund_code,
          fundCode: item.fund_code,
          fundName: item.fund_name,
          shares: item.shares,
          avgCost: item.avg_nav,
          totalCost: item.total_cost,
          currentNav: item.current_nav,
          currentValue: item.market_value,
          profit: item.profit,
          profitRate: item.profit_rate,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        }));
        
        setHoldings(formattedHoldings);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchHoldings();
  }, []);

  return { holdings, loading, error };
}

// 使用 Supabase 获取交易记录
export function useSupabaseTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const fetchTransactions = async () => {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .order('date', { ascending: false });

        if (error) throw error;
        
        // 转换数据库格式为前端格式
        const formattedTransactions: Transaction[] = (data || []).map((item: any) => ({
          id: item.id,
          fundId: item.fund_code,
          fundCode: item.fund_code,
          fundName: item.fund_name,
          type: item.type,
          date: item.date,
          confirmDate: item.date,
          amount: item.amount,
          price: item.nav,
          shares: item.shares,
          fee: item.fee,
          status: item.status,
          createdAt: item.created_at,
        }));
        
        setTransactions(formattedTransactions);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  return { transactions, loading, error };
}

// 添加持仓
export async function addHolding(holding: Omit<Holding, 'id' | 'createdAt' | 'updatedAt'>) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }

  const payload = {
    fund_code: holding.fundCode,
    fund_name: holding.fundName,
    shares: holding.shares,
    avg_nav: holding.avgCost,
    total_cost: holding.totalCost,
  };

  const { data, error } = await supabase
    .from('holdings')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 添加交易
export async function addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }

  const payload = {
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

  const { data, error } = await supabase
    .from('transactions')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 删除持仓
export async function deleteHolding(id: string) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }

  const { error } = await supabase
    .from('holdings')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// 删除交易
export async function deleteTransaction(id: string) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
