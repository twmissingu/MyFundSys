import Dexie, { Table } from 'dexie';
import type { Fund, Holding, Transaction, Article, Strategy, BacktestResult } from '../types';

export class FundDatabase extends Dexie {
  funds!: Table<Fund>;
  holdings!: Table<Holding>;
  transactions!: Table<Transaction>;
  articles!: Table<Article>;
  strategies!: Table<Strategy>;
  backtestResults!: Table<BacktestResult>;

  constructor() {
    super('FundDatabase');
    this.version(2).stores({
      funds: 'id, code, name, category, updatedAt',
      holdings: 'id, fundId, fundCode, updatedAt',
      transactions: 'id, fundId, fundCode, type, date, createdAt',
      articles: 'id, title, date, source, category',
      strategies: 'id, name, type, updatedAt',
      backtestResults: 'id, strategyName, startDate, endDate',
    });
  }
}

export const db = new FundDatabase();

// 初始化基金数据 - 95只ETF基金
export async function initFundData(): Promise<void> {
  const count = await db.funds.count();
  if (count > 0) return;

  const funds: Fund[] = [
    // A股宽基指数
    { id: 'f001', code: '510300', name: '沪深300ETF', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f002', code: '510500', name: '中证500ETF', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f003', code: '510050', name: '上证50ETF', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f004', code: '159915', name: '创业板ETF', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f005', code: '159901', name: '深证100ETF', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f006', code: '510880', name: '红利ETF', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f007', code: '512010', name: '医药ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f008', code: '512170', name: '医疗ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f009', code: '512480', name: '半导体ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f010', code: '515030', name: '新能源车ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f011', code: '515700', name: '光伏ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f012', code: '512660', name: '军工ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f013', code: '512000', name: '券商ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f014', code: '512800', name: '银行ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f015', code: '512200', name: '地产ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f016', code: '159928', name: '消费ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f017', code: '512690', name: '酒ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f018', code: '159995', name: '芯片ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f019', code: '515050', name: '5GETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f020', code: '512980', name: '传媒ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    // 港股
    { id: 'f021', code: '510900', name: 'H股ETF', category: '港股', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f022', code: '159920', name: '恒生ETF', category: '港股', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f023', code: '513050', name: '中概互联网ETF', category: '港股', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f024', code: '513130', name: '恒生科技ETF', category: '港股', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f025', code: '513180', name: '恒生医疗ETF', category: '港股', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    // 美股
    { id: 'f026', code: '513100', name: '纳指ETF', category: '美股', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f027', code: '513500', name: '标普500ETF', category: '美股', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f028', code: '159941', name: '纳斯达克ETF', category: '美股', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f029', code: '513300', name: '纳斯达克100ETF', category: '美股', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    // 商品
    { id: 'f030', code: '518880', name: '黄金ETF', category: '商品', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f031', code: '159985', name: '豆粕ETF', category: '商品', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f032', code: '159981', name: '能源化工ETF', category: '商品', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    // 债券
    { id: 'f033', code: '511010', name: '国债ETF', category: '债券', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f034', code: '511220', name: '城投债ETF', category: '债券', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f035', code: '511260', name: '十年国债ETF', category: '债券', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    // 更多A股宽基
    { id: 'f036', code: '159949', name: '创业板50ETF', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f037', code: '588000', name: '科创50ETF', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f038', code: '512100', name: '中证1000ETF', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f039', code: '159781', name: '双创50ETF', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f040', code: '510180', name: '上证180ETF', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    // 更多行业
    { id: 'f041', code: '512070', name: '证券保险ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f042', code: '515210', name: '钢铁ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f043', code: '515220', name: '煤炭ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f044', code: '159870', name: '化工ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f045', code: '516970', name: '基建ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f046', code: '159766', name: '旅游ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f047', code: '515250', name: '智能汽车ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f048', code: '515400', name: '人工智能ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f049', code: '159819', name: '人工智能ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f050', code: '516010', name: '游戏ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    // 补充到95只
    { id: 'f051', code: '159825', name: '农业ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f052', code: '516110', name: '汽车ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f053', code: '515650', name: '消费50ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f054', code: '159996', name: '家电ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f055', code: '512720', name: '计算机ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f056', code: '515000', name: '科技ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f057', code: '159807', name: '科技50ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f058', code: '512580', name: '环保ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f059', code: '159611', name: '电力ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f060', code: '515880', name: '通信ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f061', code: '512330', name: '信息ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f062', code: '159939', name: '信息技术ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f063', code: '515290', name: '银行ETF天弘', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f064', code: '512640', name: '金融地产ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f065', code: '512910', name: '证券ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f066', code: '159848', name: '证券ETF基金', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f067', code: '512190', name: '沪深300红利ETF', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f068', code: '515080', name: '中证红利ETF', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f069', code: '510810', name: '上海国企ETF', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f070', code: '510110', name: '周期ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f071', code: '510160', name: '产业升级ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f072', code: '510230', name: '金融ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f073', code: '510260', name: '新兴ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f074', code: '510280', name: '成长ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f075', code: '510440', name: '500沪市ETF', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f076', code: '512220', name: '小盘价值ETF', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f077', code: '512240', name: '景顺500ETF', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f078', code: '512400', name: '有色金属ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f079', code: '512500', name: '中证500ETF华夏', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f080', code: '512510', name: 'ETF500', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f081', code: '512520', name: '沪深300ETF华夏', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f082', code: '512530', name: '沪深300ETF博时', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f083', code: '512560', name: '中证军工ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f084', code: '512590', name: '高股息ETF', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f085', code: '512610', name: '医药卫生ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f086', code: '512770', name: '战略新兴ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f087', code: '512780', name: '京津冀ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f088', code: '512820', name: '银行ETF鹏华', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f089', code: '512850', name: '证券龙头ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f090', code: '512860', name: '华安A股ETF', category: 'A股宽基', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f091', code: '512870', name: '杭州湾区ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f092', code: '512880', name: '证券ETF基金', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f093', code: '512900', name: '证券ETF南方', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f094', code: '512950', name: '央企ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'f095', code: '159992', name: '创新药ETF', category: 'A股行业', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ];

  await db.funds.bulkAdd(funds);
}

// 初始化策略数据
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

// 导出数据库为JSON
export async function exportDatabase(): Promise<string> {
  const funds = await db.funds.toArray();
  const holdings = await db.holdings.toArray();
  const transactions = await db.transactions.toArray();
  const strategies = await db.strategies.toArray();

  const data = {
    version: '2.0.0',
    exportDate: new Date().toISOString(),
    funds,
    holdings,
    transactions,
    strategies,
  };

  return JSON.stringify(data, null, 2);
}

// 从JSON导入数据库
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
