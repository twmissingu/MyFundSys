import React, { useState } from 'react';
import { Card, List, Button, Dialog, Form, Input, Toast, Tabs, Tag } from 'antd-mobile';
import { useStrategies } from '../hooks/useDB';
import { runBacktest, generateMockPriceData } from '../services/backtest';
import { formatMoney, formatPercent } from '../utils';
import type { Strategy, BacktestResult } from '../types';
import './Layout.css';

const StrategyPage: React.FC = () => {
  const { strategies, loading } = useStrategies();
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [showBacktestDialog, setShowBacktestDialog] = useState(false);
  const [form] = Form.useForm();

  const runStrategyBacktest = async (values: any) => {
    if (!selectedStrategy) return;

    try {
      Toast.show({ content: '回测运行中...', position: 'bottom' });
      
      // 生成模拟价格数据
      const priceData = generateMockPriceData(
        values.startDate,
        values.endDate,
        Number(values.basePrice)
      );

      const result = await runBacktest({
        strategy: selectedStrategy,
        fundCode: values.fundCode,
        startDate: values.startDate,
        endDate: values.endDate,
        initialCapital: Number(values.initialCapital),
        priceData,
      });

      setBacktestResult(result);
      setShowBacktestDialog(false);
      Toast.show({ content: '回测完成', position: 'bottom' });
    } catch (error) {
      Toast.show({ content: '回测失败', position: 'bottom' });
    }
  };

  const getStrategyTypeText = (type: string) => {
    const types: Record<string, string> = {
      'valuation': '估值策略',
      'trend': '趋势策略',
      'grid': '网格策略',
      'custom': '自定义策略',
    };
    return types[type] || type;
  };

  return (
    <div className="page-container">
      <h1 className="page-title">投资策略</h1>

      <Card title="策略列表" className="card">
        {strategies.map(strategy => (
          <div 
            key={strategy.id} 
            className="list-item"
            onClick={() => setSelectedStrategy(strategy)}
            style={{ cursor: 'pointer' }}
          >
            <div className="item-left">
              <div className="item-title">{strategy.name}</div>
              <div className="item-subtitle">{strategy.description}</div>
              <div style={{ marginTop: 4 }}>
                <Tag color="primary" style={{ fontSize: 11 }}>
                  {getStrategyTypeText(strategy.type)}
                </Tag>
              </div>
            </div>
            <div className="item-right">
              <Button
                size="small"
                color="primary"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedStrategy(strategy);
                  setShowBacktestDialog(true);
                }}
              >
                回测
              </Button>
            </div>
          </div>
        ))}
      </Card>

      {/* 策略详情 */}
      {selectedStrategy && (
        <Card title="策略详情" className="card">
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
              {selectedStrategy.name}
            </div>
            <div style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>
              {selectedStrategy.description}
            </div>
            
            <div style={{ marginBottom: 12 }}>
              <Tag color="primary">{getStrategyTypeText(selectedStrategy.type)}</Tag>
            </div>

            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
              策略规则:
            </div>
            <List>
              {selectedStrategy.rules.map((rule, index) => (
                <List.Item
                  key={index}
                  title={`规则 ${index + 1}`}
                  description={`${rule.condition} → ${rule.action}`}
                />
              ))}
            </List>
          </div>

          <Button
            block
            color="primary"
            onClick={() => setShowBacktestDialog(true)}
          >
            运行回测
          </Button>
        </Card>
      )}

      {/* 回测结果 */}
      {backtestResult && (
        <Card title="回测结果" className="card">
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
              策略: {backtestResult.strategyName}
            </div>
            <div style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>
              回测区间: {backtestResult.startDate} 至 {backtestResult.endDate}
            </div>

            <div className="list-item">
              <span>初始资金</span>
              <span style={{ fontWeight: 500 }}>{formatMoney(backtestResult.initialCapital)}</span>
            </div>
            
            <div className="list-item">
              <span>最终资产</span>
              <span style={{ fontWeight: 500 }}>{formatMoney(backtestResult.finalValue)}</span>
            </div>
            
            <div className="list-item">
              <span>总收益率</span>
              <span 
                style={{ 
                  fontWeight: 500,
                  color: backtestResult.totalReturn >= 0 ? '#ff4d4f' : '#52c41a'
                }}
              >
                {backtestResult.totalReturn >= 0 ? '+' : ''}
                {formatPercent(backtestResult.totalReturn)}
              </span>
            </div>
            
            <div className="list-item">
              <span>年化收益率</span>
              <span style={{ fontWeight: 500 }}>
                {backtestResult.annualizedReturn >= 0 ? '+' : ''}
                {formatPercent(backtestResult.annualizedReturn)}
              </span>
            </div>
            
            <div className="list-item">
              <span>最大回撤</span>
              <span style={{ fontWeight: 500, color: '#ff4d4f' }}>
                {formatPercent(backtestResult.maxDrawdown)}
              </span>
            </div>
            
            <div className="list-item">
              <span>夏普比率</span>
              <span style={{ fontWeight: 500 }}>{backtestResult.sharpeRatio.toFixed(2)}</span>
            </div>
            
            <div className="list-item">
              <span>交易次数</span>
              <span style={{ fontWeight: 500 }}>{backtestResult.trades} 次</span>
            </div>
          </div>
        </Card>
      )}

      {/* 回测设置对话框 */}
      <Dialog
        visible={showBacktestDialog}
        title="回测设置"
        content={
          <Form
            form={form}
            layout="vertical"
            onFinish={runStrategyBacktest}
            initialValues={{
              fundCode: '510300',
              startDate: '2020-01-01',
              endDate: '2024-01-01',
              initialCapital: 100000,
              basePrice: 3.5,
            }}
          >
            <Form.Item
              name="fundCode"
              label="基金代码"
              rules={[{ required: true }]}
            >
              <Input placeholder="如: 510300" />
            </Form.Item>

            <Form.Item
              name="startDate"
              label="开始日期"
              rules={[{ required: true }]}
            >
              <Input type="date" />
            </Form.Item>

            <Form.Item
              name="endDate"
              label="结束日期"
              rules={[{ required: true }]}
            >
              <Input type="date" />
            </Form.Item>

            <Form.Item
              name="initialCapital"
              label="初始资金"
              rules={[{ required: true }]}
            >
              <Input type="number" placeholder="100000" />
            </Form.Item>

            <Form.Item
              name="basePrice"
              label="基准价格"
              rules={[{ required: true }]}
            >
              <Input type="number" placeholder="3.5" />
            </Form.Item>
          </Form>
        }
        actions={[
          [
            {
              key: 'cancel',
              text: '取消',
              onClick: () => setShowBacktestDialog(false),
            },
            {
              key: 'confirm',
              text: '运行回测',
              bold: true,
              onClick: () => form.submit(),
            },
          ],
        ]}
      />
    </div>
  );
};

export default StrategyPage;
