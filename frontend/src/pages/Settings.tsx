import React, { useState, useRef } from 'react';
import { Card, List, Button, Toast, Dialog } from 'antd-mobile';
import { exportDatabase, importDatabase, resetDatabase } from '../db';
import { useTransactions, useHoldings } from '../hooks/useSync';
import { exportHoldingsToCSV, exportTransactionsToCSV, importTransactionsFromCSV, formatLocalDate } from '../utils/csv';
import { addTransactionWithHoldingUpdate, processPendingTransactions } from '../services/navUpdateService';
import { dispatchDataChanged } from '../utils/dataChangeEvent';
import './Layout.css';

const Settings: React.FC = () => {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const { transactions, refresh } = useTransactions();
  const { holdings } = useHoldings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);

  const handleReset = async () => {
    Dialog.confirm({
      title: '重置数据',
      content: '确定要清空所有数据吗？此操作不可恢复。',
      onConfirm: async () => {
        try {
          await resetDatabase();
          Toast.show({ content: '数据已重置', position: 'bottom' });
          dispatchDataChanged();
        } catch (err) {
          Toast.show({ content: `重置失败: ${err instanceof Error ? err.message : '未知错误'}`, position: 'bottom' });
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
      link.download = `myfundsys-backup-${formatLocalDate(new Date())}.json`;
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

    let content: string;
    try {
      content = await file.text();
    } catch {
      Toast.show({ content: '读取文件失败', position: 'bottom' });
      return;
    }
    // 安全：导入会清空当前所有数据，需二次确认（与 handleReset 一致，修复破坏性无确认）
    Dialog.confirm({
      title: '导入数据',
      content: '导入将清空当前所有数据并替换为备份内容，确定继续？',
      onConfirm: async () => {
        try {
          setImporting(true);
          await importDatabase(content);
          Toast.show({ content: '导入成功', position: 'bottom' });
          dispatchDataChanged();
        } catch {
          Toast.show({ content: '导入失败', position: 'bottom' });
        } finally {
          setImporting(false);
        }
      },
    });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleCsvImportClick = () => {
    csvFileInputRef.current?.click();
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCsvImporting(true);
      const content = await file.text();
      const parsedTransactions = importTransactionsFromCSV(content);

      if (parsedTransactions.length === 0) {
        Toast.show({ content: 'CSV 文件中没有有效交易记录', position: 'bottom' });
        return;
      }

      // 批量导入交易（修复 N：去重 + 失败明细 + 导入后触发在途处理）
      // 去重键：基金代码|日期|类型|份额|金额，与现有交易及本批已导入的比对
      const dedupKey = (t: { fundCode: string; date: string; type: string; shares: number; amount: number }) =>
        `${t.fundCode}|${t.date}|${t.type}|${t.shares}|${t.amount}`;
      const seen = new Set<string>(
        transactions.map(t => dedupKey({ fundCode: t.fundCode, date: t.date, type: t.type, shares: t.shares, amount: t.amount }))
      );

      let successCount = 0;
      let failCount = 0;
      let skippedCount = 0;
      const errorDetails: string[] = [];
      for (let i = 0; i < parsedTransactions.length; i++) {
        const tx = parsedTransactions[i];
        const key = dedupKey(tx);
        if (seen.has(key)) {
          skippedCount++;
          continue;
        }
        try {
          await addTransactionWithHoldingUpdate(tx);
          seen.add(key);
          successCount++;
        } catch (err) {
          failCount++;
          const msg = err instanceof Error ? err.message : '未知错误';
          if (errorDetails.length < 5) errorDetails.push(`第 ${i + 1} 笔: ${msg}`);
        }
      }

      // 导入后处理在途交易（导入的历史交易若 pending 可被即时确认）
      try {
        await processPendingTransactions();
      } catch (e) { /* 在途处理失败不阻塞导入结果提示，但记录 */
        console.warn('导入后在途处理失败:', e);
      }

      const parts = [`${successCount} 成功`];
      if (skippedCount > 0) parts.push(`${skippedCount} 重复跳过`);
      if (failCount > 0) parts.push(`${failCount} 失败`);
      const resultMsg = failCount > 0 && errorDetails.length > 0
        ? `导入完成: ${parts.join(', ')}\n${errorDetails.join('\n')}`
        : `导入完成: ${parts.join(', ')}`;
      Toast.show({ content: resultMsg, position: 'bottom', duration: failCount > 0 ? 5000 : 2000 });

      await refresh();
    } catch {
      Toast.show({ content: 'CSV 导入失败，请检查文件格式', position: 'bottom' });
    } finally {
      setCsvImporting(false);
      // 重置 file input
      if (e.target) e.target.value = '';
    }
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
            title="导入交易记录 (CSV)"
            description="从 CSV 文件批量导入交易"
            arrow={false}
          >
            <input
              ref={csvFileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCsvImport}
              style={{ display: 'none' }}
            />
            <Button size="mini" color="primary" loading={csvImporting} onClick={handleCsvImportClick}>
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
