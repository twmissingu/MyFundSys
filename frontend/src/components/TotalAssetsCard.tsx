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
  pendingBuyAmount?: number; // 在途买入金额
}

/**
 * 总资产卡片组件
 * 在 Dashboard 和 Holdings 页面复用，保持显示一致
 * 总资产 = 持仓市值 + 在途买入金额
 */
const TotalAssetsCard: React.FC<TotalAssetsCardProps> = ({
  holdings,
  showProfitLabel = false,
  pendingBuyAmount = 0,
}) => {
  // 计算持仓市值
  const holdingValue = holdings.reduce(
    (sum, h) => sum + (h.currentValue || h.totalCost),
    0
  );
  const totalCost = holdings.reduce((sum, h) => sum + h.totalCost, 0);

  // 总资产 = 持仓市值 + 在途买入金额
  const totalAssets = holdingValue + pendingBuyAmount;
  // 总成本也要包含在途买入（钱已花出，只是份额未确认）
  const adjustedTotalCost = totalCost + pendingBuyAmount;
  const totalProfit = totalAssets - adjustedTotalCost;
  const totalProfitRate = adjustedTotalCost > 0 ? totalProfit / adjustedTotalCost : 0;

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
      {pendingBuyAmount > 0 && (
        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
          含在途买入 {formatMoney(pendingBuyAmount)}
        </div>
      )}
    </div>
  );
};

export default TotalAssetsCard;
