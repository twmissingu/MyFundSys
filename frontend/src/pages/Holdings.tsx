import React, { useState, useMemo } from 'react';
import { Card, List, Button, Dialog, Form, Input, Toast, SwipeAction, Tabs, Tag } from 'antd-mobile';
import { AddOutline } from 'antd-mobile-icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { useHoldings, useFunds, addTransaction, deleteHolding } from '../hooks/useSupabase';
import { formatMoney, formatPercent } from '../utils';
import './Layout.css';

const COLORS = ['#1677ff', '#52c41a', '#fa8c16', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fadb14'];

const Holdings: React.FC = () => {
  const { holdings, refresh } = useHoldings();
  const { funds } = useFunds();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [form] = Form.useForm();

  // 计算汇总数据
  const totalAssets = holdings.reduce((sum, h) => sum + (h.currentValue || h.totalCost), 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.totalCost, 0);
  const totalProfit = totalAssets - totalCost;
  const totalProfitRate = totalCost > 0 ? totalProfit / totalCost : 0;

  // 按分类统计
  const categoryStats = useMemo(() => {
    const stats: Record<string, { value: number; cost: number; count: number }> = {};
    
    holdings.forEach(holding => {
      const fund = funds.find(f => f.code === holding.fundCode);
      const category = fund?.category || '其他';
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
  }, [holdings, funds]);

  // 按市场统计
  const marketStats = useMemo(() => {
    const marketMap: Record<string, string> = {
      'A股宽基': 'A股',
      'A股行业': 'A股',
      '港股': '港股',
      '美股': '美股',
      '商品': '商品',
      '债券': '债券',
    };

    const stats: Record<string, { value: number; cost: number; count: number }> = {};
    
    holdings.forEach(holding => {
      const fund = funds.find(f => f.code === holding.fundCode);
      const category = fund?.category || '其他';
      const market = marketMap[category] || '其他';
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
  }, [holdings, funds]);

  const handleAddTransaction = async (values: any) => {
    try {
      const fund = funds.find(f => f.code === values.fundCode);
      if (!fund) {
        Toast.show({ content: '基金不存在', position: 'bottom' });
        return;
      }

      const shares = values.amount / values.price;
      
      await addTransaction({
        fundId: fund.id,
        fundCode: fund.code,
        fundName: fund.name,
        type: values.type,
        date: values.date,
        amount: Number(values.amount),
        price: Number(values.price),
        shares: shares,
        fee: values.fee ? Number(values.fee) : 0,
        remark: values.remark,
      });

      Toast.show({ content: '添加成功', position: 'bottom' });
      setShowAddDialog(false);
      form.resetFields();
      refresh();
    } catch (error) {
      console.error('Add transaction error:', error);
      Toast.show({ content: '添加失败', position: 'bottom' });
    }
  };

  const handleDeleteHolding = async (id: string) => {
    await Dialog.confirm({
      content: '确定要删除这个持仓吗？',
      onConfirm: async () => {
        try {
          await deleteHolding(id);
          Toast.show({ content: '删除成功', position: 'bottom' });
          refresh();
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
          暂无持仓，点击上方按钮添加交易
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
      <div className="stat-card">
        <div className="stat-label">总资产</div>
        <div className="stat-value">{formatMoney(totalAssets)}</div>
        <div className="stat-change" style={{ color: totalProfit >= 0 ? '#ffccc7' : '#b7eb8f' }}>
          盈亏: {totalProfit >= 0 ? '+' : ''}{formatMoney(totalProfit)} ({formatPercent(totalProfitRate)})
        </div>
      </div>

      {/* 添加交易按钮 */}
      <Button
        block
        color="primary"
        onClick={() => setShowAddDialog(true)}
        style={{ marginBottom: 12 }}
      >
        <AddOutline /> 添加交易
      </Button>

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

      {/* 添加交易对话框 */}
      <Dialog
        visible={showAddDialog}
        title="添加交易"
        content={
          <Form
            form={form}
            layout="vertical"
            onFinish={handleAddTransaction}
          >
            <Form.Item
              name="fundCode"
              label="基金代码"
              rules={[{ required: true, message: '请输入基金代码' }]}
            >
              <Input placeholder="如: 510300" />
            </Form.Item>

            <Form.Item
              name="type"
              label="交易类型"
              rules={[{ required: true }]}
              initialValue="buy"
            >
              <div>
                <Button
                  size="small"
                  color={form.getFieldValue('type') === 'buy' ? 'primary' : 'default'}
                  onClick={() => form.setFieldsValue({ type: 'buy' })}
                  style={{ marginRight: 8 }}
                >
                  买入
                </Button>
                <Button
                  size="small"
                  color={form.getFieldValue('type') === 'sell' ? 'primary' : 'default'}
                  onClick={() => form.setFieldsValue({ type: 'sell' })}
                >
                  卖出
                </Button>
              </div>
            </Form.Item>

            <Form.Item
              name="date"
              label="交易日期"
              rules={[{ required: true }]}
              initialValue={new Date().toISOString().split('T')[0]}
            >
              <Input type="date" />
            </Form.Item>

            <Form.Item
              name="amount"
              label="交易金额"
              rules={[{ required: true, message: '请输入金额' }]}
            >
              <Input type="number" placeholder="0.00" />
            </Form.Item>

            <Form.Item
              name="price"
              label="成交价格"
              rules={[{ required: true, message: '请输入价格' }]}
            >
              <Input type="number" placeholder="0.0000" />
            </Form.Item>

            <Form.Item
              name="fee"
              label="手续费"
            >
              <Input type="number" placeholder="0.00" />
            </Form.Item>

            <Form.Item
              name="remark"
              label="备注"
            >
              <Input placeholder="可选" />
            </Form.Item>
          </Form>
        }
        actions={[
          [
            {
              key: 'cancel',
              text: '取消',
              onClick: () => {
                setShowAddDialog(false);
                form.resetFields();
              },
            },
            {
              key: 'confirm',
              text: '确定',
              bold: true,
              onClick: () => form.submit(),
            },
          ],
        ]}
      />
    </div>
  );
};

export default Holdings;
