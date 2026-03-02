import type { BacktestResult, Strategy, Transaction } from '../types';

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
  
  let cash = initialCapital;
  let shares = 0;
  let trades = 0;
  const equityCurve: { date: string; value: number }[] = [];
  
  // 模拟交易记录
  const transactions: Transaction[] = [];
  
  for (const data of priceData) {
    const currentValue = cash + shares * data.price;
    
    // 应用策略规则
    for (const rule of strategy.rules) {
      const shouldTrade = evaluateRule(rule.condition, data);
      
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
function evaluateRule(condition: string, data: { date: string; price: number; pe?: number; pb?: number }): boolean {
  // 简化版条件评估
  if (condition.includes('percentile')) {
    const match = condition.match(/(\d+)/);
    if (match) {
      const threshold = parseInt(match[1]) / 100;
      // 模拟估值百分位
      const simulatedPercentile = Math.random();
      return condition.includes('<') 
        ? simulatedPercentile < threshold 
        : simulatedPercentile > threshold;
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

// 生成模拟价格数据用于回测
export function generateMockPriceData(
  startDate: string, 
  endDate: string, 
  basePrice: number = 1.0
): { date: string; price: number; pe?: number; pb?: number }[] {
  const data: { date: string; price: number; pe?: number; pb?: number }[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  let currentPrice = basePrice;
  let currentDate = new Date(start);
  
  while (currentDate <= end) {
    // 跳过周末
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
      // 模拟价格波动
      const change = (Math.random() - 0.5) * 0.02;
      currentPrice = currentPrice * (1 + change);
      
      data.push({
        date: currentDate.toISOString().split('T')[0],
        price: Number(currentPrice.toFixed(4)),
        pe: Number((20 + Math.random() * 20).toFixed(2)),
        pb: Number((1.5 + Math.random() * 2).toFixed(2)),
      });
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return data;
}
