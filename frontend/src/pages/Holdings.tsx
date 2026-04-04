import React, { useState, useMemo, useEffect } from 'react';
import { Card, List, Toast, SwipeAction, Tabs, Tag, Dialog } from 'antd-mobile';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

import { useHoldings, useTransactions } from '../hooks/useSync';
import { processPendingTransactions } from '../services/navUpdateService';
import { formatMoney, formatPercent } from '../utils';
import TotalAssetsCard from '../components/TotalAssetsCard';
import './Layout.css';

const COLORS = ['#1677ff', '#52c41a', '#fa8c16', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fadb14'];

const Holdings: React.FC = () => {
  const { holdings, loading, removeHolding, refresh } = useHoldings();
  const { transactions } = useTransactions();
  const [activeTab, setActiveTab] = useState('list');


  // 加载在途交易
  useEffect(() => {
    processPendingTransactions().then((result) => {
      if (result.processedCount > 0) {
        Toast.show({
          content: `已处理 ${result.processedCount} 笔在途交易`,
          position: 'bottom'
        });
        refresh();
      }
    });
  }, []);

  // 计算在途买入金额
  const pendingBuyAmount = transactions
    .filter(t => t.status === 'pending' && t.type === 'buy')
    .reduce((sum, t) => sum + t.amount, 0);

  // 计算总资产（用于统计图表）
  const totalAssets = holdings.reduce((sum, h) => sum + (h.currentValue || h.totalCost), 0) + pendingBuyAmount;

  // 按分类统计
  const categoryStats = useMemo(() => {
    const stats: Record<string, { value: number; cost: number; count: number }> = {};
    
    holdings.forEach(holding => {
      const category = '持仓';
      const value = holding.currentValue || holding.totalCost;
      
      if (!stats[category]) {
        stats[category] = { value: 0, cost: 0, count: 0 };
      }
      stats[category].value += value;
      stats[category].cost += holding.totalCost;
      stats[category].count += 1;
    });

    return Object.entries(stats).map(([name, data]) => ({
      name,
      value: data.value,
      cost: data.cost,
      count: data.count,
      profit: data.value - data.cost,
      profitRate: data.cost > 0 ? (data.value - data.cost) / data.cost : 0,
    })).sort((a, b) => b.value - a.value);
  }, [holdings]);

  // 按市场统计
  const marketStats = useMemo(() => {
    const stats: Record<string, { value: number; cost: number; count: number }> = {};
    
    holdings.forEach(holding => {
      const market = '全部';
      const value = holding.currentValue || holding.totalCost;
      
      if (!stats[market]) {
        stats[market] = { value: 0, cost: 0, count: 0 };
      }
      stats[market].value += value;
      stats[market].cost += holding.totalCost;
      stats[market].count += 1;
    });

    return Object.entries(stats).map(([name, data]) => ({
      name,
      value: data.value,
      cost: data.cost,
      count: data.count,
      profit: data.value - data.cost,
      profitRate: data.cost > 0 ? (data.value - data.cost) / data.cost : 0,
    })).sort((a, b) => b.value - a.value);
  }, [holdings]);

  const handleDeleteHolding = async (id: string) => {
    await Dialog.confirm({
      content: '确定要删除这个持仓吗？关联的交易记录也会被删除。',
      onConfirm: async () => {
        try {
          await removeHolding(id);
            Toast.show({ content: '删除成功', position: 'bottom' });
            window.location.reload();
        } catch (error) {
          Toast.show({ content: '删除失败', position: 'bottom' });
        }
      },
    });
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'A股宽基': '#1677ff',
      'A股行业': '#52c41a',
      '港股': '#fa8c16',
      '美股': '#f5222d',
      '商品': '#722ed1',
      '债券': '#13c2c2',
    };
    return colors[category] || '#999';
  };

  const renderListView = () => (
    <Card title={`持仓明细 (${holdings.length})`} className="card">
      {holdings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          暂无持仓，请在交易页面添加交易记录
        </div>
      ) : (
        <List>
          {holdings.map(holding => {
            const profit = (holding.currentValue || holding.totalCost) - holding.totalCost;
            const profitRate = holding.totalCost > 0 ? profit / holding.totalCost : 0;
            
            return (
              <SwipeAction
                key={holding.id}
                rightActions={[
                  {
                    key: 'delete',
                    text: '删除',
                    color: 'danger',
                    onClick: () => handleDeleteHolding(holding.id),
                  },
                ]}
              >
                <div onClick={() => window.location.hash = `#transactions?fundCode=${holding.fundCode}`}>
                  <List.Item
                    title={<div style={{ fontSize: 15, fontWeight: 500 }}>{holding.fundName}</div>}
                    description={
                      <div style={{ fontSize: 13, color: '#999' }}>
                        {holding.fundCode} | 成本: {formatMoney(holding.avgCost)}
                      </div>
                    }
                    extra={
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 15, fontWeight: 500 }}>
                          {formatMoney(holding.currentValue || holding.totalCost)}
                        </div>
                        <div 
                          style={{ 
                            fontSize: 13, 
                            color: profit >= 0 ? '#ff4d4f' : '#52c41a' 
                          }}
                        >
                          {profit >= 0 ? '+' : ''}{formatPercent(profitRate)}
                        </div>
                      </div>
                    }
                  >
                    <div style={{ padding: '8px 0' }}>
                      <div style={{ fontSize: 13, color: '#666' }}>
                        份额: {holding.shares.toFixed(2)} | 市值: {formatMoney(holding.currentValue || holding.totalCost)}
                      </div>
                    </div>
                  </List.Item>
                </div>
              </SwipeAction>
            );
          })}
        </List>
      )}
    </Card>
  );

  const renderStatsView = () => (
    <>
      {/* 资产配置饼图 */}
      <Card title="资产配置" className="card" style={{ marginBottom: 12 }}>
        {categoryStats.length > 0 ? (
          <>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryStats}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {categoryStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => formatMoney(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <List>
              {categoryStats.map((stat, index) => (
                <List.Item
                  key={stat.name}
                  title={<div style={{ display: 'flex', alignItems: 'center' }}>
                    <div 
                      style={{ 
                        width: 12, 
                        height: 12, 
                        borderRadius: '50%', 
                        backgroundColor: COLORS[index % COLORS.length],
                        marginRight: 8 
                      }} 
                    />
                    {stat.name}
                  </div>}
                  description={`${stat.count}只基金`}
                  extra={<div style={{ textAlign: 'right' }}>
                    <div>{formatMoney(stat.value)}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>
                      {((stat.value / totalAssets) * 100).toFixed(1)}%
                    </div>
                  </div>}
                />
              ))}
            </List>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            暂无持仓数据
          </div>
        )}
      </Card>

      {/* 市场分布 */}
      <Card title="市场分布" className="card">
        {marketStats.length > 0 ? (
          <List>
            {marketStats.map((stat) => (
              <List.Item
                key={stat.name}
                title={stat.name}
                description={`${stat.count}只基金`}
                extra={<div style={{ textAlign: 'right' }}>
                  <div>{formatMoney(stat.value)}</div>
                  <div 
                    style={{ 
                      fontSize: 12, 
                      color: stat.profit >= 0 ? '#ff4d4f' : '#52c41a'
                    }}
                  >
                    {stat.profit >= 0 ? '+' : ''}{formatPercent(stat.profitRate)}
                  </div>
                </div>}
              />
            ))}
          </List>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            暂无持仓数据
          </div>
        )}
      </Card>
    </>
  );

  return (
    <div className="page-container">
      <h1 className="page-title">持仓管理</h1>

      {/* 资产总览 */}
      <TotalAssetsCard holdings={holdings} pendingBuyAmount={pendingBuyAmount} />

      {/* 标签页切换 */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginBottom: 12 }}
      >
        <Tabs.Tab title="持仓列表" key="list" />
        <Tabs.Tab title="统计分析" key="stats" />
      </Tabs>

      {/* 内容区域 */}
      {activeTab === 'list' ? renderListView() : renderStatsView()}
    </div>
  );
};

export default Holdings;
