import React, { useState } from 'react';
import { Card, List, Button, Dialog, Form, Input, Toast, Tag, Picker, SwipeAction } from 'antd-mobile';
import { useStrategies } from '../hooks/useSync';
import { runBacktest, buildPriceDataFromHistory } from '../services/backtest';
import { fetchFundHistory } from '../services/fundApi';
import { formatMoney, formatPercent } from '../utils';
import type { Strategy, BacktestResult, StrategyRule } from '../types';
import './Layout.css';

const StrategyPage: React.FC = () => {
  const { strategies, refresh } = useStrategies();
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [showBacktestDialog, setShowBacktestDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddRuleDialog, setShowAddRuleDialog] = useState(false);
  const [form] = Form.useForm();
  const [createForm] = Form.useForm();
  const [ruleForm] = Form.useForm();
  const [customRules, setCustomRules] = useState<StrategyRule[]>([]);

  const runStrategyBacktest = async (values: any) => {
    if (!selectedStrategy) return;

    try {
      Toast.show({ content: '正在获取历史数据...', position: 'bottom' });

      // 获取真实历史净值数据
      const priceData = await buildPriceDataFromHistory(
        values.fundCode,
        values.startDate,
        values.endDate,
        async (code, start, end) => {
          const data = await fetchFundHistory(code, 100, 1, start);
          // 过滤日期范围内的数据
          return data
            .filter(item => item.date >= start && item.date <= end)
            .map(item => ({ date: item.date, nav: item.nav }));
        }
      );

      if (priceData.length === 0) {
        Toast.show({ content: '未获取到历史数据，请检查基金代码', position: 'bottom' });
        return;
      }

      Toast.show({ content: '回测运行中...', position: 'bottom' });

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
      console.error('回测失败:', error);
      Toast.show({
        content: error instanceof Error ? error.message : '回测失败',
        position: 'bottom'
      });
    }
  };

  const handleCreateStrategy = async (values: any) => {
    try {
      if (customRules.length === 0) {
        Toast.show({ content: '请至少添加一条规则', position: 'bottom' });
        return;
      }

      const newStrategy: Strategy = {
        id: `s_${Date.now()}`,
        name: values.name,
        description: values.description,
        type: 'custom',
        rules: customRules,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 保存到本地存储
      const savedStrategies = JSON.parse(localStorage.getItem('customStrategies') || '[]');
      savedStrategies.push(newStrategy);
      localStorage.setItem('customStrategies', JSON.stringify(savedStrategies));

      Toast.show({ content: '策略创建成功', position: 'bottom' });
      setShowCreateDialog(false);
      setCustomRules([]);
      createForm.resetFields();
      
      // 刷新策略列表
      if (refresh) refresh();
    } catch (error) {
      Toast.show({ content: '创建失败', position: 'bottom' });
    }
  };

  const handleAddRule = (values: any) => {
    const newRule: StrategyRule = {
      condition: values.condition,
      action: values.action,
      params: { ratio: Number(values.ratio) },
    };
    setCustomRules([...customRules, newRule]);
    setShowAddRuleDialog(false);
    ruleForm.resetFields();
  };

  const handleDeleteRule = (index: number) => {
    setCustomRules(customRules.filter((_, i) => i !== index));
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

  const getActionText = (action: string) => {
    const actions: Record<string, string> = {
      'buy': '买入',
      'sell': '卖出',
      'hold': '持有',
    };
    return actions[action] || action;
  };

  // 合并系统策略和自定义策略
  const customStrategies = JSON.parse(localStorage.getItem('customStrategies') || '[]');
  const allStrategies = [...strategies, ...customStrategies];

  return (
    <div className="page-container">
      <h1 className="page-title">投资策略</h1>

      <div style={{ marginBottom: 12 }}>
        <Button 
          block 
          color="primary" 
          onClick={() => setShowCreateDialog(true)}
        >
          + 创建自定义策略
        </Button>
      </div>

      <Card title={`策略列表 (${allStrategies.length})`} className="card">
        {allStrategies.map(strategy => (
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
                <Tag 
                  color={strategy.type === 'custom' ? 'warning' : 'primary'} 
                  style={{ fontSize: 11 }}
                >
                  {getStrategyTypeText(strategy.type)}
                </Tag>
                <Tag style={{ fontSize: 11, marginLeft: 8 }}>
                  {strategy.rules.length}条规则
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
              <Tag color={selectedStrategy.type === 'custom' ? 'warning' : 'primary'}>
                {getStrategyTypeText(selectedStrategy.type)}
              </Tag>
            </div>

            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
              策略规则:
            </div>
            <List>
              {selectedStrategy.rules.map((rule, index) => (
                <List.Item
                  key={index}
                  title={`规则 ${index + 1}`}
                  description={`${rule.condition} → ${getActionText(rule.action)} ${rule.params.ratio || ''}`}
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

            {[
              { label: '初始资金', value: formatMoney(backtestResult.initialCapital) },
              { label: '最终资产', value: formatMoney(backtestResult.finalValue) },
              { 
                label: '总收益率', 
                value: `${backtestResult.totalReturn >= 0 ? '+' : ''}${formatPercent(backtestResult.totalReturn)}`,
                color: backtestResult.totalReturn >= 0 ? '#ff4d4f' : '#52c41a'
              },
              { 
                label: '年化收益率', 
                value: `${backtestResult.annualizedReturn >= 0 ? '+' : ''}${formatPercent(backtestResult.annualizedReturn)}` 
              },
              { label: '最大回撤', value: formatPercent(backtestResult.maxDrawdown), color: '#ff4d4f' },
              { label: '夏普比率', value: backtestResult.sharpeRatio.toFixed(2) },
              { label: '交易次数', value: `${backtestResult.trades} 次` },
            ].map((item, index) => (
              <div key={index} className="list-item">
                <span>{item.label}</span>
                <span style={{ fontWeight: 500, color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 创建策略对话框 */}
      <Dialog
        visible={showCreateDialog}
        title="创建自定义策略"
        content={
          <div>
            <Form
              form={createForm}
              layout="vertical"
            >
              <Form.Item
                name="name"
                label="策略名称"
                rules={[{ required: true, message: '请输入策略名称' }]}
              >
                <Input placeholder="如: 我的定投策略" />
              </Form.Item>

              <Form.Item
                name="description"
                label="策略描述"
              >
                <Input placeholder="描述策略的核心逻辑" />
              </Form.Item>
            </Form>

            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 500 }}>策略规则 ({customRules.length})</span>
                <Button 
                  size="small" 
                  color="primary"
                  onClick={() => setShowAddRuleDialog(true)}
                >
                  添加规则
                </Button>
              </div>

              {customRules.length > 0 ? (
                <List>
                  {customRules.map((rule, index) => (
                    <SwipeAction
                      key={index}
                      rightActions={[
                        {
                          key: 'delete',
                          text: '删除',
                          color: 'danger',
                          onClick: () => handleDeleteRule(index),
                        },
                      ]}
                    >
                      <List.Item
                        title={`规则 ${index + 1}`}
                        description={`${rule.condition} → ${getActionText(rule.action)}`}
                      />
                    </SwipeAction>
                  ))}
                </List>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                  点击"添加规则"创建策略规则
                </div>
              )}
            </div>
          </div>
        }
        actions={[
          [
            {
              key: 'cancel',
              text: '取消',
              onClick: () => {
                setShowCreateDialog(false);
                setCustomRules([]);
                createForm.resetFields();
              },
            },
            {
              key: 'confirm',
              text: '创建',
              bold: true,
              onClick: async () => {
                const values = createForm.getFieldsValue();
                await handleCreateStrategy(values);
              },
            },
          ],
        ]}
      />

      {/* 添加规则对话框 */}
      <Dialog
        visible={showAddRuleDialog}
        title="添加规则"
        content={
          <Form
            form={ruleForm}
            layout="vertical"
            onFinish={handleAddRule}
          >
            <Form.Item
              name="condition"
              label="触发条件"
              rules={[{ required: true, message: '请输入触发条件' }]}
            >
              <Input placeholder="如: 价格下跌5%" />
            </Form.Item>

            <Form.Item
              name="action"
              label="执行动作"
              rules={[{ required: true }]}
              initialValue="buy"
            >
              <div>
                {[
                  { value: 'buy', label: '买入' },
                  { value: 'sell', label: '卖出' },
                  { value: 'hold', label: '持有' },
                ].map(opt => (
                  <Button
                    key={opt.value}
                    size="small"
                    style={{ marginRight: 8, marginBottom: 8 }}
                    color={ruleForm.getFieldValue('action') === opt.value ? 'primary' : 'default'}
                    onClick={() => ruleForm.setFieldsValue({ action: opt.value })}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </Form.Item>

            <Form.Item
              name="ratio"
              label="比例/金额"
              rules={[{ required: true, message: '请输入比例' }]}
              initialValue={1.0}
            >
              <Input type="number" placeholder="如: 1.0 表示100%" />
            </Form.Item>
          </Form>
        }
        actions={[
          [
            {
              key: 'cancel',
              text: '取消',
              onClick: () => setShowAddRuleDialog(false),
            },
            {
              key: 'confirm',
              text: '添加',
              bold: true,
              onClick: () => ruleForm.submit(),
            },
          ],
        ]}
      />

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
