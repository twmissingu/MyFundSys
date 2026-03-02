// 格式化金额
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// 格式化百分比
export function formatPercent(value: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// 格式化数字
export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// 格式化日期
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

// 生成唯一ID
export function generateId(prefix: string = ''): string {
  return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 计算盈亏颜色
export function getProfitColor(value: number): string {
  if (value > 0) return '#ff4d4f';  // 红色（A股涨为红）
  if (value < 0) return '#52c41a';  // 绿色（A股跌为绿）
  return '#8c8c8c';
}

// 计算估值状态
export function getValuationStatus(percentile: number): { text: string; color: string } {
  if (percentile < 0.2) {
    return { text: '钻石坑', color: '#52c41a' };
  } else if (percentile < 0.4) {
    return { text: '低估', color: '#95de64' };
  } else if (percentile < 0.6) {
    return { text: '合理', color: '#faad14' };
  } else if (percentile < 0.8) {
    return { text: '高估', color: '#ff7a45' };
  } else {
    return { text: '危险', color: '#ff4d4f' };
  }
}

// 下载JSON文件
export function downloadJSON(data: object, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 读取JSON文件
export function readJSONFile(file: File): Promise<any> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// 计算移动平均线
export function calculateMA(data: number[], period: number): number[] {
  const ma: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      ma.push(NaN);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j];
      }
      ma.push(sum / period);
    }
  }
  return ma;
}

// 计算标准差
export function calculateStdDev(data: number[]): number {
  if (data.length === 0) return 0;
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / data.length;
  return Math.sqrt(variance);
}
