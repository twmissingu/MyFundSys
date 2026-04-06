import React from 'react';
import { formatMoney, formatPercent } from '../utils';
import '../pages/Layout.css';

interface Holding {
  currentValue?: number;
  totalCost: number;
}

interface TotalAssetsCardProps {
  holdings: Holding[];
  pendingBuyAmount?: number;
  realizedPnL?: number;
}

const TotalAssetsCard: React.FC<TotalAssetsCardProps> = ({
  holdings,
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
      <div className="stat-label" style={{ color: '#333' }}>总资产</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <div className="stat-value" style={{ color: '#faad14' }}>{formatMoney(totalAssets)}</div>
        {pendingBuyAmount > 0 && (
          <span style={{ fontSize: 12, color: '#999' }}>（含在途{formatMoney(pendingBuyAmount)}）</span>
        )}
      </div>
      <div style={{ fontSize: 13, marginTop: 4 }}>
        <span style={{ color: floatingPnL >= 0 ? '#ff4d4f' : '#52c41a' }}>
          浮动盈亏: {floatingPnL >= 0 ? '+' : ''}{formatMoney(floatingPnL)} ({formatPercent(floatingPnLRate)})
        </span>
      </div>
      <div style={{ fontSize: 13, marginTop: 2 }}>
        <span style={{ color: totalPnL >= 0 ? '#ff4d4f' : '#52c41a' }}>
          累计盈亏: {totalPnL >= 0 ? '+' : ''}{formatMoney(totalPnL)}
        </span>
      </div>
    </div>
  );
};

export default TotalAssetsCard;
