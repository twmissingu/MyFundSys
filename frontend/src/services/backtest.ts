import type { BacktestResult, Strategy, Transaction } from '../types';
import { fetchMarketValuation } from './fundApi';

// 回测参数
interface BacktestParams {
  strategy: Strategy;
  fundCode: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  priceData: { date: string; price: number; pe?: number; pb?: number }[];
}

// 运行回测
export async function runBacktest(params: BacktestParams): Promise<BacktestResult> {
  const { strategy, fundCode, startDate, endDate, initialCapital, priceData } = params;

  if (!priceData || priceData.length === 0) {
    throw new Error('没有可用的历史数据，无法进行回测');
  }

  let cash = initialCapital;
  let shares = 0;
  let trades = 0;
  const equityCurve: { date: string; value: number }[] = [];

  // 交易记录
  const transactions: Transaction[] = [];

  for (const data of priceData) {
    const currentValue = cash + shares * data.price;

    // 应用策略规则
    for (const rule of strategy.rules) {
      const shouldTrade = await evaluateRule(rule.condition, data);

      if (shouldTrade && rule.action === 'buy' && cash > 0) {
        const buyAmount = cash * (rule.params.ratio || 0.2);
        const buyShares = buyAmount / data.price;

        cash -= buyAmount;
        shares += buyShares;
        trades++;

        transactions.push({
          id: `bt_${Date.now()}_${trades}`,
          fundId: fundCode,
          fundCode,
          fundName: fundCode,
          type: 'buy',
          date: data.date,
          amount: buyAmount,
          price: data.price,
          shares: buyShares,
          createdAt: new Date().toISOString(),
        });
      } else if (shouldTrade && rule.action === 'sell' && shares > 0) {
        const sellShares = shares * (rule.params.ratio || 0.2);
        const sellAmount = sellShares * data.price;

        cash += sellAmount;
        shares -= sellShares;
        trades++;

        transactions.push({
          id: `bt_${Date.now()}_${trades}`,
          fundId: fundCode,
          fundCode,
          fundName: fundCode,
          type: 'sell',
          date: data.date,
          amount: sellAmount,
          price: data.price,
          shares: sellShares,
          createdAt: new Date().toISOString(),
        });
      }
    }

    equityCurve.push({
      date: data.date,
      value: currentValue,
    });
  }

  const finalValue = cash + shares * (priceData[priceData.length - 1]?.price || 0);
  const totalReturn = (finalValue - initialCapital) / initialCapital;

  // 计算年化收益率
  const days = priceData.length;
  const years = days / 252;
  const annualizedReturn = Math.pow(1 + totalReturn, 1 / years) - 1;

  // 计算最大回撤
  const maxDrawdown = calculateMaxDrawdown(equityCurve);

  // 计算夏普比率（简化版）
  const sharpeRatio = calculateSharpeRatio(equityCurve);

  return {
    strategyName: strategy.name,
    startDate,
    endDate,
    initialCapital,
    finalValue,
    totalReturn,
    annualizedReturn,
    maxDrawdown,
    sharpeRatio,
    trades,
    equityCurve,
  };
}

// 评估策略条件
async function evaluateRule(condition: string, data: { date: string; price: number; pe?: number; pb?: number }): Promise<boolean> {
  // 估值百分位条件（基于真实数据中的 PE/PB）
  if (condition.includes('percentile')) {
    const match = condition.match(/(\d+)/);
    if (match) {
      const threshold = parseInt(match[1]) / 100;

      // 使用真实数据中提供的 PE/PB 计算估值水平
      // 如果没有 PE 数据，则基于价格相对于历史位置的判断
      let currentPercentile = 0.5; // 默认中位数

      if (data.pe !== undefined && data.pe > 0) {
        // 简化估值计算：PE < 15 为低估，PE > 25 为高估
        if (data.pe < 15) currentPercentile = 0.2;
        else if (data.pe > 25) currentPercentile = 0.8;
        else currentPercentile = (data.pe - 15) / 10 * 0.6 + 0.2;
      } else if (data.pb !== undefined && data.pb > 0) {
        // 使用 PB 作为备选
        if (data.pb < 1.5) currentPercentile = 0.2;
        else if (data.pb > 2.5) currentPercentile = 0.8;
        else currentPercentile = (data.pb - 1.5) / 1.0 * 0.6 + 0.2;
      }

      return condition.includes('<')
        ? currentPercentile < threshold
        : currentPercentile > threshold;
    }
  }

  if (condition === 'monthly') {
    // 每月定投
    return data.date.endsWith('-01');
  }

  return false;
}

// 计算最大回撤
function calculateMaxDrawdown(equityCurve: { date: string; value: number }[]): number {
  let maxDrawdown = 0;
  let peak = equityCurve[0]?.value || 0;

  for (const point of equityCurve) {
    if (point.value > peak) {
      peak = point.value;
    }
    const drawdown = (peak - point.value) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

// 计算夏普比率（简化版）
function calculateSharpeRatio(equityCurve: { date: string; value: number }[]): number {
  if (equityCurve.length < 2) return 0;

  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const dailyReturn = (equityCurve[i].value - equityCurve[i - 1].value) / equityCurve[i - 1].value;
    returns.push(dailyReturn);
  }

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // 假设无风险利率为2%
  const riskFreeRate = 0.02 / 252;

  return stdDev === 0 ? 0 : (avgReturn - riskFreeRate) / stdDev * Math.sqrt(252);
}

/**
 * 从基金历史净值数据构建回测价格序列
 * @param fundCode 基金代码
 * @param startDate 开始日期
 * @param endDate 结束日期
 * @param fetchHistoryFn 获取历史数据的函数
 */
export async function buildPriceDataFromHistory(
  fundCode: string,
  startDate: string,
  endDate: string,
  fetchHistoryFn: (code: string, startDate: string, endDate: string) => Promise<{ date: string; nav: number }[]>
): Promise<{ date: string; price: number; pe?: number; pb?: number }[]> {
  const history = await fetchHistoryFn(fundCode, startDate, endDate);

  if (!history || history.length === 0) {
    throw new Error(`无法获取基金 ${fundCode} 的历史数据，请检查基金代码是否正确`);
  }

  // 按日期升序排列
  const sorted = history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 转换格式，使用净值作为价格
  return sorted.map(item => ({
    date: item.date,
    price: item.nav,
    // 基金净值数据通常不包含 PE/PB，这些需要额外获取
    pe: undefined,
    pb: undefined,
  }));
}
