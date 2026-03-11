import Dexie, { Table } from 'dexie';
import type { Fund, Holding, Transaction, Article, Strategy, BacktestResult } from '../types';

// 收藏基金（简化版，只保存基本信息）
export interface FavoriteFund {
  id: string;
  code: string;
  name: string;
  category?: string;
  createdAt: string;
}

// 基金历史净值缓存（用于收藏列表的迷你图表）
export interface FundHistoryCache {
  id: string;           // 复合主键: code_date
  code: string;         // 基金代码
  date: string;         // 日期
  nav: number;          // 单位净值
  accNav?: number;      // 累计净值
  dailyChangeRate?: number; // 日涨跌幅
  updatedAt: string;    // 更新时间
}

// 基金缓存条目（保留但简化，用于向后兼容）
export interface FundCacheItem {
  id: string;
  code: string;
  name: string;
  category?: string;
  nav?: number;
  navDate?: string;
  dailyChangeRate?: number;
  accNav?: number;
  pe?: number;
  pb?: number;
  dividendYield?: number;
  source: 'search' | 'import' | 'system';
  isHolding: boolean;
  holdingShares: number;
  searchCount: number;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
}

// 基金搜索历史（保留但不再使用）
export interface FundSearchHistory {
  id?: number;
  keyword: string;
  resultsCount: number;
  searchedAt: string;
}

// 同步队列条目
export interface SyncQueueItem {
  id?: number;
  table: 'holdings' | 'transactions';
  action: 'insert' | 'update' | 'delete';
  data: any;
  synced: number; // 0 = 未同步, 1 = 已同步
  createdAt: string;
}

// 定时任务配置
export interface ScheduledTask {
  id?: number;
  name: string;
  type: 'fetch_nav' | 'generate_report' | 'feishu_notify';
  enabled: boolean;
  schedule: string; // cron 表达式或预设值
  config: any; // 任务特定配置
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

// 飞书配置
export interface FeishuConfig {
  id?: number;
  webhookUrl: string;
  secret?: string; // 签名密钥（可选）
  enabled: boolean;
  notifyOn: {
    dailyReport: boolean;
    weeklyReport: boolean;
    largeFluctuation: boolean;
    transactionAdded: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export class FundDatabase extends Dexie {
  funds!: Table<Fund>;
  holdings!: Table<Holding>;
  transactions!: Table<Transaction>;
  articles!: Table<Article>;
  strategies!: Table<Strategy>;
  backtestResults!: Table<BacktestResult>;
  syncQueue!: Table<SyncQueueItem>;
  scheduledTasks!: Table<ScheduledTask>;
  feishuConfig!: Table<FeishuConfig>;
  fundCache!: Table<FundCacheItem>;
  fundSearchHistory!: Table<FundSearchHistory>;
  favoriteFunds!: Table<FavoriteFund>;
  fundHistoryCache!: Table<FundHistoryCache>;

  constructor() {
    super('FundDatabase');
    this.version(6).stores({
      funds: 'id, code, name, category, updatedAt',
      holdings: 'id, fundId, fundCode, updatedAt',
      fundCache: 'id, code, name, isHolding, searchCount, lastUpdated',
      fundSearchHistory: '++id, keyword, searchedAt',
      favoriteFunds: 'id, code, name, createdAt',
      fundHistoryCache: 'id, code, date, updatedAt',
      transactions: 'id, fundId, fundCode, type, date, createdAt',
      articles: 'id, title, date, source, category',
      strategies: 'id, name, type, updatedAt',
      backtestResults: 'id, strategyName, startDate, endDate',
      syncQueue: '++id, table, synced, createdAt',
      scheduledTasks: '++id, name, type, enabled',
      feishuConfig: '++id, enabled',
    });
  }
}

export const db = new FundDatabase();

// ============================================
// 初始化策略数据
// ============================================

export async function initStrategyData(): Promise<void> {
  const count = await db.strategies.count();
  if (count > 0) return;

  const strategies = [
    {
      id: 's001',
      name: 'E大估值策略',
      description: '基于E大（ETF拯救世界）的估值投资策略，低估值时买入，高估值时卖出',
      type: 'valuation' as const,
      rules: [
        { condition: 'percentile < 20', action: 'buy', params: { ratio: 1.5 } },
        { condition: 'percentile < 40', action: 'buy', params: { ratio: 1.0 } },
        { condition: 'percentile > 80', action: 'sell', params: { ratio: 0.5 } },
        { condition: 'percentile > 90', action: 'sell', params: { ratio: 0.8 } },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 's002',
      name: '定投策略',
      description: '定期定额投资策略，适合长期持有',
      type: 'trend' as const,
      rules: [
        { condition: 'monthly', action: 'buy', params: { amount: 1000 } },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 's003',
      name: '网格策略',
      description: '在价格区间内进行网格交易，低买高卖',
      type: 'grid' as const,
      rules: [
        { condition: 'price_drop_5%', action: 'buy', params: { ratio: 0.2 } },
        { condition: 'price_rise_5%', action: 'sell', params: { ratio: 0.2 } },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  await db.strategies.bulkAdd(strategies);
}

// ============================================
// 初始化默认定时任务
// ============================================

export async function initDefaultTasks(): Promise<void> {
  const count = await db.scheduledTasks.count();
  if (count > 0) return;

  const defaultTasks: ScheduledTask[] = [
    {
      name: '自动抓取净值',
      type: 'fetch_nav',
      enabled: false,
      schedule: '0 18 * * 1-5', // 工作日18:00
      config: {
        sources: ['tiantian', 'xueqiu'],
        retryCount: 3,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      name: '生成日报',
      type: 'generate_report',
      enabled: false,
      schedule: '0 19 * * 1-5', // 工作日19:00
      config: {
        includeHoldings: true,
        includeValuation: true,
        includeSuggestions: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      name: '飞书推送',
      type: 'feishu_notify',
      enabled: false,
      schedule: '0 19 * * 1-5', // 工作日19:00
      config: {
        sendDaily: true,
        sendWeekly: true,
        sendOnLargeFluctuation: true,
        fluctuationThreshold: 3, // 涨跌超过3%时推送
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  await db.scheduledTasks.bulkAdd(defaultTasks);
}

// ============================================
// 导出数据库为JSON
// ============================================

export async function exportDatabase(): Promise<string> {
  const funds = await db.funds.toArray();
  const holdings = await db.holdings.toArray();
  const transactions = await db.transactions.toArray();
  const strategies = await db.strategies.toArray();

  const data = {
    version: '2.1.0',
    exportDate: new Date().toISOString(),
    funds,
    holdings,
    transactions,
    strategies,
  };

  return JSON.stringify(data, null, 2);
}

// ============================================
// 从JSON导入数据库
// ============================================

export async function importDatabase(jsonString: string): Promise<void> {
  const data = JSON.parse(jsonString);

  await db.transaction('rw', db.funds, db.holdings, db.transactions, db.strategies, async () => {
    if (data.funds?.length) {
      await db.funds.clear();
      await db.funds.bulkAdd(data.funds);
    }
    if (data.holdings?.length) {
      await db.holdings.clear();
      await db.holdings.bulkAdd(data.holdings);
    }
    if (data.transactions?.length) {
      await db.transactions.clear();
      await db.transactions.bulkAdd(data.transactions);
    }
    if (data.strategies?.length) {
      await db.strategies.clear();
      await db.strategies.bulkAdd(data.strategies);
    }
  });
}
