/**
 * 技术指标计算工具
 * 支持MACD、KDJ计算
 */

export interface HistoryPoint {
  date: string;
  nav: number;
}

export interface MACDPoint {
  date: string;
  dif: number;
  dea: number;
  macd: number;
}

export interface KDJPoint {
  date: string;
  k: number;
  d: number;
  j: number;
}

/**
 * 计算EMA（指数移动平均）
 * @param data 数据数组
 * @param n 周期
 */
function calculateEMA(data: number[], n: number): number[] {
  const ema: number[] = [];
  const alpha = 2 / (n + 1);
  
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      ema.push(data[0]);
    } else {
      ema.push(alpha * data[i] + (1 - alpha) * ema[i - 1]);
    }
  }
  
  return ema;
}

/**
 * 计算MACD指标
 * @param data 历史净值数据（按日期从早到晚排序）
 * @param fastPeriod 快线周期（默认12）
 * @param slowPeriod 慢线周期（默认26）
 * @param signalPeriod 信号线周期（默认9）
 */
export function calculateMACD(
  data: HistoryPoint[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDPoint[] {
  if (data.length < slowPeriod + signalPeriod) {
    return [];
  }
  
  const prices = data.map(d => d.nav);
  const ema12 = calculateEMA(prices, fastPeriod);
  const ema26 = calculateEMA(prices, slowPeriod);
  
  // DIF = EMA12 - EMA26
  const dif = ema12.map((v, i) => v - ema26[i]);
  
  // DEA = EMA(DIF, 9)
  const dea = calculateEMA(dif, signalPeriod);
  
  // MACD = (DIF - DEA) * 2
  const macd = dif.map((v, i) => (v - dea[i]) * 2);
  
  return data.map((d, i) => ({
    date: d.date,
    dif: Number(dif[i].toFixed(4)),
    dea: Number(dea[i].toFixed(4)),
    macd: Number(macd[i].toFixed(4)),
  }));
}

/**
 * 计算KDJ指标
 * @param data 历史净值数据（按日期从早到晚排序）
 * @param n 周期（默认9）
 * @param m1 K值平滑系数（默认3）
 * @param m2 D值平滑系数（默认3）
 */
export function calculateKDJ(
  data: HistoryPoint[],
  n: number = 9,
  m1: number = 3,
  m2: number = 3
): KDJPoint[] {
  if (data.length < n) {
    return [];
  }
  
  const prices = data.map(d => d.nav);
  const kdj: KDJPoint[] = [];
  let k = 50;
  let d = 50;
  
  for (let i = 0; i < data.length; i++) {
    if (i < n - 1) {
      // 数据不足n天，使用默认值
      kdj.push({ date: data[i].date, k: 50, d: 50, j: 50 });
      continue;
    }
    
    // 计算n日内的最高价和最低价
    const periodPrices = prices.slice(i - n + 1, i + 1);
    const highest = Math.max(...periodPrices);
    const lowest = Math.min(...periodPrices);
    const currentPrice = prices[i];
    
    // RSV = (当日收盘价 - n日内最低价) / (n日内最高价 - n日内最低价) * 100
    let rsv = 0;
    if (highest !== lowest) {
      rsv = ((currentPrice - lowest) / (highest - lowest)) * 100;
    }
    
    // K = (2/3) * 昨日K + (1/3) * 当日RSV
    // D = (2/3) * 昨日D + (1/3) * 当日K
    // J = 3K - 2D
    k = ((m1 - 1) * k + rsv) / m1;
    d = ((m2 - 1) * d + k) / m2;
    const j = 3 * k - 2 * d;
    
    kdj.push({
      date: data[i].date,
      k: Number(k.toFixed(2)),
      d: Number(d.toFixed(2)),
      j: Number(j.toFixed(2)),
    });
  }
  
  return kdj;
}

/**
 * 计算移动平均线MA
 * @param data 历史净值数据
 * @param period 周期
 */
export function calculateMA(data: HistoryPoint[], period: number): { date: string; value: number }[] {
  const result: { date: string; value: number }[] = [];
  const prices = data.map(d => d.nav);
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push({ date: data[i].date, value: prices[i] });
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push({ date: data[i].date, value: Number((sum / period).toFixed(4)) });
    }
  }
  
  return result;
}

/**
 * 过滤最近N天的数据
 * @param data 历史数据（按日期从新到旧排序）
 * @param days 天数
 */
export function filterRecentData<T extends { date: string }>(data: T[], days: number): T[] {
  if (!data || data.length === 0) return [];
  if (days >= 9999) return data;
  
  // 按日期排序（从新到旧）
  const sorted = [...data].sort((a, b) => {
    const dateA = new Date(a.date.replace(/-/g, '/'));
    const dateB = new Date(b.date.replace(/-/g, '/'));
    return dateB.getTime() - dateA.getTime();
  });
  
  const filtered = sorted.slice(0, days);
  
  // 返回按日期从早到晚排序的数据
  return filtered.sort((a, b) => {
    const dateA = new Date(a.date.replace(/-/g, '/'));
    const dateB = new Date(b.date.replace(/-/g, '/'));
    return dateA.getTime() - dateB.getTime();
  });
}

/**
 * 时间区间类型
 */
export type TimeRange = '1m' | '3m' | '6m' | '1y' | 'all';

/**
 * 获取时间区间对应的天数
 */
export function getDaysFromRange(range: TimeRange): number {
  const map: Record<TimeRange, number> = {
    '1m': 22,   // 约1个月交易日
    '3m': 66,   // 约3个月交易日
    '6m': 132,  // 约6个月交易日
    '1y': 250,  // 约1年交易日
    'all': 9999, // 全部
  };
  return map[range];
}

/**
 * 格式化日期显示
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * MACD参数配置
 */
export interface MACDParams {
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
  label: string;
}

/**
 * KDJ参数配置
 */
export interface KDJParams {
  n: number;
  m1: number;
  m2: number;
  label: string;
}

/**
 * 根据时间范围获取MACD参数
 * 短周期使用更灵敏的参数
 */
export function getMACDParams(range: TimeRange): MACDParams {
  switch (range) {
    case '1m':
      // 1个月：使用超短周期参数 (5, 10, 5)，只需10个数据点（约1个月有20个交易日，足够）
      return { fastPeriod: 5, slowPeriod: 10, signalPeriod: 5, label: '超短(5,10,5)' };
    case '3m':
      // 3个月：使用短周期参数 (6, 13, 5)，只需13个数据点
      return { fastPeriod: 6, slowPeriod: 13, signalPeriod: 5, label: '短线(6,13,5)' };
    case '6m':
      // 6个月：使用平衡参数 (8, 17, 7)，只需17个数据点
      return { fastPeriod: 8, slowPeriod: 17, signalPeriod: 7, label: '平衡(8,17,7)' };
    case '1y':
    case 'all':
    default:
      // 长期：使用标准参数 (12, 26, 9)，需要26个数据点
      return { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, label: '标准(12,26,9)' };
  }
}

/**
 * 根据时间范围获取KDJ参数
 * 短周期使用更灵敏的参数
 */
export function getKDJParams(range: TimeRange): KDJParams {
  switch (range) {
    case '1m':
      // 1个月：使用超短周期参数 (3, 3, 3)，只需3个数据点
      return { n: 3, m1: 3, m2: 3, label: '超短(3,3,3)' };
    case '3m':
      // 3个月：使用短周期参数 (5, 3, 3)，只需5个数据点
      return { n: 5, m1: 3, m2: 3, label: '短线(5,3,3)' };
    case '6m':
      // 6个月：使用平衡参数 (7, 3, 3)，只需7个数据点
      return { n: 7, m1: 3, m2: 3, label: '平衡(7,3,3)' };
    case '1y':
    case 'all':
    default:
      // 长期：使用标准参数 (9, 3, 3)，需要9个数据点
      return { n: 9, m1: 3, m2: 3, label: '标准(9,3,3)' };
  }
}
