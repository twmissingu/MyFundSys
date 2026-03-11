import React from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';
import './SparklineChart.css';

interface DataPoint {
  date: string;
  nav: number;
}

interface SparklineChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
}

const SparklineChart: React.FC<SparklineChartProps> = ({ 
  data, 
  width = 100, 
  height = 40 
}) => {
  if (!data || data.length < 2) {
    return (
      <div 
        className="sparkline-empty"
        style={{ width, height }}
      >
        --
      </div>
    );
  }

  // 计算涨跌幅决定颜色
  const firstNav = data[0].nav;
  const lastNav = data[data.length - 1].nav;
  const isUp = lastNav >= firstNav;
  const color = isUp ? '#ff4d4f' : '#52c41a'; // 红涨绿跌

  return (
    <div className="sparkline-container" style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <YAxis domain={['auto', 'auto']} hide />
          <Line
            type="monotone"
            dataKey="nav"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SparklineChart;
