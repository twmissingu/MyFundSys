// 基金类型定义
export interface Fund {
  id: string;
  code: string;
  name: string;
  category: string;
  nav?: number;  // 最新净值
  navDate?: string;  // 净值日期
  pe?: number;  // 市盈率
  pb?: number;  // 市净率
  dividendYield?: number;  // 股息率
  createdAt: string;
  updatedAt: string;
}

// 持仓类型定义
export interface Holding {
  id: string;
  fundId: string;
  fundCode: string;
  fundName: string;
  shares: number;  // 持有份额
  avgCost: number;  // 平均成本
  totalCost: number;  // 总成本
  currentNav?: number;  // 当前净值
  currentValue?: number;  // 当前市值
  profit?: number;  // 盈亏金额
  profitRate?: number;  // 盈亏比例
  createdAt: string;
  updatedAt: string;
}

// 交易记录类型定义
export interface Transaction {
  id: string;
  fundId: string;
  fundCode: string;
  fundName: string;
  type: 'buy' | 'sell';
  date: string;  // 用户选择的交易日期
  confirmDate?: string;  // 实际确认日期（用于非交易日，如周日买入则确认为下周一）
  amount: number;  // 金额
  price: number;  // 价格/净值
  shares: number;  // 份额
  fee?: number;  // 手续费
  remark?: string;  // 备注
  status?: 'pending' | 'completed';  // 交易状态：pending=在途等待净值，completed=已完成
  createdAt: string;
}

// E大文章类型定义
export interface Article {
  id: string;
  title: string;
  date: string;
  url: string;
  source: string;
  category: string;
  content: string;
  tags?: string[];
}

// 估值数据类型定义
export interface Valuation {
  date: string;
  pe: number;  // 全市场PE
  pb: number;  // 全市场PB
  percentile: number;  // 历史百分位
  status: 'diamond' | 'normal' | 'danger';  // 钻石坑/正常/危险
}

// 投资组合类型定义
export interface Portfolio {
  id: string;
  name: string;
  description?: string;
  holdings: Holding[];
  totalValue: number;
  totalCost: number;
  totalProfit: number;
  totalProfitRate: number;
  createdAt: string;
  updatedAt: string;
}

// 回测结果类型定义
export interface BacktestResult {
  strategyName: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalValue: number;
  totalReturn: number;
  annualizedReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  trades: number;
  equityCurve: { date: string; value: number }[];
}

// 策略类型定义
export interface Strategy {
  id: string;
  name: string;
  description: string;
  type: 'valuation' | 'trend' | 'grid' | 'custom';
  rules: StrategyRule[];
  createdAt: string;
  updatedAt: string;
}

export interface StrategyRule {
  condition: string;
  action: string;
  params: Record<string, number>;
}

// 基金API返回类型
export interface FundApiData {
  code: string;
  name: string;
  nav: number;              // 单位净值
  accNav?: number;         // 累计净值
  navDate: string;         // 净值日期
  dailyChange: number;     // 涨跌额
  dailyChangeRate: number; // 日涨跌幅(%)
  // 扩展字段
  newPrice?: number;       // ETF实时价格
  priceChangeRate?: number;// 价格涨跌幅(%)
  fundFlow?: number;       // 资金流入(亿元)
  marketTime?: string;     // 行情时间
}

// 市场估值API返回类型
export interface MarketValuationData {
  date: string;
  pe: number;
  pb: number;
  percentile: number;
  temperature: number;  // 市场温度 0-100
  source?: string;      // 数据来源：'qieman' | 'error'
  error?: string;       // 错误信息（获取失败时）
}

// 基金搜索结果
export interface FundSearchResult {
  code: string;
  name: string;
  type?: string;
  nav?: number;
  navDate?: string;
}

// Twitter 推文类型定义
export interface Tweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  username: string;
  name: string;
  public_metrics: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
  };
}
