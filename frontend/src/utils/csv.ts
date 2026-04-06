import { Toast } from 'antd-mobile';
import { formatDate } from '../utils';
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

// 格式化日期为 YYYY-MM-DD 格式（避免时区问题）
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  
  exportToCSV(data, `持仓数据_${formatLocalDate(new Date())}.csv`);
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
  
  exportToCSV(data, `交易记录_${formatLocalDate(new Date())}.csv`);
}

// ============================================
// CSV 导入（与导出格式一致）
// ============================================

/**
 * 解析交易记录 CSV 文件
 * @param csvText CSV 文件内容
 * @returns 交易记录数组（需调用 saveTransaction 保存到数据库）
 * @throws CSV 格式错误时抛出异常
 */
export function importTransactionsFromCSV(csvText: string): Omit<Transaction, 'id' | 'createdAt'>[] {
  const rows = parseCSV(csvText);
  if (rows.length === 0) {
    throw new Error('CSV 文件为空');
  }

  // 验证表头
  const requiredHeaders = ['日期', '基金代码', '基金名称', '类型', '金额', '价格', '份额'];
  const actualHeaders = Object.keys(rows[0]);
  const missingHeaders = requiredHeaders.filter(h => !actualHeaders.includes(h));
  if (missingHeaders.length > 0) {
    throw new Error(`CSV 格式错误，缺少字段: ${missingHeaders.join(', ')}`);
  }

  const transactions: Omit<Transaction, 'id' | 'createdAt'>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // +2 因为表头在第 1 行，索引从 0 开始

    // 验证必填字段
    if (!row['日期'] || !row['基金代码'] || !row['基金名称']) {
      throw new Error(`第 ${rowNumber} 行: 日期、基金代码、基金名称为必填项`);
    }

    // 解析类型
    const typeStr = String(row['类型']).trim();
    let type: 'buy' | 'sell';
    if (typeStr === '买入') {
      type = 'buy';
    } else if (typeStr === '卖出') {
      type = 'sell';
    } else {
      throw new Error(`第 ${rowNumber} 行: 类型必须为"买入"或"卖出"`);
    }

    // 解析数值
    const amount = parseFloat(row['金额']);
    const price = parseFloat(row['价格']);
    const shares = parseFloat(row['份额']);
    const fee = row['手续费'] ? parseFloat(row['手续费']) : 0;

    if (isNaN(amount) || isNaN(price) || isNaN(shares)) {
      throw new Error(`第 ${rowNumber} 行: 金额、价格、份额必须为有效数字`);
    }

    transactions.push({
      fundId: String(row['基金代码']).trim(),
      fundCode: String(row['基金代码']).trim(),
      fundName: String(row['基金名称']).trim(),
      type,
      date: String(row['日期']).trim(),
      amount,
      price,
      shares,
      fee,
      remark: row['备注'] ? String(row['备注']).trim() : undefined,
      status: 'completed',
    });
  }

  return transactions;
}
