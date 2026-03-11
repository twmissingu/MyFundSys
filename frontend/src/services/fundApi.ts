import type { FundApiData, MarketValuationData, FundSearchResult as FundSearchResultType } from '../types';
import type { FundCacheItem } from '../db';
import { db } from '../db';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ============================================
// 配置
// ============================================

// API基础URL
const API_BASE = import.meta.env.DEV 
  ? 'http://localhost:3001'  // 开发环境使用代理服务器
  : '';  // 生产环境使用相对路径

// ============================================
// 基金净值 API 服务
// ============================================

// 缓存配置
const CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存
const navCache = new Map<string, { data: FundApiData; timestamp: number }>();

/**
 * 获取基金净值
 * 优先从缓存获取，缓存过期则请求API
 */
export async function fetchFundNav(fundCode: string): Promise<FundApiData | null> {
  try {
    // 检查缓存
    const cached = navCache.get(fundCode);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    // 从API获取
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
 * 从东方财富网获取基金净值
 * 使用正确的 API 格式：Fcodes 参数支持批量查询
 */
async function fetchFromEastMoney(fundCode: string): Promise<FundApiData | null> {
  try {
    // 正确的东方财富API格式：使用 Fcodes 参数（支持批量查询）
    const url = `${API_BASE}/api/eastmoney/FundMNewApi/FundMNFInfo?pageIndex=1&pageSize=500&appType=ttjj&plat=Android&product=EFund&Version=1&deviceid=4252d0ac69bb50&Fcodes=${fundCode}`;
    
    console.log('[API] Fetching:', url);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.ErrCode !== 0 || !result.Datas || result.Datas.length === 0) {
      throw new Error(result.ErrMsg || 'API返回错误或无数据');
    }

    // 返回的是数组，取第一个
    const data = result.Datas[0];
    
    // 解析涨跌幅 - 使用 NAVCHGRT（日涨跌幅）
    const dailyChangeRate = parseFloat(data.NAVCHGRT || '0');
    const nav = parseFloat(data.NAV || '0');
    const dailyChange = nav * dailyChangeRate / 100;
    
    // 解析扩展字段
    const accNav = data.ACCNAV ? parseFloat(data.ACCNAV) : undefined;
    const newPrice = data.NEWPRICE ? parseFloat(data.NEWPRICE) : undefined;
    const priceChangeRate = data.CHANGERATIO ? parseFloat(data.CHANGERATIO) : undefined;
    const fundFlow = data.ZJL ? parseFloat(data.ZJL) : undefined;
    const marketTime = data.HQDATE || undefined;

    return {
      code: fundCode,
      name: data.SHORTNAME || getFundNameByCode(fundCode),
      nav: Number(nav.toFixed(4)),
      accNav: accNav ? Number(accNav.toFixed(4)) : undefined,
      navDate: data.PDATE || data.NAVDATE || new Date().toISOString().split('T')[0],
      dailyChange: Number(dailyChange.toFixed(4)),
      dailyChangeRate: Number(dailyChangeRate.toFixed(2)),
      // 扩展字段
      newPrice,
      priceChangeRate: priceChangeRate ? Number(priceChangeRate.toFixed(2)) : undefined,
      fundFlow: fundFlow ? Number(fundFlow.toFixed(2)) : undefined,
      marketTime,
    };
  } catch (error) {
    console.error(`[API] 东方财富API获取失败 ${fundCode}:`, error);
    
    // 开发环境下代理服务器未启动时使用模拟数据
    if (import.meta.env.DEV) {
      console.log(`[DEV] 使用模拟数据: ${fundCode}`);
      return generateMockFundData(fundCode);
    }
    
    return null;
  }
}

/**
 * 生成模拟基金数据
 */
function generateMockFundData(fundCode: string): FundApiData {
  const baseNav = 1.5 + Math.random() * 2;
  const dailyChangeRate = (Math.random() - 0.5) * 4;
  const dailyChange = baseNav * dailyChangeRate / 100;
  
  return {
    code: fundCode,
    name: getFundNameByCode(fundCode),
    nav: Number((baseNav + dailyChange).toFixed(4)),
    navDate: new Date().toISOString().split('T')[0],
    dailyChange: Number(dailyChange.toFixed(4)),
    dailyChangeRate: Number(dailyChangeRate.toFixed(2)),
  };
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
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

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
// 基金搜索和缓存功能
// ============================================

export interface FundSearchResult {
  code: string;
  name: string;
  type?: string;
  nav?: number;
  navDate?: string;
}

/**
 * 按基金代码搜索（支持模糊匹配）
 * @param code 基金代码（至少2位）
 */
export async function searchByCode(code: string): Promise<FundSearchResult[]> {
  if (!code || code.trim().length < 2) {
    return [];
  }
  
  const trimmedCode = code.trim();
  
  try {
    // 直接从东方财富API搜索（不再使用本地缓存优先）
    const apiResults = await searchFromEastMoney(trimmedCode);
    // 过滤只保留代码前缀匹配的结果（如输入000，匹配000001，不匹配100000）
    const filteredResults = apiResults.filter(f => 
      f.code.toLowerCase().startsWith(trimmedCode.toLowerCase())
    );
    
    return filteredResults.slice(0, 10);
  } catch (error) {
    console.error('按代码搜索基金失败:', error);
    return [];
  }
}

/**
 * 按基金名称搜索（支持模糊匹配）
 * @param name 基金名称（至少2个字）
 */
export async function searchByName(name: string): Promise<FundSearchResult[]> {
  if (!name || name.trim().length < 2) {
    return [];
  }
  
  const trimmedName = name.trim();
  
  try {
    // 直接从东方财富API搜索（不再使用本地缓存优先）
    const apiResults = await searchFromEastMoney(trimmedName);
    // 过滤只保留名称匹配的结果
    const filteredResults = apiResults.filter(f => 
      f.name.toLowerCase().includes(trimmedName.toLowerCase())
    );
    
    return filteredResults.slice(0, 10);
  } catch (error) {
    console.error('按名称搜索基金失败:', error);
    return [];
  }
}

/**
 * 综合搜索（代码或名称）- 保留原有功能
 * @param keyword 关键词
 */
export async function searchFunds(keyword: string): Promise<FundSearchResult[]> {
  if (!keyword || keyword.trim().length < 2) {
    return [];
  }
  
  const trimmedKeyword = keyword.trim();
  
  try {
    // 1. 先从本地缓存搜索
    const localResults = await searchLocalFunds(trimmedKeyword);
    
    // 2. 如果本地有结果，直接返回
    if (localResults.length > 0) {
      await updateSearchCount(localResults.map(r => r.code));
      return localResults;
    }
    
    // 3. 本地没有，从东方财富API搜索
    const apiResults = await searchFromEastMoney(trimmedKeyword);
    
    // 4. 保存到本地缓存
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

/**
 * 本地缓存按代码搜索
 */
async function searchLocalByCode(code: string): Promise<FundSearchResult[]> {
  try {
    const allFunds = await db.fundCache.toArray();
    const lowerCode = code.toLowerCase();
    
    return allFunds
      .filter(fund => fund.code.toLowerCase().includes(lowerCode))
      .sort((a, b) => b.searchCount - a.searchCount)
      .slice(0, 10)
      .map(fund => ({
        code: fund.code,
        name: fund.name,
        type: fund.category,
        nav: fund.nav,
        navDate: fund.navDate,
      }));
  } catch (error) {
    console.error('本地代码搜索失败:', error);
    return [];
  }
}

/**
 * 本地缓存按名称搜索
 */
async function searchLocalByName(name: string): Promise<FundSearchResult[]> {
  try {
    const allFunds = await db.fundCache.toArray();
    const lowerName = name.toLowerCase();
    
    return allFunds
      .filter(fund => fund.name.toLowerCase().includes(lowerName))
      .sort((a, b) => b.searchCount - a.searchCount)
      .slice(0, 10)
      .map(fund => ({
        code: fund.code,
        name: fund.name,
        type: fund.category,
        nav: fund.nav,
        navDate: fund.navDate,
      }));
  } catch (error) {
    console.error('本地名称搜索失败:', error);
    return [];
  }
}

async function searchLocalFunds(keyword: string): Promise<FundSearchResult[]> {
  try {
    const allFunds = await db.fundCache.toArray();
    const lowerKeyword = keyword.toLowerCase();
    
    return allFunds
      .filter(fund => 
        fund.code.toLowerCase().includes(lowerKeyword) ||
        fund.name.toLowerCase().includes(lowerKeyword)
      )
      .sort((a, b) => b.searchCount - a.searchCount)
      .slice(0, 10)
      .map(fund => ({
        code: fund.code,
        name: fund.name,
        type: fund.category,
        nav: fund.nav,
        navDate: fund.navDate,
      }));
  } catch (error) {
    console.error('本地搜索失败:', error);
    return [];
  }
}

async function searchFromEastMoney(keyword: string): Promise<FundSearchResult[]> {
  try {
    const url = `${API_BASE}/api/suggest/api/suggest/get?input=${encodeURIComponent(keyword)}&type=14&count=20`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result && result.QuotationCodeTable && result.QuotationCodeTable.Data) {
      const data = result.QuotationCodeTable.Data;
      
      // 过滤只保留基金（Classify为OTCFUND、FUND或Fund）
      return data
        .filter((item: any) => item.Code && item.Name)
        .filter((item: any) => item.Classify === 'OTCFUND' || item.Classify === 'FUND' || item.Classify === 'Fund')
        .map((item: any) => ({
          code: item.Code,
          name: item.Name,
          type: item.Classes || item.Classify || '基金',
        }));
    }
    
    return [];
  } catch (error) {
    console.error('[API] 东方财富搜索失败:', error);
    return [];
  }
}

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
  } catch (error) {
    console.error('保存搜索历史失败:', error);
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
  } catch (error) {
    console.error('更新搜索次数失败:', error);
  }
}

export async function getCachedFunds(): Promise<FundCacheItem[]> {
  try {
    return await db.fundCache
      .orderBy('searchCount')
      .reverse()
      .toArray();
  } catch (error) {
    console.error('获取缓存基金失败:', error);
    return [];
  }
}

export async function getHoldingFunds(): Promise<FundCacheItem[]> {
  try {
    const all = await db.fundCache.toArray();
    return all.filter(fund => fund.isHolding === true);
  } catch (error) {
    console.error('获取持仓基金失败:', error);
    return [];
  }
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
        } catch (error) {
          failed.push(code);
        }
      })
    );
    
    if (i + batchSize < codes.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return { success, failed };
}

export async function markFundAsHolding(code: string, isHolding: boolean): Promise<void> {
  try {
    const fund = await db.fundCache.where('code').equals(code).first();
    if (fund) {
      await db.fundCache.update(fund.id, {
        isHolding: isHolding,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('标记持仓失败:', error);
  }
}

// 获取基金名称（从API返回，不再需要预设映射）
function getFundNameByCode(code: string): string {
  return `基金${code}`;
}

export async function fetchMultipleFundsNav(fundCodes: string[]): Promise<FundApiData[]> {
  const results: FundApiData[] = [];
  
  const batchSize = 5;
  for (let i = 0; i < fundCodes.length; i += batchSize) {
    const batch = fundCodes.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(code => fetchFundNav(code))
    );
    
    batchResults.forEach(data => {
      if (data) results.push(data);
    });
    
    if (i + batchSize < fundCodes.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

// ============================================
// 历史净值数据
// ============================================

export interface FundHistoryData {
  date: string;        // 日期
  nav: number;         // 单位净值
  accNav: number;      // 累计净值
  dailyChangeRate: number; // 日涨跌幅
  buyStatus: string;   // 申购状态
  sellStatus: string;  // 赎回状态
}

/**
 * 获取基金历史净值
 * @param fundCode 基金代码
 * @param pageSize 获取条数（默认20）
 * @param pageIndex 页码（从1开始）
 * @param startDate 起始日期（YYYY-MM-DD格式，可选）
 */
export async function fetchFundHistory(
  fundCode: string, 
  pageSize: number = 20,
  pageIndex: number = 1,
  startDate: string = ''
): Promise<FundHistoryData[]> {
  try {
    const url = `${API_BASE}/api/history/f10/lsjz?fundCode=${fundCode}&pageIndex=${pageIndex}&pageSize=${pageSize}&startDate=${startDate}&endDate=&_=${Date.now()}`;
    console.log('[API] fetchFundHistory URL:', url);
    
    const response = await fetch(url);
    console.log('[API] Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    console.log('[API] Response Data is null:', result.Data === null);
    console.log('[API] Response has LSJZList:', result.Data?.LSJZList ? 'yes (' + result.Data.LSJZList.length + ')' : 'no');
    
    if (!result.Data || !result.Data.LSJZList) {
      console.log('[API] No data returned');
      return [];
    }
    
    const mapped = result.Data.LSJZList
      .filter((item: any) => item.FSRQ && item.DWJZ) // 过滤无效数据
      .map((item: any) => ({
        date: item.FSRQ,
        nav: parseFloat(item.DWJZ),
        accNav: parseFloat(item.LJJZ || '0'),
        dailyChangeRate: parseFloat(item.JZZZL || '0'),
        buyStatus: item.SGZT || '-',
        sellStatus: item.SHZT || '-',
      }));
    
    console.log('[API] Mapped data:', mapped.length, 'records');
    return mapped;
  } catch (error) {
    console.error(`[API] 获取历史净值失败 ${fundCode}:`, error);
    return [];
  }
}

export function clearNavCache(): void {
  navCache.clear();
  valuationCache = null;
}
