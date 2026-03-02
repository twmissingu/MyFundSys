import type { FundApiData, MarketValuationData } from '../types';

// 天天基金网API - 获取基金净值
export async function fetchFundNav(fundCode: string): Promise<FundApiData | null> {
  try {
    // 使用天天基金网API（需要CORS代理）
    const url = `https://fundgz.1234567.com.cn/js/${fundCode}.js?rt=${Date.now()}`;
    
    // 由于浏览器CORS限制，这里使用模拟数据
    // 实际部署时需要通过后端代理或使用支持CORS的API
    return await mockFetchFundNav(fundCode);
  } catch (error) {
    console.error('获取基金净值失败:', error);
    return null;
  }
}

// 模拟获取基金净值（实际使用时替换为真实API）
async function mockFetchFundNav(fundCode: string): Promise<FundApiData> {
  // 模拟延迟
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // 生成模拟数据
  const baseNav = getBaseNavByCode(fundCode);
  const dailyChange = (Math.random() - 0.5) * 0.1;
  const dailyChangeRate = (dailyChange / baseNav) * 100;
  
  return {
    code: fundCode,
    name: getFundNameByCode(fundCode),
    nav: Number((baseNav + dailyChange).toFixed(4)),
    navDate: new Date().toISOString().split('T')[0],
    dailyChange: Number(dailyChange.toFixed(4)),
    dailyChangeRate: Number(dailyChangeRate.toFixed(2)),
  };
}

// 获取基金基础净值（模拟）
function getBaseNavByCode(code: string): number {
  const baseNavs: Record<string, number> = {
    '510300': 3.85,
    '510500': 5.62,
    '510050': 2.45,
    '159915': 1.98,
    '159901': 2.75,
    '510880': 2.95,
    '512010': 0.85,
    '512170': 0.65,
    '512480': 1.25,
    '515030': 1.45,
    '515700': 1.15,
    '512660': 1.35,
    '512000': 0.95,
    '512800': 1.05,
    '512200': 0.75,
    '159928': 2.15,
    '512690': 0.55,
    '159995': 1.85,
    '515050': 1.05,
    '512980': 0.95,
    '510900': 1.25,
    '159920': 1.35,
    '513050': 1.15,
    '513130': 0.85,
    '513180': 0.65,
    '513100': 4.25,
    '513500': 3.15,
    '159941': 3.85,
    '513300': 4.55,
    '518880': 3.95,
    '159985': 2.25,
    '159981': 1.75,
    '511010': 105.25,
    '511220': 102.35,
    '511260': 108.45,
  };
  return baseNavs[code] || 1.0;
}

// 获取基金名称（模拟）
function getFundNameByCode(code: string): string {
  const names: Record<string, string> = {
    '510300': '沪深300ETF',
    '510500': '中证500ETF',
    '510050': '上证50ETF',
    '159915': '创业板ETF',
    '159901': '深证100ETF',
    '510880': '红利ETF',
    '512010': '医药ETF',
    '512170': '医疗ETF',
    '512480': '半导体ETF',
    '515030': '新能源车ETF',
    '515700': '光伏ETF',
    '512660': '军工ETF',
    '512000': '券商ETF',
    '512800': '银行ETF',
    '512200': '地产ETF',
    '159928': '消费ETF',
    '512690': '酒ETF',
    '159995': '芯片ETF',
    '515050': '5GETF',
    '512980': '传媒ETF',
    '510900': 'H股ETF',
    '159920': '恒生ETF',
    '513050': '中概互联网ETF',
    '513130': '恒生科技ETF',
    '513180': '恒生医疗ETF',
    '513100': '纳指ETF',
    '513500': '标普500ETF',
    '159941': '纳斯达克ETF',
    '513300': '纳斯达克100ETF',
    '518880': '黄金ETF',
    '159985': '豆粕ETF',
    '159981': '能源化工ETF',
    '511010': '国债ETF',
    '511220': '城投债ETF',
    '511260': '十年国债ETF',
  };
  return names[code] || `基金${code}`;
}

// 获取市场估值数据
export async function fetchMarketValuation(): Promise<MarketValuationData> {
  try {
    // 模拟获取市场估值数据
    // 实际使用时需要接入真实的估值API
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // 生成模拟估值数据
    const pe = 25 + Math.random() * 15; // PE 25-40
    const pb = 2 + Math.random() * 1.5; // PB 2-3.5
    const percentile = Math.random(); // 0-1
    const temperature = percentile * 100;
    
    return {
      date: new Date().toISOString().split('T')[0],
      pe: Number(pe.toFixed(2)),
      pb: Number(pb.toFixed(2)),
      percentile: Number(percentile.toFixed(4)),
      temperature: Math.round(temperature),
    };
  } catch (error) {
    console.error('获取市场估值失败:', error);
    return {
      date: new Date().toISOString().split('T')[0],
      pe: 30,
      pb: 2.5,
      percentile: 0.5,
      temperature: 50,
    };
  }
}

// 批量获取基金净值
export async function fetchMultipleFundsNav(fundCodes: string[]): Promise<FundApiData[]> {
  const results: FundApiData[] = [];
  for (const code of fundCodes) {
    const data = await fetchFundNav(code);
    if (data) {
      results.push(data);
    }
  }
  return results;
}
