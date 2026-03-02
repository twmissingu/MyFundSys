import { useEffect, useState } from 'react';
import { db, initFundData, initStrategyData } from '../db';
import type { Fund, Holding, Transaction, Strategy } from '../types';

// 初始化数据库
export function useInitDB() {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await initFundData();
        await initStrategyData();
        setInitialized(true);
      } catch (err) {
        setError(err as Error);
      }
    };
    init();
  }, []);

  return { initialized, error };
}

// 获取所有基金
export function useFunds() {
  const [funds, setFunds] = useState<Fund[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFunds = async () => {
      const data = await db.funds.toArray();
      setFunds(data);
      setLoading(false);
    };
    loadFunds();
  }, []);

  return { funds, loading };
}

// 获取持仓
export function useHoldings() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const data = await db.holdings.toArray();
    setHoldings(data);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  return { holdings, loading, refresh };
}

// 获取交易记录
export function useTransactions(fundCode?: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    let query = db.transactions.orderBy('date').reverse();
    if (fundCode) {
      query = db.transactions.where('fundCode').equals(fundCode).reverse();
    }
    const data = await query.toArray();
    setTransactions(data);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [fundCode]);

  return { transactions, loading, refresh };
}

// 获取策略
export function useStrategies() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStrategies = async () => {
      const data = await db.strategies.toArray();
      setStrategies(data);
      setLoading(false);
    };
    loadStrategies();
  }, []);

  return { strategies, loading };
}

// 添加交易记录
export async function addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>) {
  const newTransaction: Transaction = {
    ...transaction,
    id: `t_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  await db.transactions.add(newTransaction);

  // 更新持仓
  await updateHolding(transaction);

  return newTransaction;
}

// 更新持仓
async function updateHolding(transaction: Omit<Transaction, 'id' | 'createdAt'>) {
  const existingHolding = await db.holdings.where('fundCode').equals(transaction.fundCode).first();

  if (transaction.type === 'buy') {
    if (existingHolding) {
      const newTotalCost = existingHolding.totalCost + transaction.amount;
      const newShares = existingHolding.shares + transaction.shares;
      await db.holdings.update(existingHolding.id, {
        shares: newShares,
        totalCost: newTotalCost,
        avgCost: newTotalCost / newShares,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await db.holdings.add({
        id: `h_${Date.now()}`,
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
  } else if (transaction.type === 'sell' && existingHolding) {
    const newShares = existingHolding.shares - transaction.shares;
    if (newShares > 0) {
      const costReduction = (transaction.shares / existingHolding.shares) * existingHolding.totalCost;
      await db.holdings.update(existingHolding.id, {
        shares: newShares,
        totalCost: existingHolding.totalCost - costReduction,
        updatedAt: new Date().toISOString(),
      });
    } else {
      await db.holdings.delete(existingHolding.id);
    }
  }
}

// 删除交易记录
export async function deleteTransaction(id: string) {
  await db.transactions.delete(id);
}

// 删除持仓
export async function deleteHolding(id: string) {
  await db.holdings.delete(id);
}
