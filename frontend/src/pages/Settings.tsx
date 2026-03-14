import React, { useState, useEffect } from 'react';
import { Card, List, Button, Toast, Dialog, Tag, Switch, Input, Space } from 'antd-mobile';
import { CheckCircleOutline, ClockCircleOutline, MessageOutline, SendOutline } from 'antd-mobile-icons';
import { exportDatabase, importDatabase, initDefaultTasks } from '../db';
import { useSyncStatus, useHoldings, useTransactions } from '../hooks/useSync';
import { getScheduledTasks, toggleTask, runTaskManually, PRESET_SCHEDULES } from '../services/schedulerService';
import { getFeishuConfig, saveFeishuConfig, testWebhook } from '../services/feishuService';
import { isSupabaseConfigured } from '../lib/supabase';
import { exportHoldingsToCSV, exportTransactionsToCSV } from '../utils/csv';
import type { ScheduledTask, FeishuConfig } from '../db';
import './Layout.css';

const Settings: React.FC = () => {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const { holdings } = useHoldings();
  const { transactions } = useTransactions();
  const { status: syncStatus, triggerSync, triggerFullSync } = useSyncStatus();
  const isConfigured = isSupabaseConfigured();

  // 定时任务状态
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [runningTask, setRunningTask] = useState<number | null>(null);

  // 飞书配置状态
  const [feishuConfig, setFeishuConfig] = useState<FeishuConfig | null>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [editingFeishu, setEditingFeishu] = useState(false);

  // 初始化
  useEffect(() => {
    initDefaultTasks();
    loadTasks();
    loadFeishuConfig();
  }, []);

  const loadTasks = async () => {
    const data = await getScheduledTasks();
    setTasks(data);
  };

  const loadFeishuConfig = async () => {
    const config = await getFeishuConfig();
    setFeishuConfig(config || null);
  };

  // 导出/导入
  const handleExport = async () => {
    try {
      setExporting(true);
      const data = await exportDatabase();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `myfundsys-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      Toast.show({ content: '导出成功', position: 'bottom' });
    } catch (error) {
      Toast.show({ content: '导出失败', position: 'bottom' });
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      const content = await file.text();
      await importDatabase(content);
      Toast.show({ content: '导入成功', position: 'bottom' });
      window.location.reload();
    } catch (error) {
      Toast.show({ content: '导入失败', position: 'bottom' });
    } finally {
      setImporting(false);
    }
  };

  // 定时任务操作
  const handleToggleTask = async (task: ScheduledTask) => {
    if (!task.id) return;
    await toggleTask(task.id, !task.enabled);
    await loadTasks();
    Toast.show({ 
      content: `已${!task.enabled ? '启用' : '禁用'} ${task.name}`, 
      position: 'bottom' 
    });
  };

  const handleRunTask = async (task: ScheduledTask) => {
    if (!task.id || runningTask) return;
    
    setRunningTask(task.id);
    try {
      const result = await runTaskManually(task.id);
      if (result.status === 'success') {
        Toast.show({ content: `${task.name} 执行成功`, position: 'bottom' });
      } else {
        Toast.show({ content: `${task.name} 执行失败: ${result.error}`, position: 'bottom' });
      }
    } finally {
      setRunningTask(null);
      await loadTasks();
    }
  };

  // 飞书配置操作
  const handleSaveFeishu = async (config: Partial<FeishuConfig>) => {
    await saveFeishuConfig(config as Omit<FeishuConfig, 'id' | 'createdAt' | 'updatedAt'>);
    await loadFeishuConfig();
    setEditingFeishu(false);
    Toast.show({ content: '保存成功', position: 'bottom' });
  };

  const handleTestWebhook = async () => {
    if (!feishuConfig?.webhookUrl) return;
    
    setTestingWebhook(true);
    const result = await testWebhook(feishuConfig.webhookUrl, feishuConfig.secret);
    setTestingWebhook(false);
    
    if (result.success) {
      Toast.show({ content: '连接测试成功', position: 'bottom' });
    } else {
      Toast.show({ content: `测试失败: ${result.message}`, position: 'bottom' });
    }
  };

  // 格式化上次同步时间
  const formatLastSync = () => {
    if (!syncStatus.lastSyncTime) return '从未同步';
    const date = new Date(syncStatus.lastSyncTime);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return date.toLocaleString('zh-CN');
  };

  return (
    <div className="page-container">
      <h1 className="page-title">设置</h1>

      {/* 同步状态卡片 */}
      {isConfigured && (
        <Card 
          title={
            <Space>
              <SendOutline />
              <span>数据同步</span>
            </Space>
          }
          className="card"
          style={{ 
            background: syncStatus.isOnline ? '#f6ffed' : '#fff7e6',
            border: syncStatus.isOnline ? '1px solid #b7eb8f' : '1px solid #ffd591'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>
                {syncStatus.isOnline ? '在线' : '离线'}
              </div>
              <div style={{ fontSize: 13, color: '#666' }}>
                上次同步: {formatLastSync()}
              </div>
            </div>
            <Tag color={syncStatus.isOnline ? 'success' : 'warning'}>
              {syncStatus.isOnline ? '已连接' : '离线'}
            </Tag>
          </div>
          
          {syncStatus.pendingChanges > 0 && (
            <div style={{ marginBottom: 12, color: '#fa8c16' }}>
              有 {syncStatus.pendingChanges} 条数据待同步
            </div>
          )}

          <Space>
            <Button 
              size="mini" 
              color="primary"
              loading={syncStatus.isSyncing}
              onClick={() => triggerSync()}
            >
              立即同步
            </Button>
            <Button 
              size="mini" 
              onClick={() => triggerFullSync()}
            >
              强制全量同步
            </Button>
          </Space>
        </Card>
      )}

      {/* 定时任务配置 */}
      <Card 
        title={
          <Space>
            <ClockCircleOutline />
            <span>定时任务（预留）</span>
          </Space>
        }
        className="card"
      >
        <div style={{ marginBottom: 12, fontSize: 13, color: '#999' }}>
          ⚠️ 当前为演示功能，需要在后端部署后才能真正定时执行
        </div>
        <List>
          {tasks.map(task => (
            <List.Item
              key={task.id}
              title={
                <Space>
                  {task.name}
                  {task.enabled && <Tag color="success">已启用</Tag>}
                </Space>
              }
              description={
                <div style={{ fontSize: 12 }}>
                  {task.enabled && task.nextRunAt && (
                    <div>下次执行: {new Date(task.nextRunAt).toLocaleString('zh-CN')}</div>
                  )}
                  {task.lastRunAt && (
                    <div>上次执行: {new Date(task.lastRunAt).toLocaleString('zh-CN')}</div>
                  )}
                </div>
              }
              arrow={false}
            >
              <Space>
                <Switch
                  checked={task.enabled}
                  onChange={() => handleToggleTask(task)}
                />
                <Button
                  size="mini"
                  loading={runningTask === task.id}
                  onClick={() => handleRunTask(task)}
                >
                  执行
                </Button>
              </Space>
            </List.Item>
          ))}
        </List>
      </Card>

      {/* 飞书推送配置 */}
      <Card 
        title={
          <Space>
            <MessageOutline />
            <span>飞书推送</span>
          </Space>
        }
        className="card"
      >
        {!editingFeishu && feishuConfig ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <Tag color={feishuConfig.enabled ? 'success' : 'default'}>
                {feishuConfig.enabled ? '已启用' : '已禁用'}
              </Tag>
            </div>
            <List>
              <List.Item title="Webhook" description={feishuConfig.webhookUrl.slice(0, 30) + '...'} />
              <List.Item 
                title="通知设置"
                description={
                  <Space wrap>
                    {feishuConfig.notifyOn.dailyReport && <Tag>日报</Tag>}
                    {feishuConfig.notifyOn.weeklyReport && <Tag>周报</Tag>}
                    {feishuConfig.notifyOn.largeFluctuation && <Tag>波动提醒</Tag>}
                    {feishuConfig.notifyOn.transactionAdded && <Tag>交易提醒</Tag>}
                  </Space>
                }
              />
            </List>
            <Space style={{ marginTop: 12 }}>
              <Button size="mini" onClick={() => setEditingFeishu(true)}>
                编辑配置
              </Button>
              <Button 
                size="mini" 
                color="primary"
                loading={testingWebhook}
                onClick={handleTestWebhook}
              >
                测试连接
              </Button>
            </Space>
          </>
        ) : (
          <FeishuConfigForm 
            initialConfig={feishuConfig}
            onSave={handleSaveFeishu}
            onCancel={() => setEditingFeishu(false)}
          />
        )}
      </Card>

      {/* 数据管理 */}
      <Card title="数据管理 (JSON)" className="card">
        <List>
          <List.Item
            title="导出数据"
            description="将数据导出为JSON文件备份"
            onClick={handleExport}
            arrow={false}
          >
            <Button size="mini" color="primary" loading={exporting}>
              导出
            </Button>
          </List.Item>

          <List.Item
            title="导入数据"
            description="从JSON文件恢复数据"
            arrow={false}
          >
            <label>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                style={{ display: 'none' }}
              />
              <Button size="mini" color="primary" loading={importing}>
                导入
              </Button>
            </label>
          </List.Item>
        </List>
      </Card>

      <Card title="数据导出 (CSV)" className="card">
        <List>
          <List.Item
            title="导出持仓"
            description="导出持仓数据为Excel格式"
            onClick={() => exportHoldingsToCSV(holdings)}
            arrow={false}
          >
            <Button size="mini" color="primary">
              导出
            </Button>
          </List.Item>

          <List.Item
            title="导出交易记录"
            description="导出交易记录为Excel格式"
            onClick={() => exportTransactionsToCSV(transactions)}
            arrow={false}
          >
            <Button size="mini" color="primary">
              导出
            </Button>
          </List.Item>
        </List>
      </Card>

      <Card title="关于" className="card">
        <List>
          <List.Item
            title="使用帮助"
            onClick={showHelp}
            arrow
          />
          <List.Item
            title="关于 MyFundSys"
            onClick={showAbout}
            arrow
          />
        </List>
      </Card>

      <Card className="card" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
        <div style={{ fontSize: 14, color: '#389e0d', lineHeight: 1.6 }}>
          <strong>E大投资理念</strong>
          <ul style={{ margin: '8px 0', paddingLeft: 16 }}>
            <li>概率思维 - 追求长期胜率</li>
            <li>估值为锚 - 低买高卖</li>
            <li>仓位管理 - 活着最重要</li>
            <li>资产配置 - 分散投资</li>
            <li>逆向投资 - 别人恐惧我贪婪</li>
          </ul>
        </div>
      </Card>

      <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: 12 }}>
        MyFundSys v2.2.0
        <br />
        基于 E大投资理念
        {isConfigured && <><br /><span style={{ color: '#52c41a' }}>已启用云同步</span></>}
      </div>
    </div>
  );
};

// 飞书配置表单组件
interface FeishuConfigFormProps {
  initialConfig: FeishuConfig | null;
  onSave: (config: Partial<FeishuConfig>) => void;
  onCancel: () => void;
}

const FeishuConfigForm: React.FC<FeishuConfigFormProps> = ({ initialConfig, onSave, onCancel }) => {
  const [webhookUrl, setWebhookUrl] = useState(initialConfig?.webhookUrl || '');
  const [secret, setSecret] = useState(initialConfig?.secret || '');
  const [enabled, setEnabled] = useState(initialConfig?.enabled ?? true);
  const [dailyReport, setDailyReport] = useState(initialConfig?.notifyOn.dailyReport ?? true);
  const [weeklyReport, setWeeklyReport] = useState(initialConfig?.notifyOn.weeklyReport ?? true);
  const [largeFluctuation, setLargeFluctuation] = useState(initialConfig?.notifyOn.largeFluctuation ?? true);
  const [transactionAdded, setTransactionAdded] = useState(initialConfig?.notifyOn.transactionAdded ?? false);

  const handleSave = () => {
    if (!webhookUrl) {
      Toast.show({ content: '请输入 Webhook 地址', position: 'bottom' });
      return;
    }
    onSave({
      webhookUrl,
      secret: secret || undefined,
      enabled,
      notifyOn: {
        dailyReport,
        weeklyReport,
        largeFluctuation,
        transactionAdded,
      },
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, fontSize: 14 }}>Webhook 地址</div>
        <Input
          placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
          value={webhookUrl}
          onChange={setWebhookUrl}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, fontSize: 14 }}>签名密钥（可选）</div>
        <Input
          placeholder="如开启签名验证，请填写"
          value={secret}
          onChange={setSecret}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, fontSize: 14 }}>通知内容</div>
        <Space direction="vertical" style={{ '--gap': '8px' } as any}>
          <Checkbox checked={dailyReport} onChange={setDailyReport}>每日日报</Checkbox>
          <Checkbox checked={weeklyReport} onChange={setWeeklyReport}>每周周报</Checkbox>
          <Checkbox checked={largeFluctuation} onChange={setLargeFluctuation}>大涨大跌提醒</Checkbox>
          <Checkbox checked={transactionAdded} onChange={setTransactionAdded}>交易添加提醒</Checkbox>
        </Space>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Space>
          <span>启用推送</span>
          <Switch checked={enabled} onChange={setEnabled} />
        </Space>
      </div>

      <Space>
        <Button size="mini" onClick={onCancel}>取消</Button>
        <Button size="mini" color="primary" onClick={handleSave}>保存</Button>
      </Space>
    </div>
  );
};

// 简单的复选框组件
const Checkbox: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; children: React.ReactNode }> = ({
  checked,
  onChange,
  children,
}) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span>{children}</span>
  </label>
);

const showHelp = () => {
  Dialog.alert({
    title: '使用帮助',
    content: (
      <div style={{ fontSize: 14, lineHeight: 1.6 }}>
        <p><strong>1. 系统访问</strong></p>
        <p>本系统为私人使用，输入密码 888 即可访问。</p>
        
        <p><strong>2. 数据同步</strong></p>
        <p>配置 Supabase 后，数据会自动同步到云端，支持多设备访问。离线时的数据会先保存在本地，恢复网络后自动同步。</p>
        
        <p><strong>3. 定时任务</strong></p>
        <p>当前为演示功能，需要在后端部署后才能自动执行。可以手动触发测试。</p>
        
        <p><strong>4. 飞书推送</strong></p>
        <p>配置飞书机器人 Webhook 后，可以接收投资日报和提醒。</p>
        
        <p><strong>5. 数据备份</strong></p>
        <p>定期导出数据备份，防止数据丢失。</p>
      </div>
    ),
  });
};

const showAbout = () => {
  Dialog.alert({
    title: '关于 MyFundSys',
    content: (
      <div style={{ textAlign: 'center' }}>
        <p><strong>MyFundSys v2.2.0</strong></p>
        <p>基于 E大（ETF拯救世界）投资理念的基金投资管理系统</p>
        <p style={{ fontSize: 12, color: '#999' }}>
          技术栈: React + TypeScript + Vite + Supabase
        </p>
        <p style={{ fontSize: 12, color: '#52c41a' }}>
          访问控制: 密码保护模式
        </p>
        <p style={{ fontSize: 12, color: '#52c41a' }}>
          数据存储: 离线优先 + 云端同步
        </p>
      </div>
    ),
  });
};

export default Settings;
