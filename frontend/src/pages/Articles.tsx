import React, { useState, useEffect } from 'react';
import { Card, List, SearchBar, Tabs, Tag, Toast, Modal } from 'antd-mobile';
import { loadLocalArticles, searchArticles, filterArticlesBySource } from '../services/articleService';
import type { Article } from '../types';
import './Layout.css';

const Articles: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
  const [searchText, setSearchText] = useState('');
  const [activeSource, setActiveSource] = useState('all');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  // 加载文章数据
  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    try {
      setLoading(true);
      const data = await loadLocalArticles();
      setArticles(data);
      setFilteredArticles(data);
    } catch (error) {
      console.error('加载文章失败:', error);
      Toast.show({ content: '加载文章失败', position: 'bottom' });
    } finally {
      setLoading(false);
    }
  };

  // 搜索和筛选
  useEffect(() => {
    let result = articles;
    
    // 按来源筛选
    if (activeSource !== 'all') {
      result = filterArticlesBySource(result, activeSource);
    }
    
    // 按搜索词筛选
    if (searchText) {
      result = searchArticles(result, searchText);
    }
    
    setFilteredArticles(result);
  }, [searchText, activeSource, articles]);

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

  const getSourceName = (source: string) => {
    const names: Record<string, string> = {
      'chinaetfs': '公众号',
      'xueqiu': '雪球',
      'weibo': '微博',
      'qieman': '且慢',
    };
    return names[source] || source;
  };

  return (
    <div className="page-container">
      <h1 className="page-title">E大文章库</h1>

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
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            加载中...
          </div>
        ) : filteredArticles.length === 0 ? (
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
                        {getSourceName(article.source)}
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
                  {getSourceName(selectedArticle.source)}
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
              {selectedArticle.url && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                  <a 
                    href={selectedArticle.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: '#1677ff', fontSize: 13 }}
                  >
                    查看原文 →
                  </a>
                </div>
              )}
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
