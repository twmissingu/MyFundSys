import React, { useState, useEffect } from 'react';
import { Card, List, SearchBar, Tabs, Tag, Toast, Modal } from 'antd-mobile';
import { useInitDB } from '../hooks/useDB';
import { db } from '../db';
import type { Article } from '../types';
import './Layout.css';

// 文章数据 - 从Markdown文件导入
// const articleModules = import.meta.glob('/data/articles/**/*.md', { as: 'raw' });

const Articles: React.FC = () => {
  useInitDB();
  const [articles, setArticles] = useState<Article[]>([]);
  const [searchText, setSearchText] = useState('');
  const [activeSource, setActiveSource] = useState('all');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  // 加载文章数据
  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      // 从IndexedDB加载文章
      const storedArticles = await db.articles.toArray();
      
      if (storedArticles.length === 0) {
        // 如果没有存储的文章，加载示例文章
        const sampleArticles: Article[] = [
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
        ];
        
        await db.articles.bulkAdd(sampleArticles);
        setArticles(sampleArticles);
      } else {
        setArticles(storedArticles);
      }
    } catch (error) {
      console.error('加载文章失败:', error);
      Toast.show({ content: '加载文章失败', position: 'bottom' });
    }
  };

  // 筛选文章
  const filteredArticles = articles.filter(article => {
    const matchSearch = 
      article.title.toLowerCase().includes(searchText.toLowerCase()) ||
      article.content.toLowerCase().includes(searchText.toLowerCase()) ||
      article.tags?.some(tag => tag.toLowerCase().includes(searchText.toLowerCase()));
    const matchSource = activeSource === 'all' || article.source === activeSource;
    return matchSearch && matchSource;
  });

  const sources = [
    { key: 'all', title: '全部' },
    { key: 'chinaetfs', title: '公众号' },
    { key: 'xueqiu', title: '雪球' },
    { key: 'weibo', title: '微博' },
    { key: 'qieman', title: '且慢' },
  ];

  const getSourceColor = (source: string) => {
    const colors: Record<string, string> = {
      'chinaetfs': '#07c160',
      'xueqiu': '#d9534f',
      'weibo': '#fa7d3c',
      'qieman': '#1677ff',
    };
    return colors[source] || '#999';
  };

  return (
    <div className="page-container">
      <h1 className="page-title">E大文章</h1>

      <SearchBar
        placeholder="搜索文章标题、内容或标签"
        value={searchText}
        onChange={setSearchText}
        style={{ marginBottom: 12 }}
      />

      <Tabs
        activeKey={activeSource}
        onChange={setActiveSource}
        style={{ marginBottom: 12 }}
      >
        {sources.map(source => (
          <Tabs.Tab title={source.title} key={source.key} />
        ))}
      </Tabs>

      <Card className="card">
        {filteredArticles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            未找到匹配的文章
          </div>
        ) : (
          <List>
            {filteredArticles.map(article => (
              <List.Item
                key={article.id}
                title={
                  <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.4 }}>
                    {article.title}
                  </div>
                }
                description={
                  <div>
                    <div style={{ marginBottom: 4 }}>
                      <Tag 
                        color={getSourceColor(article.source)}
                        style={{ fontSize: 11, marginRight: 8 }}
                      >
                        {article.source}
                      </Tag>
                      <span style={{ fontSize: 12, color: '#999' }}>
                        {article.date}
                      </span>
                    </div>
                    <div>
                      {article.tags?.map(tag => (
                        <Tag 
                          key={tag} 
                          style={{ fontSize: 11, marginRight: 4 }}
                        >
                          {tag}
                        </Tag>
                      ))}
                    </div>
                  </div>
                }
                onClick={() => setSelectedArticle(article)}
              >
                <div 
                  style={{ 
                    fontSize: 13, 
                    color: '#666', 
                    lineHeight: 1.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {article.content.substring(0, 100)}...
                </div>
              </List.Item>
            ))}
          </List>
        )}
      </Card>

      <div style={{ textAlign: 'center', padding: '12px', color: '#999', fontSize: 13 }}>
        共 {filteredArticles.length} 篇文章
      </div>

      {/* 文章详情弹窗 */}
      <Modal
        visible={!!selectedArticle}
        title={selectedArticle?.title}
        content={
          selectedArticle && (
            <div>
              <div style={{ marginBottom: 12 }}>
                <Tag color={getSourceColor(selectedArticle.source)}>
                  {selectedArticle.source}
                </Tag>
                <span style={{ fontSize: 13, color: '#999', marginLeft: 8 }}>
                  {selectedArticle.date}
                </span>
              </div>
              <div style={{ marginBottom: 12 }}>
                {selectedArticle.tags?.map(tag => (
                  <Tag key={tag} style={{ marginRight: 4 }}>{tag}</Tag>
                ))}
              </div>
              <div 
                style={{ 
                  fontSize: 14, 
                  lineHeight: 1.8, 
                  color: '#333',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {selectedArticle.content}
              </div>
            </div>
          )
        }
        closeOnAction
        onClose={() => setSelectedArticle(null)}
        actions={[
          {
            key: 'close',
            text: '关闭',
          },
        ]}
      />
    </div>
  );
};

export default Articles;
