import type { FundApiData, MarketValuationData, FundSearchResult } from '../types';
import type { FundCacheItem } from '../db';
import { db } from '../db';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ============================================
// 基金净值 API 服务
// ============================================

// 内存缓存：避免短时间内重复请求同一基金
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟
const navCache = new Map<string, { data: FundApiData; timestamp: number }>();

/**
 * 获取基金净值
 * 优先从内存缓存读取，缓存过期则调用 Supabase Edge Function
 */
export async function fetchFundNav(fundCode: string): Promise<FundApiData | null> {
  try {
    // 检查内存缓存
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

/**
 * 从东方财富获取基金净值
 * 优先 Supabase Edge Function（无 CORS 限制），降级直接调用
 */
async function fetchFromEastMoney(fundCode: string): Promise<FundApiData | null> {
  try {
    // 优先使用 Supabase Edge Function
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.functions.invoke('fund-nav', {
        body: { code: fundCode },
      });
      if (error) throw error;
      if (data) {
        return {
          code: data.code,
          name: data.name,
          nav: data.nav,
          navDate: data.navDate,
          dailyChange: data.estimateNav ? data.estimateNav - data.nav : 0,
          dailyChangeRate: data.estimateRate || 0,
        };
      }
    }

    // 降级：直接调用东方财富 API（可能有 CORS 问题）
    const url = `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo?pageIndex=1&pageSize=500&appType=ttjj&plat=Android&product=EFund&Version=1&deviceid=4252d0ac69bb50&Fcodes=${fundCode}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const result = await response.json();
    if (result.ErrCode !== 0 || !result.Datas || result.Datas.length === 0) {
      throw new Error(result.ErrMsg || 'API返回错误或无数据');
    }

    const item = result.Datas[0];
    const dailyChangeRate = parseFloat(item.NAVCHGRT || '0');
    const nav = parseFloat(item.NAV || '0');

    return {
      code: fundCode,
      name: item.SHORTNAME || `基金${fundCode}`,
      nav: Number(nav.toFixed(4)),
      navDate: item.PDATE || item.NAVDATE || new Date().toISOString().split('T')[0],
      dailyChange: Number((nav * dailyChangeRate / 100).toFixed(4)),
      dailyChangeRate: Number(dailyChangeRate.toFixed(2)),
    };
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

/**
 * 获取市场估值数据
 * 从 public/valuation.json 读取（由 GitHub Actions 每 2 小时更新）
 */
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
    // 返回默认值，避免页面崩溃
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
// 基金搜索（本地缓存 + Supabase Edge Function）
// ============================================

/**
 * 按基金代码搜索（支持前缀匹配，至少 2 位）
 */
export async function searchByCode(code: string): Promise<FundSearchResult[]> {
  if (!code || code.trim().length < 2) return [];

  const trimmedCode = code.trim();

  // 优先从本地缓存搜索
  const localResults = await searchLocalByCode(trimmedCode);
  if (localResults.length > 0) return localResults;

  // 本地无结果，调用 Supabase Edge Function
  try {
    const apiResults = await searchFromEastMoney(trimmedCode);
    // 过滤：仅保留代码前缀匹配（输入 000 匹配 000001，不匹配 100000）
    const filtered = apiResults.filter(f =>
      f.code.toLowerCase().startsWith(trimmedCode.toLowerCase())
    );
    if (filtered.length > 0) await saveFundCache(filtered);
    return filtered.slice(0, 10);
  } catch (error) {
    console.error('API搜索失败（代码）:', error);
    return [];
  }
}

/**
 * 按基金名称搜索（支持模糊匹配，至少 2 个字）
 */
export async function searchByName(name: string): Promise<FundSearchResult[]> {
  if (!name || name.trim().length < 2) return [];

  const trimmedName = name.trim();

  // 优先从本地缓存搜索
  const localResults = await searchLocalByName(trimmedName);
  if (localResults.length > 0) return localResults;

  // 本地无结果，调用 Supabase Edge Function
  try {
    const apiResults = await searchFromEastMoney(trimmedName);
    const filtered = apiResults.filter(f =>
      f.name.toLowerCase().includes(trimmedName.toLowerCase())
    );
    if (filtered.length > 0) await saveFundCache(filtered);
    return filtered.slice(0, 10);
  } catch (error) {
    console.error('API搜索失败（名称）:', error);
    return [];
  }
}

/**
 * 综合搜索（代码或名称，至少 2 位/字）
 */
export async function searchFunds(keyword: string): Promise<FundSearchResult[]> {
  if (!keyword || keyword.trim().length < 2) return [];

  const trimmedKeyword = keyword.trim();

  try {
    const localResults = await searchLocalFunds(trimmedKeyword);
    if (localResults.length > 0) {
      await updateSearchCount(localResults.map(r => r.code));
      return localResults;
    }

    const apiResults = await searchFromEastMoney(trimmedKeyword);
    if (apiResults.length > 0) {
      await saveFundCache(apiResults);
      await saveSearchHistory(trimmedKeyword, apiResults.length);
    }

    return apiResults;
  } catch (error) {
    console.error('搜索基金失败:', error);
    return [];
  }
}

// ---- 本地缓存搜索辅助函数 ----

async function searchLocalByCode(code: string): Promise<FundSearchResult[]> {
  try {
    const allFunds = await db.fundCache.toArray();
    const lower = code.toLowerCase();
    return allFunds
      .filter(f => f.code.toLowerCase().includes(lower))
      .sort((a, b) => b.searchCount - a.searchCount)
      .slice(0, 10)
      .map(toSearchResult);
  } catch {
    return [];
  }
}

async function searchLocalByName(name: string): Promise<FundSearchResult[]> {
  try {
    const allFunds = await db.fundCache.toArray();
    const lower = name.toLowerCase();
    return allFunds
      .filter(f => f.name.toLowerCase().includes(lower))
      .sort((a, b) => b.searchCount - a.searchCount)
      .slice(0, 10)
      .map(toSearchResult);
  } catch {
    return [];
  }
}

async function searchLocalFunds(keyword: string): Promise<FundSearchResult[]> {
  try {
    const allFunds = await db.fundCache.toArray();
    const lower = keyword.toLowerCase();
    return allFunds
      .filter(f => f.code.toLowerCase().includes(lower) || f.name.toLowerCase().includes(lower))
      .sort((a, b) => b.searchCount - a.searchCount)
      .slice(0, 10)
      .map(toSearchResult);
  } catch {
    return [];
  }
}

function toSearchResult(f: FundCacheItem): FundSearchResult {
  return { code: f.code, name: f.name, type: f.category, nav: f.nav, navDate: f.navDate };
}

/**
 * 调用东方财富搜索 API（通过 Supabase Edge Function 代理）
 */
async function searchFromEastMoney(keyword: string): Promise<FundSearchResult[]> {
  try {
    // 优先使用 Supabase Edge Function（无 CORS 限制）
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.functions.invoke('fund-search', {
        body: { keyword },
      });
      if (error) throw error;
      return data || [];
    }

    // 降级：直接调用（可能有 CORS 问题）
    const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(keyword)}&type=14&count=100`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    if (!result?.QuotationCodeTable?.Data) return [];

    return result.QuotationCodeTable.Data
      .filter((item: any) => item.Code && item.Name)
      .filter((item: any) => ['OTCFUND', 'FUND', 'Fund'].includes(item.Classify))
      .map((item: any) => ({
        code: item.Code,
        name: item.Name,
        type: item.Classes || item.Classify || '基金',
      }));
  } catch (error) {
    console.error('东方财富搜索失败:', error);
    return [];
  }
}

// ---- 缓存维护 ----

async function saveFundCache(funds: FundSearchResult[]): Promise<void> {
  try {
    const now = new Date().toISOString();
    for (const fund of funds) {
      const existing = await db.fundCache.where('code').equals(fund.code).first();
      if (existing) {
        await db.fundCache.update(existing.id, {
          searchCount: existing.searchCount + 1,
          lastUpdated: now,
        });
      } else {
        await db.fundCache.add({
          id: `fc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          code: fund.code,
          name: fund.name,
          category: fund.type,
          nav: fund.nav,
          navDate: fund.navDate,
          source: 'search',
          isHolding: false,
          holdingShares: 0,
          searchCount: 1,
          lastUpdated: now,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  } catch (error) {
    console.error('保存基金缓存失败:', error);
  }
}

async function saveSearchHistory(keyword: string, resultsCount: number): Promise<void> {
  try {
    await db.fundSearchHistory.add({
      keyword,
      resultsCount,
      searchedAt: new Date().toISOString(),
    });
  } catch {
    // 搜索历史保存失败不影响主流程
  }
}

async function updateSearchCount(codes: string[]): Promise<void> {
  try {
    const now = new Date().toISOString();
    for (const code of codes) {
      const fund = await db.fundCache.where('code').equals(code).first();
      if (fund) {
        await db.fundCache.update(fund.id, {
          searchCount: fund.searchCount + 1,
          lastUpdated: now,
        });
      }
    }
  } catch {
    // 计数更新失败不影响主流程
  }
}

export async function getCachedFunds(): Promise<FundCacheItem[]> {
  try {
    return await db.fundCache.orderBy('searchCount').reverse().toArray();
  } catch {
    return [];
  }
}

export async function getHoldingFunds(): Promise<FundCacheItem[]> {
  try {
    const all = await db.fundCache.toArray();
    return all.filter(f => f.isHolding === true);
  } catch {
    return [];
  }
}

export async function markFundAsHolding(code: string, isHolding: boolean): Promise<void> {
  try {
    const fund = await db.fundCache.where('code').equals(code).first();
    if (fund) {
      await db.fundCache.update(fund.id, {
        isHolding,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('标记持仓失败:', error);
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
          if (data) {
            const fund = await db.fundCache.where('code').equals(code).first();
            if (fund) {
              await db.fundCache.update(fund.id, {
                nav: data.nav,
                navDate: data.navDate,
                dailyChangeRate: data.dailyChangeRate,
                accNav: data.accNav,
                lastUpdated: new Date().toISOString(),
              });
            }
            success.push(code);
          } else {
            failed.push(code);
          }
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
  date: string;             // 日期
  nav: number;              // 单位净值
  accNav: number;           // 累计净值
  dailyChangeRate: number;  // 日涨跌幅(%)
  buyStatus: string;        // 申购状态
  sellStatus: string;       // 赎回状态
}

/**
 * 获取基金历史净值
 * 优先通过 Supabase Edge Function 代理，解决 CORS 问题
 * @param fundCode 基金代码
 * @param pageSize 每页条数（默认20）
 * @param pageIndex 页码（从1开始）
 * @param startDate 起始日期（YYYY-MM-DD，可选）
 */
export async function fetchFundHistory(
  fundCode: string,
  pageSize = 20,
  pageIndex = 1,
  startDate = ''
): Promise<FundHistoryData[]> {
  try {
    // 优先 Supabase Edge Function（无 CORS 限制）
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.functions.invoke('fund-history', {
        body: { code: fundCode, pageSize, pageIndex, startDate },
      });
      if (!error && data) return data;
    }

    // 降级：直接调用东方财富 API（可能有 CORS 限制）
    const url = `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${fundCode}&pageIndex=${pageIndex}&pageSize=${pageSize}&startDate=${startDate}&endDate=`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    if (!result.Data?.LSJZList) return [];

    return result.Data.LSJZList
      .filter((item: any) => item.FSRQ && item.DWJZ)
      .map((item: any) => ({
        date: item.FSRQ,
        nav: parseFloat(item.DWJZ),
        accNav: parseFloat(item.LJJZ || '0'),
        dailyChangeRate: parseFloat(item.JZZZL || '0'),
        buyStatus: item.SGZT || '-',
        sellStatus: item.SHZT || '-',
      }));
  } catch (error) {
    console.error(`获取历史净值失败 ${fundCode}:`, error);
    return [];
  }
}

// ============================================
// 历史净值缓存（用于收藏列表迷你图表）
// ============================================

const HISTORY_CACHE_DAYS = 90;       // 缓存最近 90 天
const HISTORY_CACHE_VALID_MS = 24 * 60 * 60 * 1000; // 缓存有效期 24 小时

export interface MiniHistoryPoint {
  date: string;
  nav: number;
}

/**
 * 获取基金历史净值（优先从 IndexedDB 缓存，缺失时调 API）
 */
export async function getFundHistoryWithCache(
  fundCode: string,
  days = HISTORY_CACHE_DAYS
): Promise<MiniHistoryPoint[]> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    // 从 IndexedDB 缓存读取
    const cachedData = await db.fundHistoryCache
      .where('code')
      .equals(fundCode)
      .filter(item => item.date >= cutoffStr)
      .toArray();

    // 缓存有效：至少 20 条且未超过 24 小时
    const cacheAge = cachedData.length > 0
      ? Date.now() - new Date(cachedData[0].updatedAt).getTime()
      : Infinity;

    if (cachedData.length >= 20 && cacheAge < HISTORY_CACHE_VALID_MS) {
      return cachedData
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(item => ({ date: item.date, nav: item.nav }));
    }

    // 缓存不足或过期，从 API 获取
    const apiData = await fetchFundHistoryBatch(fundCode, days);
    if (apiData.length > 0) await saveHistoryCache(fundCode, apiData);

    return apiData.map(item => ({ date: item.date, nav: item.nav }));
  } catch (error) {
    console.error(`获取历史缓存失败 ${fundCode}:`, error);
    return [];
  }
}

/**
 * 批量获取多只基金的历史净值（串行，避免并发过多）
 */
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

/**
 * 分页批量获取历史净值（内部使用，东方财富每页固定返回20条）
 */
async function fetchFundHistoryBatch(fundCode: string, days: number): Promise<FundHistoryData[]> {
  let allData: FundHistoryData[] = [];
  let pageIndex = 1;
  const maxPages = 10;

  while (allData.length < days && pageIndex <= maxPages) {
    const pageData = await fetchFundHistory(fundCode, 20, pageIndex, '');
    if (pageData.length === 0) break;
    allData = [...allData, ...pageData];
    if (pageData.length < 20) break; // 最后一页
    pageIndex++;
  }

  allData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return allData.slice(-days);
}

async function saveHistoryCache(fundCode: string, data: FundHistoryData[]): Promise<void> {
  const now = new Date().toISOString();
  const cacheItems = data.map(item => ({
    id: `${fundCode}_${item.date}`,
    code: fundCode,
    date: item.date,
    nav: item.nav,
    accNav: item.accNav,
    dailyChangeRate: item.dailyChangeRate,
    updatedAt: now,
  }));
  await db.fundHistoryCache.bulkPut(cacheItems);
}

/**
 * 清理超过 120 天的历史缓存
 */
export async function cleanHistoryCache(): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - HISTORY_CACHE_DAYS - 30);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];
  await db.fundHistoryCache.where('date').below(cutoffStr).delete();
}

/**
 * 清除内存缓存（切换账号或强制刷新时使用）
 */
export function clearNavCache(): void {
  navCache.clear();
  valuationCache = null;
}
