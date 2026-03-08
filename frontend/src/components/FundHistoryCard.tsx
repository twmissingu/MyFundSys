import React, { useState, useEffect, useMemo } from 'react';
import { Card, Tabs, SpinLoading } from 'antd-mobile';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
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
  filterRecentData,
  getDaysFromRange,
  formatDate,
  TimeRange,
} from '../utils/technicalIndicators';
import './FundHistoryCard.css';

interface FundHistoryCardProps {
  fundCode: string;
}

const FundHistoryCard: React.FC<FundHistoryCardProps> = ({ fundCode }) => {
  const [historyData, setHistoryData] = useState<FundHistoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('3m');
  const [activeTab, setActiveTab] = useState('nav');

  // 根据时间区间过滤数据
  const filteredData = useMemo(() => {
    const days = getDaysFromRange(timeRange);
    return filterRecentData(historyData, days);
  }, [historyData, timeRange]);

  // 计算技术指标
  const chartData = useMemo(() => {
    if (filteredData.length === 0) return [];
    
    const points = filteredData.map(d => ({ date: d.date, nav: d.nav }));
    const ma5 = calculateMA(points, 5);
    const ma10 = calculateMA(points, 10);
    const ma20 = calculateMA(points, 20);
    const macd = calculateMACD(points);
    const kdj = calculateKDJ(points);
    
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
  }, [filteredData]);

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
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    return [];
  }, [chartData, historyData]);

  // 加载历史数据
  useEffect(() => {
    console.log('[HistoryCard] Effect triggered, fundCode:', fundCode);
    let isMounted = true;
    
    const loadHistory = async () => {
      console.log('[HistoryCard] Loading history for:', fundCode);
      setLoading(true);
      try {
        const data = await fetchFundHistory(fundCode, 100);
        console.log('[HistoryCard] Loaded data:', data.length, 'records');
        if (data.length > 0) {
          console.log('[HistoryCard] Sample record:', JSON.stringify(data[0]));
        }
        
        if (isMounted) {
          setHistoryData(data);
          setLoading(false);
          console.log('[HistoryCard] State updated');
        }
      } catch (err) {
        console.error('[HistoryCard] Error loading:', err);
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    if (fundCode) {
      loadHistory();
    }
    
    return () => { 
      console.log('[HistoryCard] Cleanup');
      isMounted = false; 
    };
  }, [fundCode]);

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
    console.log('[HistoryCard] Empty displayData - historyData:', historyData.length, 'loading:', loading);
    // 如果数据还没加载完，继续显示加载状态
    if (historyData.length === 0) {
      return (
        <Card title="历史表现" className="history-card">
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            暂无历史数据
          </div>
        </Card>
      );
    }
    // 有原始数据但处理失败的情况
    return (
      <Card title="历史表现" className="history-card">
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          数据处理中...({historyData.length}条)
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
      {chartData.length === 0 && historyData.length > 0 && (
        <div style={{ 
          padding: '8px 12px', 
          marginBottom: 12, 
          background: '#fff7e6', 
          border: '1px solid #ffd591',
          borderRadius: 6,
          fontSize: 12,
          color: '#d46b08'
        }}>
          ⚠️ 数据点不足，仅显示原始净值走势（技术指标需要至少26个交易日数据）
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

      {/* 图表标签页 */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        className="chart-tabs"
      >
        <Tabs.Tab title="净值走势" key="nav">
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="dateStr" 
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis 
                  domain={['auto', 'auto']} 
                  tick={{ fontSize: 11 }}
                  width={50}
                />
                <Tooltip 
                  contentStyle={{ fontSize: 12 }}
                  formatter={(value: number) => value?.toFixed(4)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="nav"
                  name="净值"
                  stroke="#1677ff"
                  fill="#e6f4ff"
                  strokeWidth={2}
                />
                {chartData.length > 0 && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="ma5"
                      name="MA5"
                      stroke="#faad14"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="ma10"
                      name="MA10"
                      stroke="#722ed1"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Tabs.Tab>

        {chartData.length > 0 && (
          <Tabs.Tab title="MACD" key="macd">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="dateStr" 
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                    minTickGap={20}
                  />
                  <YAxis tick={{ fontSize: 11 }} width={50} />
                  <Tooltip 
                    contentStyle={{ fontSize: 12 }}
                    formatter={(value: number) => value?.toFixed(4)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="macd" name="MACD">
                    {displayData.map((entry, index) => (
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
          </Tabs.Tab>
        )}

        {chartData.length > 0 && (
          <Tabs.Tab title="KDJ" key="kdj">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="dateStr" 
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                    minTickGap={20}
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={50} />
                  <Tooltip 
                    contentStyle={{ fontSize: 12 }}
                    formatter={(value: number) => value?.toFixed(2)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="k" name="K" stroke="#1677ff" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="d" name="D" stroke="#fa8c16" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="j" name="J" stroke="#52c41a" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey={() => 80} stroke="#ff4d4f" strokeDasharray="3 3" strokeWidth={1} dot={false} legendType="none" />
                  <Line type="monotone" dataKey={() => 20} stroke="#52c41a" strokeDasharray="3 3" strokeWidth={1} dot={false} legendType="none" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Tabs.Tab>
        )}
      </Tabs>

      {/* 指标说明 */}
      <div className="indicator-tips">
        {activeTab === 'macd' && chartData.length > 0 && (
          <p>MACD：DIF上穿DEA为买入信号，下穿为卖出信号</p>
        )}
        {activeTab === 'kdj' && chartData.length > 0 && (
          <p>KDJ：K&gt;80超买，K&lt;20超卖；J值&gt;100严重超买，&lt;0严重超卖</p>
        )}
        {(activeTab === 'nav' || chartData.length === 0) && (
          <p>净值走势：{chartData.length > 0 ? 'MA5（5日均线）、MA10（10日均线）' : '原始净值数据'}</p>
        )}
      </div>
    </Card>
  );
};

export default FundHistoryCard;
