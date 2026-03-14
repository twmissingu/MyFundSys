/**
 * @fileoverview Vercel API 服务
 * @description 调用Vercel Edge Functions API
 * @module services/vercelApi
 */

import type { FundApiData, FundSearchResult, Transaction } from '../types';

// API基础URL
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * 获取基金净值
 * @param code - 基金代码
 * @returns 基金净值数据
 */
export async function fetchFundNav(code: string): Promise<FundApiData | null> {
  try {
    const response = await fetch(`${API_BASE}/fund/${code}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('[API] 获取基金净值失败:', error);
    return null;
  }
}

/**
 * 搜索基金
 * @param keyword - 搜索关键词
 * @returns 基金列表
 */
export async function searchFunds(keyword: string): Promise<FundSearchResult[]> {
  if (!keyword.trim()) {
    return [];
  }
  
  try {
    const response = await fetch(
      `${API_BASE}/search?keyword=${encodeURIComponent(keyword)}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('[API] 搜索基金失败:', error);
    return [];
  }
}

/**
 * 获取所有交易记录
 * @returns 交易记录列表
 */
export async function getTransactions(): Promise<Transaction[]> {
  try {
    const response = await fetch(`${API_BASE}/transactions`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('[API] 获取交易记录失败:', error);
    return [];
  }
}

/**
 * 创建交易记录
 * @param transaction - 交易数据
 * @returns 创建的交易记录
 */
export async function createTransaction(
  transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Transaction | null> {
  try {
    const response = await fetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transaction),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('[API] 创建交易记录失败:', error);
    return null;
  }
}

/**
 * 更新交易记录
 * @param id - 交易ID
 * @param updates - 更新数据
 * @returns 更新后的交易记录
 */
export async function updateTransaction(
  id: string,
  updates: Partial<Transaction>
): Promise<Transaction | null> {
  try {
    const response = await fetch(`${API_BASE}/transactions?id=${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('[API] 更新交易记录失败:', error);
    return null;
  }
}

/**
 * 删除交易记录
 * @param id - 交易ID
 * @returns 是否成功
 */
export async function deleteTransaction(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/transactions?id=${id}`, {
      method: 'DELETE',
    });
    
    return response.ok;
  } catch (error) {
    console.error('[API] 删除交易记录失败:', error);
    return false;
  }
}

/**
 * 验证密码
 * @param password - 密码
 * @returns 是否验证通过
 */
export async function verifyPassword(password: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('[API] 密码验证失败:', error);
    return false;
  }
}
