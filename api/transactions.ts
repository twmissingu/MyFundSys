/**
 * @fileoverview 交易数据 API
 * @description 交易记录的CRUD操作，使用Upstash Redis存储
 * @module api/transactions
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

// 初始化Redis客户端
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

const TRANSACTIONS_KEY = 'myfundsys:transactions';
const HOLDINGS_KEY = 'myfundsys:holdings';

/**
 * 处理交易数据请求
 * @param req - Vercel请求对象
 * @param res - Vercel响应对象
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    switch (req.method) {
      case 'GET':
        return await getTransactions(res);
      case 'POST':
        return await createTransaction(req, res);
      case 'PUT':
        return await updateTransaction(req, res);
      case 'DELETE':
        return await deleteTransaction(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('[API Error]', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * 获取所有交易记录
 */
async function getTransactions(res: VercelResponse) {
  try {
    const transactions = await redis.get(TRANSACTIONS_KEY) || [];
    return res.status(200).json(transactions);
  } catch (error) {
    console.error('[Redis Error]', error);
    return res.status(500).json({ error: 'Failed to fetch transactions' });
  }
}

/**
 * 创建交易记录
 */
async function createTransaction(req: VercelRequest, res: VercelResponse) {
  try {
    const transaction = req.body;
    
    // 验证必要字段
    if (!transaction.fundCode || !transaction.type || !transaction.shares) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 添加ID和时间戳
    const newTransaction = {
      ...transaction,
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 获取现有交易
    const transactions = await redis.get(TRANSACTIONS_KEY) || [];
    
    // 添加新交易
    transactions.push(newTransaction);
    
    // 保存到Redis
    await redis.set(TRANSACTIONS_KEY, transactions);

    // 更新持仓
    await updateHoldings(transaction);

    return res.status(201).json(newTransaction);
  } catch (error) {
    console.error('[Redis Error]', error);
    return res.status(500).json({ error: 'Failed to create transaction' });
  }
}

/**
 * 更新交易记录
 */
async function updateTransaction(req: VercelRequest, res: VercelResponse) {
  try {
    const { id } = req.query;
    const updates = req.body;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    const transactions = await redis.get(TRANSACTIONS_KEY) || [];
    const index = transactions.findIndex((t: any) => t.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // 更新交易
    transactions[index] = {
      ...transactions[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await redis.set(TRANSACTIONS_KEY, transactions);

    return res.status(200).json(transactions[index]);
  } catch (error) {
    console.error('[Redis Error]', error);
    return res.status(500).json({ error: 'Failed to update transaction' });
  }
}

/**
 * 删除交易记录
 */
async function deleteTransaction(req: VercelRequest, res: VercelResponse) {
  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    const transactions = await redis.get(TRANSACTIONS_KEY) || [];
    const filtered = transactions.filter((t: any) => t.id !== id);

    if (filtered.length === transactions.length) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    await redis.set(TRANSACTIONS_KEY, filtered);

    return res.status(200).json({ message: 'Transaction deleted' });
  } catch (error) {
    console.error('[Redis Error]', error);
    return res.status(500).json({ error: 'Failed to delete transaction' });
  }
}

/**
 * 更新持仓数据
 */
async function updateHoldings(transaction: any) {
  try {
    const holdings = await redis.get(HOLDINGS_KEY) || [];
    const existingIndex = holdings.findIndex((h: any) => h.fundCode === transaction.fundCode);

    if (existingIndex >= 0) {
      // 更新现有持仓
      const holding = holdings[existingIndex];
      if (transaction.type === 'buy') {
        holding.shares += transaction.shares;
        holding.totalCost += transaction.amount;
        holding.avgNav = holding.totalCost / holding.shares;
      } else {
        holding.shares -= transaction.shares;
        holding.totalCost = holding.shares * holding.avgNav;
      }
      holding.updatedAt = new Date().toISOString();
    } else if (transaction.type === 'buy') {
      // 创建新持仓
      holdings.push({
        fundCode: transaction.fundCode,
        fundName: transaction.fundName,
        shares: transaction.shares,
        avgNav: transaction.nav,
        totalCost: transaction.amount,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    await redis.set(HOLDINGS_KEY, holdings);
  } catch (error) {
    console.error('[Update Holdings Error]', error);
  }
}
