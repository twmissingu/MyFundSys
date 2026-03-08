import type { FundApiData, MarketValuationData } from '../types';

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

    // 通过代理从东方财富获取（开发环境）
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
 * 从东方财富网获取基金净值（通过代理）
 */
async function fetchFromEastMoney(fundCode: string): Promise<FundApiData | null> {
  try {
    // 使用代理地址（仅开发环境有效）
    const url = import.meta.env.DEV 
      ? `/api/eastmoney/FundMNewApi/FundMNFInfo?plat=Android&appType=ttjj&product=EFund&Version=1&deviceid=123456&FCode=${fundCode}`
      : `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo?plat=Android&appType=ttjj&product=EFund&Version=1&deviceid=123456&FCode=${fundCode}`;
    
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.ErrCode !== 0 || !result.Datas) {
      throw new Error(result.ErrMsg || 'API返回错误');
    }

    const data = result.Datas;
    
    // 解析涨跌幅
    const dailyChangeRate = parseFloat(data.RZDF || '0');
    const nav = parseFloat(data.NAV || '0');
    const dailyChange = nav * dailyChangeRate / 100;

    return {
      code: fundCode,
      name: data.SHORTNAME || getFundNameByCode(fundCode),
      nav: Number(nav.toFixed(4)),
      navDate: data.NAVDATE || new Date().toISOString().split('T')[0],
      dailyChange: Number(dailyChange.toFixed(4)),
      dailyChangeRate: Number(dailyChangeRate.toFixed(2)),
    };
  } catch (error) {
    console.error(`东方财富API获取失败 ${fundCode}:`, error);
    return null;
  }
}

// ============================================
// 市场估值数据
// ============================================

// 缓存估值数据
let valuationCache: { data: MarketValuationData; timestamp: number } | null = null;
const VALUATION_CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存（数据每2小时更新一次）

/**
 * 获取市场估值数据
 * 优先从本地JSON文件读取（由GitHub Actions定时更新）
 */
export async function fetchMarketValuation(): Promise<MarketValuationData> {
  try {
    // 检查内存缓存
    if (valuationCache && Date.now() - valuationCache.timestamp < VALUATION_CACHE_DURATION) {
      return valuationCache.data;
    }

    // 从本地JSON文件读取（GitHub Pages部署的数据）
    const data = await fetchFromLocalJson();
    if (data) {
      valuationCache = { data, timestamp: Date.now() };
      return data;
    }

    // 本地文件读取失败，尝试直接API（开发环境）
    if (import.meta.env.DEV) {
      const apiData = await fetchFromQieman();
      if (apiData) {
        valuationCache = { data: apiData, timestamp: Date.now() };
        return apiData;
      }
    }

    throw new Error('无法获取估值数据');
  } catch (error) {
    console.error('获取市场估值失败:', error);
    // 返回默认值并标记错误
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

/**
 * 从本地JSON文件读取估值数据
 * GitHub Actions每2小时自动更新此文件
 */
async function fetchFromLocalJson(): Promise<MarketValuationData | null> {
  try {
    // GitHub Pages 路径
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

/**
 * 从且慢API获取估值数据（开发环境使用）
 */
async function fetchFromQieman(): Promise<MarketValuationData | null> {
  try {
    const url = import.meta.env.DEV 
      ? '/api/qieman/api/v1/idx-eval/latest'
      : 'https://qieman.com/api/v1/idx-eval/latest';
    
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (result && result.data && Array.isArray(result.data)) {
      const hs300 = result.data.find((item: any) => 
        item.name?.includes('沪深300') || item.code === '000300'
      );
      
      if (hs300) {
        return {
          date: new Date().toISOString().split('T')[0],
          pe: Number((hs300.pe || hs300.peRatio || 0).toFixed(2)),
          pb: Number((hs300.pb || hs300.pbRatio || 0).toFixed(2)),
          percentile: Number(((hs300.percentile || hs300.pePercentile || 30) / 100).toFixed(4)),
          temperature: Math.round(hs300.temperature || hs300.score || 30),
          source: 'qieman',
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('且慢API获取失败:', error);
    return null;
  }
}

// 获取基金名称
function getFundNameByCode(code: string): string {
  const names: Record<string, string> = {
    '510300': '沪深300ETF', '510500': '中证500ETF', '510050': '上证50ETF',
    '159915': '创业板ETF', '159901': '深证100ETF', '510880': '红利ETF',
    '512010': '医药ETF', '512170': '医疗ETF', '512480': '半导体ETF',
    '515030': '新能源车ETF', '515700': '光伏ETF', '512660': '军工ETF',
    '512000': '券商ETF', '512800': '银行ETF', '512200': '地产ETF',
    '159928': '消费ETF', '512690': '酒ETF', '159995': '芯片ETF',
    '515050': '5GETF', '512980': '传媒ETF', '510900': 'H股ETF',
    '159920': '恒生ETF', '513050': '中概互联网ETF', '513130': '恒生科技ETF',
    '513180': '恒生医疗ETF', '513100': '纳指ETF', '513500': '标普500ETF',
    '159941': '纳斯达克ETF', '513300': '纳斯达克100ETF', '518880': '黄金ETF',
    '159985': '豆粕ETF', '159981': '能源化工ETF', '511010': '国债ETF',
    '511220': '城投债ETF', '511260': '十年国债ETF',
  };
  return names[code] || `基金${code}`;
}

// 批量获取基金净值
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

// 清空缓存
export function clearNavCache(): void {
  navCache.clear();
  valuationCache = null;
}
