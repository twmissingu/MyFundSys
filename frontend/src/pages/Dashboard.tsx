import React, { useEffect, useState } from 'react';
import { Card, Toast } from 'antd-mobile';
import { useHoldings, useTransactions } from '../hooks/useSync';
import { fetchMarketValuation } from '../services/fundApi';
import { processPendingTransactions, deriveRealizedLots } from '../services/navUpdateService';
import { formatMoney, formatPercent, getValuationStatus } from '../utils';
import TotalAssetsCard from '../components/TotalAssetsCard';
import type { MarketValuationData } from '../types';
import './Layout.css';

const Dashboard: React.FC = () => {
  const { holdings, refresh } = useHoldings();
  const { transactions } = useTransactions();
  const [valuation, setValuation] = useState<MarketValuationData | null>(null);

  useEffect(() => {
    loadValuation();
    processPendingTransactions().then((result) => {
      if (result.processedCount > 0) {
        Toast.show({
          content: `已处理 ${result.processedCount} 笔在途交易`,
          position: 'bottom'
        });
        refresh();
      }
    });
  }, []);

  // 计算在途买入金额
  const pendingBuyAmount = transactions
    .filter(t => t.status === 'pending' && t.type === 'buy')
    .reduce((sum, t) => sum + t.amount, 0);

  // 计算已实现盈亏
  const realizedLots = deriveRealizedLots(transactions);
  const realizedPnL = realizedLots.reduce((sum, lot) => sum + lot.profit, 0);

  const loadValuation = async () => {
    try {
      const data = await fetchMarketValuation();
      setValuation(data);
    } catch (error) {
      Toast.show({
        content: '获取估值数据失败',
        position: 'bottom',
      });
    }
  };

  // 估值状态
  const valuationStatus = valuation ? getValuationStatus(valuation.percentile) : null;

  return (
    <div className="page-container">
      <h1 className="page-title">基金投资管理系统</h1>

      {/* 市场估值卡片 */}
      {valuation && (
        <div
          className="valuation-indicator"
          style={{
            background: valuation.error ? '#fff7e6' : `${valuationStatus?.color}15`,
            border: `1px solid ${valuation.error ? '#ffd591' : valuationStatus?.color}`,
          }}
        >
          <div>
            <div className="valuation-title">
              {valuation.error ? (
                <>
                  市场估值: 数据获取失败
                  <span style={{ fontSize: 11, marginLeft: 8, color: '#ff4d4f' }}>(默认)</span>
                </>
              ) : (
                <>
                  市场估值: {valuationStatus?.text}
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: valuationStatus?.color,
                      marginLeft: 8,
                    }}
                  />
                </>
              )}
              {!valuation.error && valuation.source === 'qieman' && (
                <span style={{ fontSize: 11, marginLeft: 8, opacity: 0.7 }}>(且慢)</span>
              )}
            </div>
            <div className="valuation-desc">
              PE: {valuation.pe.toFixed(2)} | PB: {valuation.pb.toFixed(2)} | 百分位: {formatPercent(valuation.percentile)}
            </div>
            {valuation.error && (
              <div style={{ fontSize: 11, color: '#ff4d4f', marginTop: 4 }}>
                ⚠️ {valuation.error}，显示默认值仅供参考
              </div>
            )}
          </div>
        </div>
      )}

      {/* 资产总览 */}
      <TotalAssetsCard holdings={holdings} pendingBuyAmount={pendingBuyAmount} realizedPnL={realizedPnL} />

      {/* 持仓概览 */}
      <Card title="持仓概览" className="card">
        {holdings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
            暂无持仓，去添加交易记录吧
          </div>
        ) : (
          <div>
            {holdings.slice(0, 5).map((holding) => (
              <div key={holding.id} className="list-item">
                <div className="item-left">
                  <div className="item-title">{holding.fundName || holding.fundCode}</div>
                  <div className="item-subtitle">{holding.fundCode}</div>
                </div>
                <div className="item-right">
                  <div className="item-value">{formatMoney(holding.currentValue ?? holding.totalCost)}</div>
                  <div 
                    className="item-change" 
                    style={{ color: (holding.profit ?? 0) >= 0 ? '#ff4d4f' : '#52c41a' }}
                  >
                    {(holding.profit ?? 0) >= 0 ? '+' : ''}{formatMoney(holding.profit ?? 0)}
                    <span style={{ marginLeft: 4 }}>({formatPercent(holding.profitRate ?? 0)})</span>
                  </div>
                </div>
              </div>
            ))}
            {holdings.length > 5 && (
              <div style={{ textAlign: 'center', padding: '12px', color: '#1677ff' }}>
                还有 {holdings.length - 5} 只基金...
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Dashboard;
