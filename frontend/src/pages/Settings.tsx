import React, { useState } from 'react';
import { Card, List, Button, Toast, Dialog, Form, Input } from 'antd-mobile';
import { exportDatabase, importDatabase } from '../db';
import { downloadJSON, readJSONFile } from '../utils';
import './Layout.css';

const Settings: React.FC = () => {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

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

  const showAbout = () => {
    Dialog.alert({
      title: '关于 MyFundSys',
      content: (
        <div style={{ textAlign: 'center' }}>
          <p><strong>MyFundSys v2.0.0</strong></p>
          <p>基于 E大（ETF拯救世界）投资理念的基金投资管理系统</p>
          <p style={{ fontSize: 12, color: '#999' }}>
            技术栈: React + TypeScript + Vite + IndexedDB
          </p>
          <p style={{ fontSize: 12, color: '#999' }}>
            数据存储: 浏览器本地存储
          </p>
        </div>
      ),
    });
  };

  const showHelp = () => {
    Dialog.alert({
      title: '使用帮助',
      content: (
        <div style={{ fontSize: 14, lineHeight: 1.6 }}>
          <p><strong>1. 添加基金持仓</strong></p>
          <p>在"持仓"页面点击"添加交易"，输入基金代码、交易金额和价格。系统会自动计算份额并更新持仓。</p>
          
          <p><strong>2. 查看E大文章</strong></p>
          <p>在"文章"页面可以阅读E大的投资文章，学习投资理念。</p>
          
          <p><strong>3. 策略回测</strong></p>
          <p>在"策略"页面选择策略并运行回测，查看策略历史表现。</p>
          
          <p><strong>4. 数据备份</strong></p>
          <p>定期导出数据备份，防止数据丢失。也可以导入之前备份的数据。</p>
        </div>
      ),
    });
  };

  return (
    <div className="page-container">
      <h1 className="page-title">设置</h1>

      <Card title="数据管理" className="card">
        <List>
          <List.Item
            title="导出数据"
            description="将数据导出为JSON文件备份"
            onClick={handleExport}
            arrow={false}
          >
            <Button size="small" color="primary" loading={exporting}>
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
              <Button size="small" color="primary" loading={importing}>
                导入
              </Button>
            </label>
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
        MyFundSys v2.0.0
        <br />
        基于 E大投资理念
      </div>
    </div>
  );
};

export default Settings;
