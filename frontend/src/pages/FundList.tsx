import React, { useState } from 'react';
import { Card, List, SearchBar, Tag } from 'antd-mobile';
import { useFunds } from '../hooks/useSupabase';
import './Layout.css';

const FundList: React.FC = () => {
  const { funds } = useFunds();
  const [searchText, setSearchText] = useState('');

  // 筛选基金
  const filteredFunds = funds.filter(fund => {
    if (!searchText) return true;
    const search = searchText.toLowerCase();
    return (
      fund.code.toLowerCase().includes(search) ||
      fund.name.toLowerCase().includes(search) ||
      fund.category.toLowerCase().includes(search)
    );
  });

  // 按分类分组
  const groupedFunds = filteredFunds.reduce((groups, fund) => {
    const category = fund.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(fund);
    return groups;
  }, {} as Record<string, typeof funds>);

  const categories = Object.keys(groupedFunds).sort();

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'A股宽基': 'primary',
      'A股行业': 'success',
      '港股': 'warning',
      '美股': 'danger',
      '商品': 'default',
      '债券': 'success',
    };
    return colors[category] || 'default';
  };

  const handleFundClick = (fundCode: string) => {
    // 使用 hash 路由跳转到详情页
    window.location.hash = `fund/${fundCode}`;
  };

  return (
    <div className="page-container">
      <h1 className="page-title">基金列表</h1>

      <SearchBar
        placeholder="搜索基金代码或名称"
        value={searchText}
        onChange={setSearchText}
        style={{ marginBottom: 12 }}
      />

      <div style={{ marginBottom: 12 }}>
        <Tag color="primary">共 {filteredFunds.length} 只基金</Tag>
      </div>

      {categories.map(category => (
        <Card 
          key={category} 
          title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag color={getCategoryColor(category)}>{category}</Tag>
            <span style={{ fontSize: 13, color: '#999' }}>({groupedFunds[category].length}只)</span>
          </div>} 
          className="card"
          style={{ marginBottom: 12 }}
        >
          <List>
            {groupedFunds[category].map(fund => (
              <List.Item
                key={fund.id}
                title={<div style={{ fontSize: 15, fontWeight: 500 }}>{fund.name}</div>}
                description={
                  <div style={{ fontSize: 13, color: '#999' }}>
                    代码: {fund.code}
                  </div>
                }
                onClick={() => handleFundClick(fund.code)}
                arrow
              />
            ))}
          </List>
        </Card>
      ))}

      {filteredFunds.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          未找到匹配的基金
        </div>
      )}
    </div>
  );
};

export default FundList;
