import React, { useState, useEffect, useMemo } from 'react';
import { Card, SpinLoading } from 'antd-mobile';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Bar,
  ComposedChart,
  Area,
  Cell,
} from 'recharts';
import { fetchFundHistory, FundHistoryData } from '../services/fundApi';
import {
  calculateMACD,
  calculateKDJ,
  calculateMA,
  formatDate,
  TimeRange,
  getMACDParams,
  getKDJParams,
} from '../utils/technicalIndicators';
import './FundHistoryCard.css';

interface FundHistoryCardProps {
  fundCode: string;
}

const FundHistoryCard: React.FC<FundHistoryCardProps> = ({ fundCode }) => {
  const [historyData, setHistoryData] = useState<FundHistoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('3m');


  // 根据时间区间计算起始日期（自然日）
  const getStartDate = (range: TimeRange): string | null => {
    if (range === 'all') return null; // 全部数据，不限制起始日期
    
    const today = new Date();
    const map: Record<Exclude<TimeRange, 'all'>, number> = {
      '1m': 30,    // 30个自然日
      '3m': 90,    // 90个自然日
      '6m': 180,   // 180个自然日
      '1y': 365,   // 365个自然日
    };
    
    const start = new Date(today);
    start.setDate(start.getDate() - map[range]);
    return start.toISOString().split('T')[0]; // YYYY-MM-DD格式
  };

  // 加载历史数据（根据时间区间，支持分页加载）
  useEffect(() => {
    let isMounted = true;
    
    const loadHistory = async () => {
      setLoading(true);
      const startDate = getStartDate(timeRange);
      console.log('[HistoryCard] Loading', timeRange, '- from', startDate || 'all');
      
      let allData: FundHistoryData[] = [];
      let pageIndex = 1;
      const maxPages = 50; // 最多加载50页（约1000条，每页20条）
      
      // 分页加载，直到没有更多数据
      // 注意：东方财富API每页固定返回20条，无视pageSize参数
      while (pageIndex <= maxPages) {
        const pageData = await fetchFundHistory(fundCode, 20, pageIndex, startDate || '');
        
        if (pageData.length === 0) {
          break; // 没有更多数据
        }
        
        allData = [...allData, ...pageData];
        
        // 如果当前页返回数据少于20条，说明是最后一页
        if (pageData.length < 20) {
          break;
        }
        
        pageIndex++;
      }
      
      // API返回的数据是倒序（最新在前），需要按时间正序排列（最旧在前）以便图表显示
      allData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      console.log('[HistoryCard] Loaded', allData.length, 'records from', pageIndex, 'pages');
      
      if (isMounted) {
        setHistoryData(allData);
        setLoading(false);
      }
    };
    
    loadHistory();
    
    return () => { isMounted = false; };
  }, [fundCode, timeRange]);

  // 计算技术指标（根据时间范围使用动态参数）
  const chartData = useMemo(() => {
    if (historyData.length === 0) return [];
    
    const points = historyData.map(d => ({ date: d.date, nav: d.nav }));
    const ma5 = calculateMA(points, 5);
    const ma10 = calculateMA(points, 10);
    const ma20 = calculateMA(points, 20);
    
    // 根据时间范围获取动态参数
    const macdParams = getMACDParams(timeRange);
    const kdjParams = getKDJParams(timeRange);
    
    console.log('[Indicators] MACD params:', macdParams.label, 'KDJ params:', kdjParams.label);
    
    const macd = calculateMACD(points, macdParams.fastPeriod, macdParams.slowPeriod, macdParams.signalPeriod);
    const kdj = calculateKDJ(points, kdjParams.n, kdjParams.m1, kdjParams.m2);
    
    return points.map((p, i) => ({
      date: p.date,
      dateStr: formatDate(p.date),
      nav: p.nav,
      ma5: ma5[i]?.value,
      ma10: ma10[i]?.value,
      ma20: ma20[i]?.value,
      dif: macd[i]?.dif,
      dea: macd[i]?.dea,
      macd: macd[i]?.macd,
      k: kdj[i]?.k,
      d: kdj[i]?.d,
      j: kdj[i]?.j,
    }));
  }, [historyData, timeRange]);

  // 如果没有计算数据但有原始数据，创建简化版图表数据
  const displayData = useMemo(() => {
    if (chartData.length > 0) return chartData;
    if (historyData.length > 0) {
      return historyData.map(d => ({
        date: d.date,
        dateStr: formatDate(d.date),
        nav: d.nav,
        ma5: undefined, ma10: undefined, ma20: undefined,
        dif: undefined, dea: undefined, macd: undefined,
        k: undefined, d: undefined, j: undefined,
      }));
    }
    return [];
  }, [chartData, historyData]);

  // 分别检查MACD和KDJ是否有数据
  const hasMACD = chartData.length > 0 && chartData[chartData.length - 1]?.dif !== undefined;
  const hasKDJ = chartData.length > 0 && chartData[chartData.length - 1]?.k !== undefined;
  const hasIndicators = hasMACD || hasKDJ;
  
  console.log('[Debug] Data points:', historyData.length, 'hasMACD:', hasMACD, 'hasKDJ:', hasKDJ);

  // 时间区间选项
  const timeRangeOptions: { key: TimeRange; label: string }[] = [
    { key: '1m', label: '1月' },
    { key: '3m', label: '3月' },
    { key: '6m', label: '6月' },
    { key: '1y', label: '1年' },
    { key: 'all', label: '全部' },
  ];

  // 计算涨跌幅统计
  const stats = useMemo(() => {
    if (displayData.length < 2) return null;
    const first = displayData[0].nav;
    const last = displayData[displayData.length - 1].nav;
    const change = ((last - first) / first) * 100;
    const high = Math.max(...displayData.map(d => d.nav));
    const low = Math.min(...displayData.map(d => d.nav));
    return { change, high, low };
  }, [displayData]);

  if (loading) {
    return (
      <Card title="历史表现" className="history-card">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <SpinLoading style={{ '--size': '32px' }} />
          <p style={{ marginTop: 12, color: '#999', fontSize: 14 }}>加载历史数据...</p>
        </div>
      </Card>
    );
  }

  if (displayData.length === 0) {
    return (
      <Card title="历史表现" className="history-card">
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          暂无历史数据
        </div>
      </Card>
    );
  }

  return (
    <Card 
      title={
        <div className="history-card-header">
          <span>历史表现</span>
          {stats && (
            <span 
              className="history-stats"
              style={{ color: stats.change >= 0 ? '#ff4d4f' : '#52c41a' }}
            >
              {stats.change >= 0 ? '+' : ''}{stats.change.toFixed(2)}%
            </span>
          )}
        </div>
      } 
      className="history-card"
    >
      {/* 时间区间选择 */}
      <div className="time-range-selector">
        {timeRangeOptions.map(opt => (
          <button
            key={opt.key}
            className={`range-btn ${timeRange === opt.key ? 'active' : ''}`}
            onClick={() => setTimeRange(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 简化数据提示 */}
      {!hasIndicators && (
        <div style={{ 
          padding: '8px 12px', 
          marginBottom: 12, 
          background: '#fff7e6', 
          border: '1px solid #ffd591',
          borderRadius: 6,
          fontSize: 12,
          color: '#d46b08'
        }}>
          ⚠️ 数据点不足（当前{historyData.length}个），MACD至少需要{getMACDParams(timeRange).slowPeriod + getMACDParams(timeRange).signalPeriod}个交易日
        </div>
      )}

      {/* 统计信息 */}
      {stats && (
        <div className="history-stats-row">
          <div className="stat-item">
            <span className="stat-label">区间最高</span>
            <span className="stat-value">{stats.high.toFixed(4)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">区间最低</span>
            <span className="stat-value">{stats.low.toFixed(4)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">数据点数</span>
            <span className="stat-value">{displayData.length}</span>
          </div>
        </div>
      )}

      {/* 图表纵向排列 */}
      <div className="charts-vertical">
        
        {/* 净值走势 */}
        <div className="chart-section">
          <div className="chart-title">净值走势</div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="dateStr" 
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                  minTickGap={30}
                />
                <YAxis 
                  domain={['auto', 'auto']} 
                  tick={{ fontSize: 10 }}
                  width={45}
                />
                <Tooltip 
                  contentStyle={{ fontSize: 11 }}
                  formatter={(value: number) => value?.toFixed(4)}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="nav"
                  name="净值"
                  stroke="#1677ff"
                  fill="#e6f4ff"
                  strokeWidth={2}
                />
                {historyData.length >= 5 && (
                  <Line
                    type="monotone"
                    dataKey="ma5"
                    name="MA5"
                    stroke="#faad14"
                    strokeWidth={1.5}
                    dot={false}
                  />
                )}
                {historyData.length >= 10 && (
                  <Line
                    type="monotone"
                    dataKey="ma10"
                    name="MA10"
                    stroke="#722ed1"
                    strokeWidth={1.5}
                    dot={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* MACD - 只在有MACD数据时显示 */}
        {hasMACD && (
          <div className="chart-section">
            <div className="chart-title">MACD <span className="chart-subtitle">DIF上穿DEA买入，下穿卖出</span></div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={160}>
                <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="dateStr" 
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                    minTickGap={30}
                  />
                  <YAxis tick={{ fontSize: 10 }} width={45} />
                  <Tooltip 
                    contentStyle={{ fontSize: 11 }}
                    formatter={(value: number) => value?.toFixed(4)}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="macd" name="MACD">
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={(entry.macd ?? 0) >= 0 ? '#ff4d4f' : '#52c41a'} />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="dif"
                    name="DIF"
                    stroke="#1677ff"
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="dea"
                    name="DEA"
                    stroke="#fa8c16"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* KDJ - 只在有KDJ数据时显示 */}
        {hasKDJ && (
          <div className="chart-section">
            <div className="chart-title">KDJ <span className="chart-subtitle">K&gt;80超买，K&lt;20超卖</span></div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="dateStr" 
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                    minTickGap={30}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={45} />
                  <Tooltip 
                    contentStyle={{ fontSize: 11 }}
                    formatter={(value: number) => value?.toFixed(2)}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="k" name="K" stroke="#1677ff" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="d" name="D" stroke="#fa8c16" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="j" name="J" stroke="#52c41a" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey={() => 80} stroke="#ff4d4f" strokeDasharray="3 3" strokeWidth={1} dot={false} legendType="none" />
                  <Line type="monotone" dataKey={() => 20} stroke="#52c41a" strokeDasharray="3 3" strokeWidth={1} dot={false} legendType="none" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 指标参数说明 */}
        {(hasMACD || hasKDJ) && (
          <div className="indicator-tips" style={{ marginTop: 8 }}>
            <p style={{ fontSize: 11, color: '#999' }}>
              当前参数：
              {hasMACD && `MACD ${getMACDParams(timeRange).label}`}
              {hasMACD && hasKDJ && ' / '}
              {hasKDJ && `KDJ ${getKDJParams(timeRange).label}`}
              {timeRange === '1m' && ' · 短周期使用灵敏参数'}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default FundHistoryCard;
