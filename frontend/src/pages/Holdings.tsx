import React, { useState } from 'react';
import { Card, List, Button, Dialog, Form, Input, Toast, SwipeAction } from 'antd-mobile';
import { AddOutline } from 'antd-mobile-icons';
import { useHoldings, addTransaction, deleteHolding } from '../hooks/useDB';
import { useFunds } from '../hooks/useDB';
import { formatMoney, formatPercent } from '../utils';
import './Layout.css';

const Holdings: React.FC = () => {
  const { holdings, loading, refresh } = useHoldings();
  const { funds } = useFunds();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [form] = Form.useForm();

  // 计算汇总数据
  const totalAssets = holdings.reduce((sum, h) => sum + (h.currentValue || h.totalCost), 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.totalCost, 0);
  const totalProfit = totalAssets - totalCost;
  const totalProfitRate = totalCost > 0 ? totalProfit / totalCost : 0;

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

      {/* 持仓列表 */}
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
