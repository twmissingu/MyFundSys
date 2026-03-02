import React, { useState, useEffect } from 'react';
import { List, SearchBar, Tabs, Tag, Toast } from 'antd-mobile';
import { useFunds } from '../hooks/useDB';
import { fetchMultipleFundsNav } from '../services/fundApi';
import { formatMoney, formatPercent } from '../utils';
import type { Fund, FundApiData } from '../types';
import './Layout.css';

const FundList: React.FC = () => {
  const { funds, loading } = useFunds();
  const [searchText, setSearchText] = useState('');
  const [fundData, setFundData] = useState<Record<string, FundApiData>>({});
  const [activeCategory, setActiveCategory] = useState('全部');

  // 基金分类
  const categories = ['全部', 'A股宽基', 'A股行业', '港股', '美股', '商品', '债券'];

  useEffect(() => {
    loadFundData();
  }, [funds]);

  const loadFundData = async () => {
    if (funds.length === 0) return;
    
    try {
      const codes = funds.map(f => f.code);
      const data = await fetchMultipleFundsNav(codes);
      const dataMap: Record<string, FundApiData> = {};
      data.forEach(item => {
        dataMap[item.code] = item;
      });
      setFundData(dataMap);
    } catch (error) {
      console.error('获取基金数据失败:', error);
    }
  };

  // 筛选基金
  const filteredFunds = funds.filter(fund => {
    const matchSearch = 
      fund.name.toLowerCase().includes(searchText.toLowerCase()) ||
      fund.code.includes(searchText);
    const matchCategory = activeCategory === '全部' || fund.category === activeCategory;
    return matchSearch && matchCategory;
  });

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'A股宽基': '#1677ff',
      'A股行业': '#52c41a',
      '港股': '#722ed1',
      '美股': '#eb2f96',
      '商品': '#fa8c16',
      '债券': '#13c2c2',
    };
    return colors[category] || '#999';
  };

  return (
    <div className="page-container">
      <h1 className="page-title">基金列表</h1>

      <SearchBar
        placeholder="搜索基金名称或代码"
        value={searchText}
        onChange={setSearchText}
        style={{ marginBottom: 12 }}
      />

      <Tabs
        activeKey={activeCategory}
        onChange={setActiveCategory}
        style={{ marginBottom: 12 }}
      >
        {categories.map(cat => (
          <Tabs.Tab title={cat} key={cat} />
        ))}
      </Tabs>

      <div className="card">
        <List>
          {filteredFunds.map(fund => {
            const data = fundData[fund.code];
            const dailyChange = data?.dailyChangeRate || 0;
            
            return (
              <List.Item
                key={fund.id}
                title={<div style={{ fontSize: 15, fontWeight: 500 }}>{fund.name}</div>}
                description={
                  <div>
                    <Tag color={getCategoryColor(fund.category)} style={{ fontSize: 11 }}>
                      {fund.category}
                    </Tag>
                    <span style={{ fontSize: 13, color: '#999', marginLeft: 8 }}>
                      {fund.code}
                    </span>
                  </div>
                }
                extra={
                  data ? (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 500 }}>
                        {data.nav.toFixed(4)}
                      </div>
                      <div 
                        style={{ 
                          fontSize: 13, 
                          color: dailyChange >= 0 ? '#ff4d4f' : '#52c41a' 
                        }}
                      >
                        {dailyChange >= 0 ? '+' : ''}{dailyChange.toFixed(2)}%
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: '#999' }}>加载中...</div>
                  )
                }
                onClick={() => {
                  Toast.show({
                    content: `${fund.name} (${fund.code})`,
                    position: 'bottom',
                  });
                }}
              />
            );
          })}
        </List>
        
        {filteredFunds.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            未找到匹配的基金
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: '12px', color: '#999', fontSize: 13 }}>
        共 {filteredFunds.length} 只基金
      </div>
    </div>
  );
};

export default FundList;
