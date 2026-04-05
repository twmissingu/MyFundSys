import React, { useState, useRef } from 'react';
import { Card, List, Button, Toast, Dialog } from 'antd-mobile';
import { exportDatabase, importDatabase, resetDatabase } from '../db';
import { useHoldings, useTransactions } from '../hooks/useSync';
import { exportHoldingsToCSV, exportTransactionsToCSV } from '../utils/csv';
import './Layout.css';

const Settings: React.FC = () => {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const { holdings } = useHoldings();
  const { transactions } = useTransactions();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleReset = async () => {
    Dialog.confirm({
      title: '重置数据',
      content: '确定要清空所有数据吗？此操作不可恢复。',
      onConfirm: async () => {
        try {
          await resetDatabase();
          Toast.show({ content: '数据已重置', position: 'bottom' });
          window.location.reload();
        } catch {
          Toast.show({ content: '重置失败', position: 'bottom' });
        }
      },
    });
  };

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
    } catch {
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
    } catch {
      Toast.show({ content: '导入失败', position: 'bottom' });
    } finally {
      setImporting(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="page-container">
      <h1 className="page-title">设置</h1>

      {/* 数据管理 */}
      <Card title="数据管理" className="card">
        <List>
          <List.Item title="备份与恢复" />
          <List.Item
            title="导出 JSON 备份"
            description="导出完整数据用于备份或迁移"
            onClick={handleExport}
            arrow={false}
          >
            <Button size="mini" color="primary" loading={exporting}>
              导出
            </Button>
          </List.Item>
          <List.Item
            title="导入 JSON 备份"
            description="从备份文件恢复数据"
            arrow={false}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
            <Button size="mini" color="primary" loading={importing} onClick={handleImportClick}>
              导入
            </Button>
          </List.Item>
          <List.Item
            title="重置数据"
            description="清空所有数据并恢复初始状态"
            onClick={handleReset}
            arrow={false}
          >
            <Button size="mini" color="danger">
              重置
            </Button>
          </List.Item>

          <List.Item title="导出报表" />
          <List.Item
            title="导出持仓 (CSV)"
            description="Excel 可读的持仓数据"
            onClick={() => exportHoldingsToCSV(holdings)}
            arrow={false}
          >
            <Button size="mini" color="primary">
              导出
            </Button>
          </List.Item>
          <List.Item
            title="导出交易记录 (CSV)"
            description="Excel 可读的交易数据"
            onClick={() => exportTransactionsToCSV(transactions)}
            arrow={false}
          >
            <Button size="mini" color="primary">
              导出
            </Button>
          </List.Item>
        </List>
      </Card>
    </div>
  );
};

export default Settings;
