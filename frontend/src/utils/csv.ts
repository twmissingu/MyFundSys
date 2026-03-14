import React, { useState } from 'react';
import { Card, List, Button, Toast, Dialog, Tag } from 'antd-mobile';
import { DownlandOutline, UploadOutline } from 'antd-mobile-icons';
import { useHoldings, useTransactions } from '../hooks/useSync';
import { formatMoney, formatDate } from '../utils';
import type { Holding, Transaction } from '../types';

// CSV 导出函数
export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) {
    Toast.show({ content: '没有数据可导出', position: 'bottom' });
    return;
  }

  // 获取表头
  const headers = Object.keys(data[0]);
  
  // 构建CSV内容
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // 处理包含逗号或引号的值
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    )
  ].join('\n');

  // 添加BOM以支持中文
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  Toast.show({ content: '导出成功', position: 'bottom' });
}

// CSV 解析函数
export function parseCSV(csvText: string): any[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] ?? '';
    });
    return obj;
  });
}

// 解析CSV行（处理引号）
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // 跳过下一个引号
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// 导出持仓数据
export function exportHoldingsToCSV(holdings: Holding[]) {
  const data = holdings.map(h => ({
    '基金代码': h.fundCode,
    '基金名称': h.fundName,
    '持有份额': h.shares,
    '平均成本': h.avgCost,
    '总成本': h.totalCost,
    '当前市值': h.currentValue || '',
    '盈亏金额': h.profit || '',
    '盈亏比例': h.profitRate ? `${(h.profitRate * 100).toFixed(2)}%` : '',
  }));
  
  exportToCSV(data, `持仓数据_${formatDate(new Date().toISOString())}.csv`);
}

// 导出交易记录
export function exportTransactionsToCSV(transactions: Transaction[]) {
  const data = transactions.map(t => ({
    '日期': t.date,
    '基金代码': t.fundCode,
    '基金名称': t.fundName,
    '类型': t.type === 'buy' ? '买入' : '卖出',
    '金额': t.amount,
    '价格': t.price,
    '份额': t.shares,
    '手续费': t.fee || '',
    '备注': t.remark || '',
  }));
  
  exportToCSV(data, `交易记录_${formatDate(new Date().toISOString())}.csv`);
}
