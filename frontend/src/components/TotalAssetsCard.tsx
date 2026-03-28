import React from 'react';
import { formatMoney, formatPercent } from '../utils';
import '../pages/Layout.css';

interface Holding {
  currentValue?: number;
  totalCost: number;
}

interface TotalAssetsCardProps {
  holdings: Holding[];
  showProfitLabel?: boolean;
}

/**
 * 总资产卡片组件
 * 在 Dashboard 和 Holdings 页面复用，保持显示一致
 */
const TotalAssetsCard: React.FC<TotalAssetsCardProps> = ({
  holdings,
  showProfitLabel = false,
}) => {
  // 计算总资产和盈亏
  const totalAssets = holdings.reduce(
    (sum, h) => sum + (h.currentValue || h.totalCost),
    0
  );
  const totalCost = holdings.reduce((sum, h) => sum + h.totalCost, 0);
  const totalProfit = totalAssets - totalCost;
  const totalProfitRate = totalCost > 0 ? totalProfit / totalCost : 0;

  return (
    <div className="stat-card">
      <div className="stat-label">总资产</div>
      <div className="stat-value">{formatMoney(totalAssets)}</div>
      <div
        className="stat-change"
        style={{ color: totalProfit >= 0 ? '#ffccc7' : '#b7eb8f' }}
      >
        {showProfitLabel ? '盈亏: ' : ''}
        {totalProfit >= 0 ? '+' : ''}
        {formatMoney(totalProfit)} ({formatPercent(totalProfitRate)})
      </div>
    </div>
  );
};

export default TotalAssetsCard;
