import type { Article } from '../types';

// 文章数据导入配置
const ARTICLE_SOURCES = [
  { dir: 'chinaetfs-full', source: 'chinaetfs', name: '公众号' },
  { dir: 'xueqiu', source: 'xueqiu', name: '雪球' },
  { dir: 'weibo', source: 'weibo', name: '微博' },
  { dir: 'qieman', source: 'qieman', name: '且慢' },
];

// 解析Markdown文章内容
function parseArticleMarkdown(content: string, filename: string): Article | null {
  try {
    // 解析 frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontmatterMatch) return null;

    const frontmatter = frontmatterMatch[1];
    const body = frontmatterMatch[2].trim();

    // 解析 frontmatter 字段
    const title = frontmatter.match(/title:\s*(.+)/)?.[1] || '';
    const date = frontmatter.match(/date:\s*(.+)/)?.[1] || '';
    const url = frontmatter.match(/url:\s*(.+)/)?.[1] || '';
    const source = frontmatter.match(/source:\s*(.+)/)?.[1] || '';
    const category = frontmatter.match(/category:\s*(.+)/)?.[1] || '';

    // 生成ID
    const id = `article_${filename.replace(/\.md$/, '')}_${Date.now()}`;

    // 提取标签（从内容中）
    const tags = extractTags(body);

    return {
      id,
      title: title || '无标题',
      date: date || new Date().toISOString().split('T')[0],
      url: url || '',
      source: source || 'unknown',
      category: category || '其他',
      content: body.substring(0, 2000), // 限制内容长度
      tags,
    };
  } catch (error) {
    console.error('解析文章失败:', error);
    return null;
  }
}

// 从内容中提取标签
function extractTags(content: string): string[] {
  const tags: string[] = [];
  
  // 关键词映射
  const keywordMap: Record<string, string[]> = {
    '估值': ['估值', 'PE', 'PB', '市盈率', '市净率'],
    '策略': ['策略', '网格', '定投', '资产配置'],
    '心理': ['心理', '恐惧', '贪婪', '心态'],
    '风险': ['风险', '止损', '回撤', '仓位'],
    '指数': ['指数', 'ETF', '沪深300', '中证500'],
  };

  for (const [tag, keywords] of Object.entries(keywordMap)) {
    if (keywords.some(kw => content.includes(kw))) {
      tags.push(tag);
    }
  }

  return tags.slice(0, 5); // 最多5个标签
}

// 加载本地文章数据
export async function loadLocalArticles(): Promise<Article[]> {
  const articles: Article[] = [];
  
  // 由于无法直接读取文件系统，这里使用预加载的文章数据
  // 实际项目中可以通过构建时脚本生成
  
  // 返回示例文章（实际应从本地文件加载）
  return getSampleArticles();
}

// 示例文章数据（用于演示）
function getSampleArticles(): Article[] {
  return [
    {
      id: 'a001',
      title: '随便说说股票',
      date: '2006-03-02',
      url: 'http://www.chinaetfs.cn/a/105.html',
      source: 'chinaetfs',
      category: '投资理念',
      content: `股票本身有2种获利途径：1 投资这家公司，伴随这家公司的不断成长，每年获取红利。 2 赚取差价。

在现在的中国股市，基本上就是第二点。因为中国股市分红要除权。所以不管你做长中短线，都要记得一条定律，低买高卖。

我认为股票的低点不是最低点。没有人能预测股票的最低点。买股票最好的时机，我认为是突破布林线中轨的时候。

止损很重要。没有人买股票100%买对。买错了怎么办。止损。我的止损线是4%。

最后再说几个我认为重要的：
1. 技术图形。我个人认为非常重要的几个技术指标是MACD，成交量，布林线，均线。
2. 消息。从别人那儿听消息，听别人推荐。我个人认为非常不可取。
3. 安全。雷老虎说，安全第一，安全第一。这个在股市中最有用。
4. 贪。千万别贪。赚了就是你的胜利。`,
      tags: ['投资理念', '技术分析', '止损'],
    },
    {
      id: 'a002',
      title: '钻石坑与死亡之顶',
      date: '2015-06-15',
      url: 'http://www.chinaetfs.cn',
      source: 'chinaetfs',
      category: '估值体系',
      content: `估值不会告诉你明天涨还是跌，但它会告诉你哪里安全，哪里危险。

全市场PE < 25：钻石坑区域，建议重仓
全市场PE 25-40：合理区间，正常配置  
全市场PE > 60：死亡之顶，建议减仓

仓位管理原则：
目标仓位 = 100% - 当前估值百分位

当市场处于钻石坑时，应该贪婪；
当市场处于死亡之顶时，应该恐惧。

逆向投资是长期盈利的关键。`,
      tags: ['估值', '仓位管理', '逆向投资'],
    },
    {
      id: 'a003',
      title: '长赢指数投资计划',
      date: '2018-01-01',
      url: 'https://qieman.com',
      source: 'qieman',
      category: '投资策略',
      content: `长赢指数投资计划是基于估值的定期不定额定投策略。

核心原则：
1. 低估值时多买，高估值时少买或不买
2. 分散投资，降低单一资产风险
3. 长期持有，忽略短期波动
4. 动态平衡，定期调整仓位

资产配置建议：
- A股宽基：30%
- 港股：20%
- 美股：20%
- 商品：10%
- 债券：20%

根据估值变化动态调整各类资产比例。`,
      tags: ['长赢', '定投', '资产配置'],
    },
    {
      id: 'a004',
      title: '关于网格交易',
      date: '2019-03-15',
      url: 'https://xueqiu.com',
      source: 'xueqiu',
      category: '交易策略',
      content: `网格交易是一种在震荡市场中获利的策略。

基本原理：
1. 设定价格区间和网格密度
2. 价格下跌时买入，上涨时卖出
3. 赚取波动中的差价

适用场景：
- 震荡市
- 波动性较大的品种
- 作为底仓的补充策略

注意事项：
1. 单边上涨或下跌行情不适用
2. 需要预留足够的资金
3. 网格大小要合理设置`,
      tags: ['网格交易', '震荡市', '策略'],
    },
    {
      id: 'a005',
      title: '活着最重要',
      date: '2020-03-20',
      url: 'https://weibo.com',
      source: 'weibo',
      category: '风险管理',
      content: `投资的第一原则：活着最重要。

永远不要满仓，永远保留一定的现金。

市场是不可预测的，即使是最好的投资者也无法预测每一次涨跌。

风险控制方法：
1. 分散投资，不要把鸡蛋放在一个篮子里
2. 控制单一品种的仓位上限
3. 设置止损线，严格执行
4. 定期评估投资组合风险

记住：在股市中，活得久比赚得快更重要。`,
      tags: ['风险管理', '仓位控制', '生存'],
    },
    {
      id: 'a006',
      title: '投资心理成长',
      date: '2021-03-19',
      url: 'http://www.chinaetfs.cn/a/1890.html',
      source: 'chinaetfs',
      category: '投资心理',
      content: `我一向认为，失败的投资者失败的原因，恐怕一大部分不是体系、方法和技术，而是心理。

首先，当然，你要有"判断"的能力。判断什么的能力？判断胖瘦的能力。就像巴菲特说的，对面过来一个200斤的人，你不需要一台体重秤，也该知道他是胖子。想做好投资，当然至少要有这个能力——你该知道自己心仪的标的到底是便宜，贵，还是比较模糊的中间地带。

就像你到大街上看看就知道，真正特别瘦和特别胖的人并不多，大多数人都是介于两者之间。投资也是如此——真正非常贵或者非常便宜的时候，并不多。大多数时间，只是偏贵、偏便宜或者正好。

心理问题。咱们一起解决你说的问题——喜欢的标的等了很久不跌，一路上涨，自己追进去就是大顶；买到了牛股，赚了三瓜两枣惊慌地卖出，结果不断上涨翻了几倍……

你有没有想过，造成这些问题的真正原因是什么？很简单，就是你没有理解一开始说的：判断胖瘦的能力。`,
      tags: ['投资心理', '判断能力', '自信'],
    },
    {
      id: 'a007',
      title: '关于资产配置',
      date: '2019-06-10',
      url: 'https://xueqiu.com',
      source: 'xueqiu',
      category: '资产配置',
      content: `资产配置是投资中最重要的环节，没有之一。

为什么资产配置如此重要？
1. 分散风险：不同资产类别相关性低
2. 平滑波动：东方不亮西方亮
3. 提高收益风险比：同样的风险获得更高收益

E大的资产配置建议：
- A股宽基指数：30-40%
- 港股：15-20%
- 美股：15-20%
- 商品（黄金、原油）：5-10%
- 债券：20-30%

定期再平衡：每年或每半年检查一次，将各资产比例调回目标配置。`,
      tags: ['资产配置', '分散投资', '再平衡'],
    },
    {
      id: 'a008',
      title: '定投的正确姿势',
      date: '2020-08-15',
      url: 'https://qieman.com',
      source: 'qieman',
      category: '定投策略',
      content: `定投不是傻投，定期不定额才是正确的定投姿势。

什么是定期不定额？
- 定期：固定时间投入
- 不定额：根据估值调整投入金额

具体做法：
1. 设定基准金额（如每月1000元）
2. 根据估值百分位调整：
   - 0-20%（钻石坑）：投入1.5-2倍
   - 20-40%（低估）：投入1-1.5倍
   - 40-60%（合理）：投入1倍
   - 60-80%（偏高）：投入0.5倍或不投
   - 80-100%（高估）：停止投入或卖出

这样做的好处：
- 低位多买，摊低成本
- 高位少买，控制风险
- 长期收益率更高`,
      tags: ['定投', '定期不定额', '估值'],
    },
  ];
}

// 搜索文章
export function searchArticles(articles: Article[], query: string): Article[] {
  const lowerQuery = query.toLowerCase();
  return articles.filter(article => 
    article.title.toLowerCase().includes(lowerQuery) ||
    article.content.toLowerCase().includes(lowerQuery) ||
    article.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

// 按来源筛选文章
export function filterArticlesBySource(articles: Article[], source: string): Article[] {
  if (source === 'all') return articles;
  return articles.filter(article => article.source === source);
}

// 按分类筛选文章
export function filterArticlesByCategory(articles: Article[], category: string): Article[] {
  if (category === 'all') return articles;
  return articles.filter(article => article.category === category);
}
