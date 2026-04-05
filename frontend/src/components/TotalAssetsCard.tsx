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
  pendingBuyAmount?: number;
  realizedPnL?: number;
}

const TotalAssetsCard: React.FC<TotalAssetsCardProps> = ({
  holdings,
  showProfitLabel = false,
  pendingBuyAmount = 0,
  realizedPnL = 0,
}) => {
  const holdingValue = holdings.reduce(
    (sum, h) => sum + (h.currentValue ?? h.totalCost),
    0
  );
  const totalCost = holdings.reduce((sum, h) => sum + h.totalCost, 0);

  const totalAssets = holdingValue + pendingBuyAmount;
  const adjustedTotalCost = totalCost + pendingBuyAmount;
  const floatingPnL = totalAssets - adjustedTotalCost;
  const floatingPnLRate = adjustedTotalCost > 0 ? floatingPnL / adjustedTotalCost : 0;
  const totalPnL = floatingPnL + realizedPnL;

  return (
    <div className="stat-card">
      <div className="stat-label">总资产</div>
      <div className="stat-value">{formatMoney(totalAssets)}</div>
      <div
        className="stat-change"
        style={{ color: floatingPnL >= 0 ? '#ffccc7' : '#b7eb8f' }}
      >
        浮动盈亏: {floatingPnL >= 0 ? '+' : ''}{formatMoney(floatingPnL)} ({formatPercent(floatingPnLRate)})
      </div>
      {realizedPnL !== 0 && (
        <div style={{ fontSize: 13, color: '#999', marginTop: 2 }}>
          累计盈亏: {totalPnL >= 0 ? '+' : ''}{formatMoney(totalPnL)}
        </div>
      )}
      {pendingBuyAmount > 0 && (
        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
          含在途买入 {formatMoney(pendingBuyAmount)}
        </div>
      )}
    </div>
  );
};

export default TotalAssetsCard;
