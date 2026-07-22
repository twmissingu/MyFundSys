import type { FundApiData, MarketValuationData, FundSearchResult } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ============================================
// 基金净值 API 服务
// ============================================

const CACHE_DURATION = 5 * 60 * 1000;
const FETCH_TIMEOUT = 10000;
const navCache = new Map<string, { data: FundApiData; timestamp: number }>();
const pendingNavRequests = new Map<string, Promise<FundApiData | null>>();

export async function fetchFundNav(fundCode: string): Promise<FundApiData | null> {
  fundCode = fundCode.trim();
  if (!fundCode) return null;
  const cached = navCache.get(fundCode);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  const pending = pendingNavRequests.get(fundCode);
  if (pending) return pending;

  const promise = fetchFromEastMoney(fundCode).catch(() => null);
  pendingNavRequests.set(fundCode, promise);
  const data = await Promise.race([
    promise,
    new Promise<null>(resolve => setTimeout(() => resolve(null), FETCH_TIMEOUT)),
  ]);
  pendingNavRequests.delete(fundCode);

  if (data) {
    navCache.set(fundCode, { data, timestamp: Date.now() });
    return data;
  }
  return null;
}

async function fetchFromEastMoney(fundCode: string): Promise<FundApiData | null> {
  try {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase 未配置');
    }

    const { data, error } = await supabase.functions.invoke('fund-nav', {
      body: { code: fundCode },
    });
    if (error) throw error;
    if (data) {
      if (data.estimateNav != null && data.estimateRate !== undefined) {
        return {
          code: data.code, name: data.name, nav: data.nav, navDate: data.navDate,
          dailyChange: data.estimateNav - data.nav,
          dailyChangeRate: data.estimateRate,
        };
      }

      return {
        code: data.code, name: data.name, nav: data.nav, navDate: data.navDate,
        dailyChange: 0,
        dailyChangeRate: 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================
// 市场估值数据
// ============================================

let valuationCache: { data: MarketValuationData; timestamp: number } | null = null;
const VALUATION_CACHE_DURATION = 5 * 60 * 1000;

export async function fetchMarketValuation(): Promise<MarketValuationData> {
  try {
    if (valuationCache && Date.now() - valuationCache.timestamp < VALUATION_CACHE_DURATION) {
      return valuationCache.data;
    }

    const data = await fetchFromLocalJson();
    if (data) {
      valuationCache = { data, timestamp: Date.now() };
      return data;
    }

    throw new Error('无法获取估值数据');
  } catch {
    throw new Error('市场估值数据获取失败');
  }
}

async function fetchFromLocalJson(): Promise<MarketValuationData | null> {
  try {
    const basePath = import.meta.env.BASE_URL || '/MyFundSys/';
    const response = await fetch(`${basePath}valuation.json?v=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (data && data.pe != null && data.pb != null) {
      return {
        date: data.date || new Date().toISOString().split('T')[0],
        pe: Number(data.pe),
        pb: Number(data.pb),
        percentile: Number(data.percentile || 0.30),
        temperature: Number(data.temperature || 30),
        source: data.source || 'json',
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================
// 基金搜索
// ============================================

const FUND_CODE_REGEX = /^\d+$/;

/**
 * 统一基金搜索
 * @param keyword 搜索关键词
 * @param mode 搜索模式：'auto' 自动检测（默认），'code' 按代码前缀，'name' 按名称模糊
 */
export async function searchFunds(keyword: string, mode: 'auto' | 'code' | 'name' = 'auto'): Promise<FundSearchResult[]> {
  if (!keyword || keyword.trim().length < 2) return [];
  // 修复 #17：错误不再 catch 返回 [] 掩盖（UI 显示"未找到"而非"搜索失败"），改为抛出
  const trimmed = keyword.trim();
  const apiResults = await searchFromEastMoney(trimmed);

  const searchByCode = mode === 'code' || (mode === 'auto' && FUND_CODE_REGEX.test(trimmed));

  if (searchByCode) {
    return apiResults.filter(f =>
      f.code.toLowerCase().startsWith(trimmed.toLowerCase())
    ).slice(0, 10);
  } else {
    return apiResults.filter(f =>
      f.name.toLowerCase().includes(trimmed.toLowerCase())
    ).slice(0, 10);
  }
}

/**
 * @deprecated 使用 searchFunds(code, 'code') 替代
 */
export async function searchByCode(code: string): Promise<FundSearchResult[]> {
  return searchFunds(code, 'code');
}

/**
 * @deprecated 使用 searchFunds(name, 'name') 替代
 */
export async function searchByName(name: string): Promise<FundSearchResult[]> {
  return searchFunds(name, 'name');
}

async function searchFromEastMoney(keyword: string): Promise<FundSearchResult[]> {
  // 修复 #17：错误不再 catch 返回 [] 掩盖，改为抛出供调用方处理
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }

  const { data, error } = await supabase.functions.invoke('fund-search', {
    body: { keyword },
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// ============================================
// 批量基金净值操作
// ============================================

/**
 * 批量获取基金净值，返回 Map 方便查找
 * @param fundCodes 基金代码数组
 * @returns Map<基金代码, { nav, navDate, name }>
 */
export async function batchFetchNav(
  fundCodes: string[]
): Promise<Map<string, { nav: number; navDate: string; name: string }>> {
  const navMap = new Map<string, { nav: number; navDate: string; name: string }>();
  const batchSize = 5;

  for (let i = 0; i < fundCodes.length; i += batchSize) {
    const batch = fundCodes.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (code) => {
        const navData = await fetchFundNav(code);
        if (navData && navData.nav > 0) {
          return { code, nav: navData.nav, navDate: navData.navDate, name: navData.name };
        }
        return null;
      })
    );
    results.forEach(r => { if (r) navMap.set(r.code, { nav: r.nav, navDate: r.navDate, name: r.name }); });
    if (i + batchSize < fundCodes.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return navMap;
}

export async function fetchMultipleFundsNav(fundCodes: string[]): Promise<FundApiData[]> {
  const results: FundApiData[] = [];
  const batchSize = 5;

  for (let i = 0; i < fundCodes.length; i += batchSize) {
    const batch = fundCodes.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(code => fetchFundNav(code)));
    batchResults.forEach(data => { if (data) results.push(data); });
    if (i + batchSize < fundCodes.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return results;
}

export async function batchRefreshFunds(codes: string[]): Promise<{
  success: string[];
  failed: string[];
}> {
  const success: string[] = [];
  const failed: string[] = [];
  const batchSize = 5;

  for (let i = 0; i < codes.length; i += batchSize) {
    const batch = codes.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (code) => {
        try {
          const data = await fetchFundNav(code);
          if (data) success.push(code);
          else failed.push(code);
        } catch {
          failed.push(code);
        }
      })
    );
    if (i + batchSize < codes.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return { success, failed };
}

// ============================================
// 历史净值数据
// ============================================

export interface FundHistoryData {
  date: string;
  nav: number;
  accNav: number;
  dailyChangeRate: number;
  buyStatus: string;
  sellStatus: string;
}

export async function fetchFundHistory(
  fundCode: string,
  pageSize = 20,
  pageIndex = 1,
  startDate = '',
  endDate = ''
): Promise<FundHistoryData[]> {
  // 修复 #13：错误不再 catch 返回 [] 掩盖（调用方无法区分"无数据"与"API 故障"），改为抛出
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置');
  }

  const { data, error } = await supabase.functions.invoke('fund-history', {
    body: { code: fundCode, pageSize, pageIndex, startDate, endDate },
  });
  if (error) throw new Error(`获取历史净值失败: ${error.message || error}`);
  return Array.isArray(data) ? data : [];
}

// ============================================
// 历史净值缓存（用于收藏列表迷你图表）
// ============================================

const HISTORY_CACHE_DAYS = 90;

export interface MiniHistoryPoint {
  date: string;
  nav: number;
}

const historyCache = new Map<string, { data: MiniHistoryPoint[]; timestamp: number }>();
const HISTORY_CACHE_VALID_MS = 24 * 60 * 60 * 1000;

export async function getFundHistoryWithCache(
  fundCode: string,
  days = HISTORY_CACHE_DAYS
): Promise<MiniHistoryPoint[]> {
  try {
    const cacheKey = `${fundCode}_${days}`;
    const cached = historyCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < HISTORY_CACHE_VALID_MS) {
      return cached.data;
    }

    const apiData = await fetchFundHistoryBatch(fundCode, days);
    const result = apiData.map(item => ({ date: item.date, nav: item.nav }));
    historyCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch {
    return [];
  }
}

export async function batchGetFundHistory(
  fundCodes: string[],
  days = HISTORY_CACHE_DAYS
): Promise<Record<string, MiniHistoryPoint[]>> {
  const result: Record<string, MiniHistoryPoint[]> = {};
  for (const code of fundCodes) {
    result[code] = await getFundHistoryWithCache(code, days);
    if (fundCodes.length > 3) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  return result;
}

async function fetchFundHistoryBatch(fundCode: string, days: number): Promise<FundHistoryData[]> {
  let allData: FundHistoryData[] = [];
  let pageIndex = 1;
  const maxPages = 10;

  while (allData.length < days && pageIndex <= maxPages) {
    const pageData = await fetchFundHistory(fundCode, 20, pageIndex, '');
    if (pageData.length === 0) break;
    allData = [...allData, ...pageData];
    if (pageData.length < 20) break;
    pageIndex++;
  }

  // 按日期去重（保留后出现的记录，即更新的数据）
  const deduped = new Map<string, FundHistoryData>();
  for (const item of allData) {
    deduped.set(item.date, item);
  }
  const sorted = Array.from(deduped.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  return sorted.slice(-days);
}

export function clearNavCache(): void {
  navCache.clear();
  valuationCache = null;
  historyCache.clear();
}
