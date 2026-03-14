import type { FundApiData, MarketValuationData, FundSearchResult as FundSearchResultType } from '../types';
import type { FundCacheItem } from '../db';
import { db } from '../db';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ============================================
// 配置
// ============================================

// 检测运行环境
const isGitHubPages = typeof window !== 'undefined' && window.location.hostname.includes('github.io');

// API基础URL
const API_BASE = import.meta.env.DEV 
  ? 'http://localhost:3001'  // 开发环境使用代理服务器
  : isGitHubPages 
    ? 'https://fundmobapi.eastmoney.com'  // GitHub Pages 直接调用（可能有CORS限制）
    : '';  // 其他生产环境使用相对路径

// 预置基金数据（GitHub Pages 环境使用）
const PRESET_FUNDS: FundSearchResult[] = [
  { code: '000001', name: '华夏成长混合', type: '混合型' },
  { code: '000003', name: '中海可转债债券A', type: '债券型' },
  { code: '000008', name: '嘉实中证500ETF联接A', type: '股票指数' },
  { code: '000011', name: '华夏大盘精选混合A', type: '混合型' },
  { code: '000021', name: '华夏优势增长混合', type: '混合型' },
  { code: '000032', name: '易方达信用债债券A', type: '债券型' },
  { code: '000051', name: '鹏华价值优势混合', type: '混合型' },
  { code: '000100', name: '富国中证红利指数增强A', type: '股票指数' },
  { code: '000171', name: '易方达裕丰回报债券', type: '债券型' },
  { code: '000217', name: '华安黄金易ETF联接A', type: '商品型' },
  { code: '000248', name: '汇添富中证主要消费ETF联接A', type: '股票指数' },
  { code: '000478', name: '建信中证500指数增强A', type: '股票指数' },
  { code: '000592', name: '建信改革红利股票A', type: '股票型' },
  { code: '000614', name: '华安纳斯达克100指数', type: 'QDII' },
  { code: '000834', name: '易方达沪深300ETF联接A', type: '股票指数' },
  { code: '000905', name: '鹏华丰禄债券', type: '债券型' },
  { code: '001051', name: '华夏上证50ETF联接A', type: '股票指数' },
  { code: '001180', name: '广发中证全指医药卫生ETF联接A', type: '股票指数' },
  { code: '001214', name: '华泰柏瑞中证500ETF联接A', type: '股票指数' },
  { code: '001469', name: '广发中证全指金融地产ETF联接A', type: '股票指数' },
  { code: '001556', name: '天弘中证500指数增强A', type: '股票指数' },
  { code: '001595', name: '天弘中证银行ETF联接A', type: '股票指数' },
  { code: '001630', name: '天弘中证食品饮料ETF联接A', type: '股票指数' },
  { code: '001717', name: '工银瑞信前沿医疗股票A', type: '股票型' },
  { code: '002001', name: '华夏回报混合A', type: '混合型' },
  { code: '002077', name: '浙商聚盈信用债债券A', type: '债券型' },
  { code: '002216', name: '广发中债7-10年国开债指数A', type: '债券指数' },
  { code: '002237', name: '中银惠利纯债半年定期开放债券', type: '债券型' },
  { code: '002421', name: '华安创业板指数增强A', type: '股票指数' },
  { code: '002656', name: '南方创业板ETF联接A', type: '股票指数' },
  { code: '002903', name: '广发中证500ETF联接A', type: '股票指数' },
  { code: '002987', name: '广发沪深300ETF联接A', type: '股票指数' },
  { code: '003318', name: '景顺长城中证500行业中性低波动指数', type: '股票指数' },
  { code: '003376', name: '广发中证全指汽车指数A', type: '股票指数' },
  { code: '003765', name: '广发中证全指信息技术ETF联接A', type: '股票指数' },
  { code: '003948', name: '建信纳斯达克100指数A', type: 'QDII' },
  { code: '004346', name: '华夏中证500指数增强A', type: '股票指数' },
  { code: '004752', name: '广发中证传媒ETF联接A', type: '股票指数' },
  { code: '004997', name: '广发中证基建工程ETF联接A', type: '股票指数' },
  { code: '005223', name: '广发中证全指证券公司ETF联接A', type: '股票指数' },
  { code: '005827', name: '易方达蓝筹精选混合', type: '混合型' },
  { code: '006104', name: '鹏华安益增强混合', type: '混合型' },
  { code: '006486', name: '广发中证1000指数A', type: '股票指数' },
  { code: '007380', name: '华宝科技先锋混合', type: '混合型' },
  { code: '008888', name: '华夏中证5G通信主题ETF联接A', type: '股票指数' },
  { code: '009314', name: '广发中证央企创新驱动ETF联接A', type: '股票指数' },
  { code: '009929', name: '华夏创新前沿股票', type: '股票型' },
  { code: '010169', name: '华泰柏瑞中证光伏产业ETF联接A', type: '股票指数' },
  { code: '010363', name: '易方达中证新能源ETF联接A', type: '股票指数' },
  { code: '010448', name: '天弘中证光伏产业指数A', type: '股票指数' },
  { code: '011103', name: '易方达长期价值混合', type: '混合型' },
  { code: '011530', name: '富国沪深300指数增强A', type: '股票指数' },
  { code: '012348', name: '广发中证稀有金属ETF联接A', type: '股票指数' },
  { code: '012584', name: '华安中证新能源汽车ETF联接A', type: '股票指数' },
  { code: '012696', name: '汇添富中证芯片产业指数增强A', type: '股票指数' },
  { code: '012860', name: '嘉实中证稀土产业ETF联接A', type: '股票指数' },
  { code: '013816', name: '易方达中证人工智能主题ETF联接A', type: '股票指数' },
  { code: '015671', name: '嘉实中证高端装备细分50ETF联接A', type: '股票指数' },
  { code: '016858', name: '广发中证上海环交所碳中和ETF联接A', type: '股票指数' },
  { code: '501009', name: '汇添富中证生物科技指数A', type: '股票指数' },
  { code: '501010', name: '汇添富中证精准医疗指数A', type: '股票指数' },
  { code: '501050', name: '华夏上证50ETF联接A', type: '股票指数' },
  { code: '501090', name: '华宝中证消费龙头指数A', type: '股票指数' },
  { code: '510050', name: '华夏上证50ETF', type: 'ETF' },
  { code: '510300', name: '华泰柏瑞沪深300ETF', type: 'ETF' },
  { code: '510310', name: '易方达沪深300ETF', type: 'ETF' },
  { code: '510330', name: '华夏沪深300ETF', type: 'ETF' },
  { code: '510500', name: '南方中证500ETF', type: 'ETF' },
  { code: '510880', name: '华泰柏瑞红利ETF', type: 'ETF' },
  { code: '511010', name: '国泰上证10年期国债ETF', type: 'ETF' },
  { code: '512000', name: '华宝中证全指证券公司ETF', type: 'ETF' },
  { code: '512010', name: '易方达沪深300医药卫生ETF', type: 'ETF' },
  { code: '512100', name: '南方中证1000ETF', type: 'ETF' },
  { code: '512170', name: '华宝中证医疗ETF', type: 'ETF' },
  { code: '512200', name: '易方达中证全指房地产ETF', type: 'ETF' },
  { code: '512480', name: '国联安中证全指半导体ETF', type: 'ETF' },
  { code: '512660', name: '国泰中证军工ETF', type: 'ETF' },
  { code: '512690', name: '鹏华中证酒ETF', type: 'ETF' },
  { code: '512800', name: '华宝中证银行ETF', type: 'ETF' },
  { code: '512880', name: '国泰中证全指证券公司ETF', type: 'ETF' },
  { code: '512980', name: '广发中证传媒ETF', type: 'ETF' },
  { code: '513050', name: '易方达中证海外中国互联网50ETF', type: 'QDII-ETF' },
  { code: '513100', name: '国泰纳斯达克100ETF', type: 'QDII-ETF' },
  { code: '513130', name: '华泰柏瑞南方东英恒生科技ETF', type: 'QDII-ETF' },
  { code: '513180', name: '华夏恒生科技ETF', type: 'QDII-ETF' },
  { code: '513300', name: '纳斯达克ETF', type: 'QDII-ETF' },
  { code: '513500', name: '博时标普500ETF', type: 'QDII-ETF' },
  { code: '515030', name: '华夏中证新能源汽车ETF', type: 'ETF' },
  { code: '515050', name: '华夏中证5G通信主题ETF', type: 'ETF' },
  { code: '515700', name: '易方达中证光伏产业ETF', type: 'ETF' },
  { code: '518880', name: '华安黄金易ETF', type: 'ETF' },
  { code: '159601', name: '华夏MSCI中国A50互联互通ETF', type: 'ETF' },
  { code: '159915', name: '易方达创业板ETF', type: 'ETF' },
  { code: '159928', name: '汇添富中证主要消费ETF', type: 'ETF' },
  { code: '159938', name: '广发中证全指医药卫生ETF', type: 'ETF' },
  { code: '159939', name: '广发中证全指信息技术ETF', type: 'ETF' },
  { code: '159940', name: '广发中证全指金融地产ETF', type: 'ETF' },
  { code: '159949', name: '华安创业板50ETF', type: 'ETF' },
  { code: '159952', name: '广发创业板ETF', type: 'ETF' },
  { code: '159967', name: '华夏创成长ETF', type: 'ETF' },
  { code: '159981', name: '建信易盛能源化工期货ETF', type: 'ETF' },
  { code: '159985', name: '华夏饲料豆粕期货ETF', type: 'ETF' },
  { code: '159990', name: '天弘中证中美互联网指数A', type: 'QDII' },
  { code: '160119', name: '南方中证500ETF联接A', type: '股票指数' },
  { code: '160706', name: '嘉实沪深300指数A', type: '股票指数' },
  { code: '161017', name: '富国中证500指数增强', type: '股票指数' },
  { code: '161039', name: '富国中证1000指数增强A', type: '股票指数' },
  { code: '161725', name: '招商中证白酒指数A', type: '股票指数' },
  { code: '163406', name: '兴全合润混合', type: '混合型' },
  { code: '164906', name: '交银中证海外中国互联网指数', type: 'QDII' },
  { code: '270002', name: '广发稳健增长混合A', type: '混合型' },
  { code: '377016', name: '摩根士丹利华鑫资源优选混合', type: '混合型' },
  { code: '519671', name: '银河沪深300价值指数A', type: '股票指数' },
  { code: '519732', name: '交银定期支付双息平衡混合', type: '混合型' },
  { code: '519915', name: '富国消费主题混合A', type: '混合型' },
  { code: '540003', name: '汇丰晋信动态策略混合A', type: '混合型' },
  { code: '540006', name: '汇丰晋信大盘股票A', type: '股票型' },
  { code: '550001', name: '信诚四季红混合', type: '混合型' },
];

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
 * 优先使用 Supabase Edge Function，解决 CORS 问题
 */
async function fetchFromEastMoney(fundCode: string): Promise<FundApiData | null> {
  try {
    // 优先使用 Supabase Edge Function
    if (isSupabaseConfigured()) {
      console.log('[API] 使用 Supabase Edge Function:', fundCode);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const edgeUrl = `${supabaseUrl}/functions/v1/fund-nav/${fundCode}`;
      
      const response = await fetch(edgeUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Edge Function 返回错误: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      return {
        code: data.code,
        name: data.name,
        nav: data.nav,
        navDate: data.navDate,
        dailyChange: data.estimateNav ? data.estimateNav - data.nav : 0,
        dailyChangeRate: data.estimateRate || 0,
      };
    }
    
    // 降级：直接调用东方财富API（可能有CORS问题）
    const url = `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo?pageIndex=1&pageSize=500&appType=ttjj&plat=Android&product=EFund&Version=1&deviceid=4252d0ac69bb50&Fcodes=${fundCode}`;
    console.log('[API] 直接调用:', url);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.ErrCode !== 0 || !result.Datas || result.Datas.length === 0) {
      throw new Error(result.ErrMsg || 'API返回错误或无数据');
    }

    const data = result.Datas[0];
    const dailyChangeRate = parseFloat(data.NAVCHGRT || '0');
    const nav = parseFloat(data.NAV || '0');
    const dailyChange = nav * dailyChangeRate / 100;

    return {
      code: fundCode,
      name: data.SHORTNAME || getFundNameByCode(fundCode),
      nav: Number(nav.toFixed(4)),
      navDate: data.PDATE || data.NAVDATE || new Date().toISOString().split('T')[0],
      dailyChange: Number(dailyChange.toFixed(4)),
      dailyChangeRate: Number(dailyChangeRate.toFixed(2)),
    };
  } catch (error) {
    console.error(`[API] 获取基金净值失败 ${fundCode}:`, error);
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
  
  // 1. 先尝试从本地缓存搜索
  const localResults = await searchLocalByCode(trimmedCode);
  
  // 2. 本地有结果，先返回本地结果
  if (localResults.length > 0) {
    return localResults;
  }
  
  // 3. 本地没有，尝试从API搜索
  // GitHub Pages 环境下使用预置数据
  if (isGitHubPages) {
    const presetResults = PRESET_FUNDS.filter(f => 
      f.code.toLowerCase().startsWith(trimmedCode.toLowerCase())
    );
    if (presetResults.length > 0) {
      await saveFundCache(presetResults);
    }
    return presetResults.slice(0, 10);
  }
  
  try {
    const apiResults = await searchFromEastMoney(trimmedCode);
    // 过滤只保留代码前缀匹配的结果（如输入000，匹配000001，不匹配100000）
    const filteredResults = apiResults.filter(f => 
      f.code.toLowerCase().startsWith(trimmedCode.toLowerCase())
    );
    
    // 保存到本地缓存
    if (filteredResults.length > 0) {
      await saveFundCache(filteredResults);
    }
    
    return filteredResults.slice(0, 10);
  } catch (error) {
    console.error('[Search] API搜索失败，已返回本地缓存结果:', error);
    // API失败时返回空（本地已经搜过了）
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
  
  // 1. 先尝试从本地缓存搜索
  const localResults = await searchLocalByName(trimmedName);
  
  // 2. 本地有结果，先返回本地结果
  if (localResults.length > 0) {
    return localResults;
  }
  
  // 3. 本地没有，尝试从API搜索
  // GitHub Pages 环境下使用预置数据
  if (isGitHubPages) {
    const presetResults = PRESET_FUNDS.filter(f => 
      f.name.toLowerCase().includes(trimmedName.toLowerCase())
    );
    if (presetResults.length > 0) {
      await saveFundCache(presetResults);
    }
    return presetResults.slice(0, 10);
  }
  
  try {
    const apiResults = await searchFromEastMoney(trimmedName);
    // 过滤只保留名称匹配的结果
    const filteredResults = apiResults.filter(f => 
      f.name.toLowerCase().includes(trimmedName.toLowerCase())
    );
    
    // 保存到本地缓存
    if (filteredResults.length > 0) {
      await saveFundCache(filteredResults);
    }
    
    return filteredResults.slice(0, 10);
  } catch (error) {
    console.error('[Search] API搜索失败，已返回本地缓存结果:', error);
    // API失败时返回空（本地已经搜过了）
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
    // 优先使用 Supabase Edge Function
    if (isSupabaseConfigured()) {
      console.log('[Search] 使用 Supabase Edge Function');
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const edgeUrl = `${supabaseUrl}/functions/v1/fund-search?keyword=${encodeURIComponent(keyword)}`;
      
      const response = await fetch(edgeUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Edge Function 返回错误: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      
      return data || [];
    }
    
    // 降级：直接调用东方财富API（可能有CORS问题）
    const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(keyword)}&type=14&count=100`;
    console.log('[Search] 直接调用 API:', url);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result && result.QuotationCodeTable && result.QuotationCodeTable.Data) {
      const data = result.QuotationCodeTable.Data;
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
    console.error('[API] 基金搜索失败:', error);
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
  // GitHub Pages 环境下使用模拟数据
  if (isGitHubPages) {
    console.log('[GitHub Pages] 使用模拟历史净值数据:', fundCode);
    return generateMockHistoryData(fundCode, pageSize);
  }
  
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

/**
 * 生成模拟历史净值数据（GitHub Pages 环境使用）
 */
function generateMockHistoryData(fundCode: string, days: number): FundHistoryData[] {
  const result: FundHistoryData[] = [];
  const baseNav = 1.0 + Math.random() * 2;
  let currentNav = baseNav;
  
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // 跳过周末
    if (date.getDay() === 0 || date.getDay() === 6) {
      continue;
    }
    
    const changeRate = (Math.random() - 0.5) * 4; // -2% 到 +2%
    currentNav = currentNav * (1 + changeRate / 100);
    
    result.push({
      date: date.toISOString().split('T')[0],
      nav: Number(currentNav.toFixed(4)),
      accNav: Number(currentNav.toFixed(4)),
      dailyChangeRate: Number(changeRate.toFixed(2)),
      buyStatus: '开放',
      sellStatus: '开放',
    });
  }
  
  return result;
}

export function clearNavCache(): void {
  navCache.clear();
  valuationCache = null;
}

// ============================================
// 批量获取基金历史净值（带缓存）- 用于收藏列表迷你图表
// ============================================

const HISTORY_CACHE_DAYS = 90; // 缓存3个月数据
const HISTORY_CACHE_VALID_MS = 24 * 60 * 60 * 1000; // 缓存24小时

export interface MiniHistoryPoint {
  date: string;
  nav: number;
}

/**
 * 获取基金历史净值（优先从缓存，缺失的调API）
 * @param fundCode 基金代码
 * @param days 获取天数（默认90天）
 */
export async function getFundHistoryWithCache(
  fundCode: string, 
  days: number = HISTORY_CACHE_DAYS
): Promise<MiniHistoryPoint[]> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    
    // 1. 从缓存读取
    const cachedData = await db.fundHistoryCache
      .where('code')
      .equals(fundCode)
      .filter(item => item.date >= cutoffStr)
      .toArray();
    
    // 检查缓存是否可用
    // 阈值：至少20条数据（约1个月），且缓存未过期
    const minExpectedPoints = 20; // 降低阈值，避免数据不足的基金频繁刷新
    const cacheAge = cachedData.length > 0 
      ? Date.now() - new Date(cachedData[0].updatedAt).getTime()
      : Infinity;
    
    // 缓存可用且未过期，直接返回
    if (cachedData.length >= minExpectedPoints && cacheAge < HISTORY_CACHE_VALID_MS) {
      console.log(`[HistoryCache] ${fundCode} 使用缓存，${cachedData.length}条，年龄${Math.round(cacheAge/60000)}分钟`);
      return cachedData
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(item => ({ date: item.date, nav: item.nav }));
    }
    
    // 2. 缓存不足或过期，从API获取
    console.log(`[HistoryCache] ${fundCode} 缓存不足(${cachedData.length}条)或过期，从API获取`);
    const apiData = await fetchFundHistoryBatch(fundCode, days);
    
    // 3. 保存到缓存
    if (apiData.length > 0) {
      await saveHistoryCache(fundCode, apiData);
    }
    
    return apiData.map(item => ({ date: item.date, nav: item.nav }));
  } catch (error) {
    console.error(`[HistoryCache] 获取失败 ${fundCode}:`, error);
    return [];
  }
}

/**
 * 批量获取多只基金的历史净值
 * @param fundCodes 基金代码数组
 * @param days 获取天数
 */
export async function batchGetFundHistory(
  fundCodes: string[],
  days: number = HISTORY_CACHE_DAYS
): Promise<Record<string, MiniHistoryPoint[]>> {
  const result: Record<string, MiniHistoryPoint[]> = {};
  
  // 串行获取，避免并发请求过多
  for (const code of fundCodes) {
    result[code] = await getFundHistoryWithCache(code, days);
    // 小延迟，避免请求过快
    if (fundCodes.length > 3) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  
  return result;
}

/**
 * 批量获取历史净值数据（内部函数，分页加载）
 * 注意：东方财富API每页固定返回20条
 */
async function fetchFundHistoryBatch(
  fundCode: string, 
  days: number
): Promise<FundHistoryData[]> {
  const targetSize = days;
  let allData: FundHistoryData[] = [];
  let pageIndex = 1;
  const maxPages = 10;
  
  // 分页加载（每页20条）
  while (allData.length < targetSize && pageIndex <= maxPages) {
    const pageData = await fetchFundHistory(fundCode, 20, pageIndex, '');
    
    if (pageData.length === 0) break;
    
    allData = [...allData, ...pageData];
    
    // API固定返回20条，如果少于20条说明是最后一页
    if (pageData.length < 20) break;
    pageIndex++;
  }
  
  // 按时间正序排列
  allData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // 截取目标数量
  return allData.slice(-targetSize);
}

/**
 * 保存历史净值到缓存
 */
async function saveHistoryCache(
  fundCode: string, 
  data: FundHistoryData[]
): Promise<void> {
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
  
  // 使用 bulkPut 批量插入/更新
  await db.fundHistoryCache.bulkPut(cacheItems);
  console.log(`[HistoryCache] ${fundCode} 已缓存 ${cacheItems.length}条`);
}

/**
 * 清理过期的历史缓存
 */
export async function cleanHistoryCache(): Promise<void> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - HISTORY_CACHE_DAYS - 30); // 保留多30天
  const cutoffStr = cutoffDate.toISOString().split('T')[0];
  
  await db.fundHistoryCache.where('date').below(cutoffStr).delete();
  console.log('[HistoryCache] 已清理过期数据');
}
