import React, { useEffect, useState } from 'react';
import { Card, Toast } from 'antd-mobile';
import { useHoldings, useTransactions } from '../hooks/useSync';
import { fetchMarketValuation } from '../services/fundApi';
import { processPendingTransactions, deriveRealizedLots } from '../services/navUpdateService';
import { fetchUnresolvedAlertCount } from '../services/alertService';
import { useRiskMetrics } from '../hooks/useRiskMetrics';
import { formatMoney, formatPercent, getValuationStatus } from '../utils';
import TotalAssetsCard from '../components/TotalAssetsCard';
import ActionCard from '../components/ActionCard';
import type { MarketValuationData } from '../types';
import './Layout.css';

const Dashboard: React.FC = () => {
  const { holdings, refresh, error } = useHoldings();
  const { transactions, refresh: refreshTransactions } = useTransactions();
  const [valuation, setValuation] = useState<MarketValuationData | null>(null);
  const [alertCount, setAlertCount] = useState(0);

  const pendingCount = transactions.filter(t => t.status === 'pending').length;
  const { gridTriggeredCount, valuationSignal } = useRiskMetrics(valuation?.percentile);

  // M4 修复：持仓加载失败时提示用户（而非静默显示 0 资产）
  useEffect(() => {
    if (error) {
      Toast.show({ content: `持仓加载失败: ${error}`, position: 'bottom' });
    }
  }, [error]);

  useEffect(() => {
    let cancelled = false;
    loadValuation();
    processPendingTransactions().then((result) => {
      if (cancelled) return;
      if (result.processedCount > 0) {
        Toast.show({
          content: `已处理 ${result.processedCount} 笔在途交易`,
          position: 'bottom'
        });
        refresh();
        refreshTransactions();
      }
    }).catch(() => {});
    fetchUnresolvedAlertCount().then((count) => {
      if (!cancelled) setAlertCount(count);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [refresh, refreshTransactions]);

  const pendingBuyAmount = transactions
    .filter(t => t.status === 'pending' && t.type === 'buy')
    .reduce((sum, t) => sum + t.amount, 0);

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

  const valuationStatus = valuation ? getValuationStatus(valuation.percentile) : null;

  const actions: { icon: string; title: string; description: string; ctaText: string; onClick: () => void }[] = [];

  if (gridTriggeredCount > 0) {
    actions.push({
      icon: '⚡',
      title: '网格触发',
      description: `${gridTriggeredCount} 格可买入`,
      ctaText: '去执行',
      onClick: () => { window.location.hash = 'strategy'; },
    });
  }

  if (pendingCount > 0) {
    actions.push({
      icon: '⏳',
      title: '在途交易',
      description: `${pendingCount} 笔待确认`,
      ctaText: '查看',
      onClick: () => { window.location.hash = 'transactions?type=pending'; },
    });
  }

  if (valuationSignal === '低估') {
    actions.push({
      icon: '📉',
      title: '估值偏低',
      description: '市场处于低估区域',
      ctaText: '加仓',
      onClick: () => { window.location.hash = 'funds'; },
    });
  }

  if (alertCount > 0) {
    actions.push({
      icon: '⚠️',
      title: '告警',
      description: `${alertCount} 笔在途交易异常`,
      ctaText: '查看详情',
      onClick: () => { window.location.hash = 'transactions'; },
    });
  }

  if (valuationSignal === '高估') {
    actions.push({
      icon: '📈',
      title: '估值偏高',
      description: '注意风险',
      ctaText: '查看',
      onClick: () => { window.location.hash = 'funds'; },
    });
  }

  return (
    <div className="page-container">
      <h1 className="page-title">基金投资管理系统</h1>

      {actions.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            paddingBottom: 8,
            marginBottom: 12,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {actions.map((action, i) => (
            <ActionCard key={i} {...action} />
          ))}
        </div>
      )}

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

      <TotalAssetsCard holdings={holdings} pendingBuyAmount={pendingBuyAmount} realizedPnL={realizedPnL} />

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
