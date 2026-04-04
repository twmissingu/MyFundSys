import type { FundApiData, MarketValuationData, FundSearchResult } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ============================================
// 基金净值 API 服务
// ============================================

const CACHE_DURATION = 5 * 60 * 1000;
const navCache = new Map<string, { data: FundApiData; timestamp: number }>();

export async function fetchFundNav(fundCode: string): Promise<FundApiData | null> {
  try {
    const cached = navCache.get(fundCode);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    const data = await fetchFromEastMoney(fundCode);
    if (data) {
      navCache.set(fundCode, { data, timestamp: Date.now() });
      return data;
    }
    return null;
  } catch (error) {
    console.error('获取基金净值失败:', error);
    return null;
  }
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
      if (data.estimateNav && data.estimateRate !== undefined) {
        return {
          code: data.code,
          name: data.name,
          nav: data.nav,
          navDate: data.navDate,
          dailyChange: data.estimateNav - data.nav,
          dailyChangeRate: data.estimateRate,
        };
      }

      const historyData = await fetchFundHistory(fundCode, 5, 1, '');
      if (historyData.length >= 1) {
        const latestHistory = historyData[0];
        return {
          code: data.code,
          name: data.name,
          nav: data.nav,
          navDate: data.navDate,
          dailyChange: latestHistory.nav * (latestHistory.dailyChangeRate / 100),
          dailyChangeRate: latestHistory.dailyChangeRate,
        };
      }

      return {
        code: data.code,
        name: data.name,
        nav: data.nav,
        navDate: data.navDate,
        dailyChange: 0,
        dailyChangeRate: 0,
      };
    }
    return null;
  } catch (error) {
    console.error(`获取基金净值失败 ${fundCode}:`, error);
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
  } catch (error) {
    console.error('获取市场估值失败:', error);
    return {
      date: new Date().toISOString().split('T')[0],
      pe: 16.0,
      pb: 1.4,
      percentile: 0.30,
      temperature: 30,
      source: 'error',
      error: error instanceof Error ? error.message : '数据获取失败',
    } as MarketValuationData;
  }
}

async function fetchFromLocalJson(): Promise<MarketValuationData | null> {
  try {
    const basePath = import.meta.env.BASE_URL || '/MyFundSys/';
    const response = await fetch(`${basePath}valuation.json?v=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (data && data.pe && data.pb) {
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
  } catch (error) {
    console.error('读取本地估值文件失败:', error);
    return null;
  }
}

// ============================================
// 基金搜索
// ============================================

export async function searchByCode(code: string): Promise<FundSearchResult[]> {
  if (!code || code.trim().length < 2) return [];
  try {
    const apiResults = await searchFromEastMoney(code.trim());
    return apiResults.filter(f =>
      f.code.toLowerCase().startsWith(code.trim().toLowerCase())
    ).slice(0, 10);
  } catch {
    return [];
  }
}

export async function searchByName(name: string): Promise<FundSearchResult[]> {
  if (!name || name.trim().length < 2) return [];
  try {
    const apiResults = await searchFromEastMoney(name.trim());
    return apiResults.filter(f =>
      f.name.toLowerCase().includes(name.trim().toLowerCase())
    ).slice(0, 10);
  } catch {
    return [];
  }
}

export async function searchFunds(keyword: string): Promise<FundSearchResult[]> {
  if (!keyword || keyword.trim().length < 2) return [];
  try {
    return await searchFromEastMoney(keyword.trim());
  } catch {
    return [];
  }
}

async function searchFromEastMoney(keyword: string): Promise<FundSearchResult[]> {
  try {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase 未配置');
    }

    const { data, error } = await supabase.functions.invoke('fund-search', {
      body: { keyword },
    });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('东方财富搜索失败:', error);
    return [];
  }
}

// ============================================
// 批量基金净值操作
// ============================================

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
  try {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase 未配置');
    }

    const { data, error } = await supabase.functions.invoke('fund-history', {
      body: { code: fundCode, pageSize, pageIndex, startDate, endDate },
    });
    if (!error && data) return data;
    return [];
  } catch (error) {
    console.error(`获取历史净值失败 ${fundCode}:`, error);
    return [];
  }
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
    const cached = historyCache.get(fundCode);
    if (cached && Date.now() - cached.timestamp < HISTORY_CACHE_VALID_MS) {
      return cached.data;
    }

    const apiData = await fetchFundHistoryBatch(fundCode, days);
    const result = apiData.map(item => ({ date: item.date, nav: item.nav }));
    historyCache.set(fundCode, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error(`获取历史缓存失败 ${fundCode}:`, error);
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

  allData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return allData.slice(-days);
}

export function clearNavCache(): void {
  navCache.clear();
  valuationCache = null;
  historyCache.clear();
}
