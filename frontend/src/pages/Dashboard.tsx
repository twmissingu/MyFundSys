import React, { useEffect, useState } from 'react';
import { Card, Grid, Toast } from 'antd-mobile';
import { useHoldings, useFunds } from '../hooks/useSync';
import { fetchMarketValuation } from '../services/fundApi';
import { formatMoney, formatPercent, getValuationStatus } from '../utils';
import type { MarketValuationData } from '../types';
import './Layout.css';

const Dashboard: React.FC = () => {
  const { holdings } = useHoldings();
  useFunds();
  const [valuation, setValuation] = useState<MarketValuationData | null>(null);

  useEffect(() => {
    loadValuation();
  }, []);

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

  // 计算总资产
  const totalAssets = holdings.reduce((sum, h) => sum + (h.currentValue || h.totalCost), 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.totalCost, 0);
  const totalProfit = totalAssets - totalCost;
  const totalProfitRate = totalCost > 0 ? totalProfit / totalCost : 0;

  // 估值状态
  const valuationStatus = valuation ? getValuationStatus(valuation.percentile) : null;

  return (
    <div className="page-container">
      <h1 className="page-title">MyFundSys</h1>

      {/* 市场估值卡片 */}
      {valuation && (
        <div className={`valuation-indicator ${valuationStatus?.text === '钻石坑' ? 'diamond' : valuationStatus?.text === '危险' ? 'danger' : 'normal'}`}>
          <div>
            <div className="valuation-title">
              {valuation.error ? (
                <>
                  市场估值: 数据获取失败
                  <span style={{ fontSize: 11, marginLeft: 8, color: '#ff4d4f' }}>(默认)</span>
                </>
              ) : (
                <>市场估值: {valuationStatus?.text}</>
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
      <div className="stat-card">
        <div className="stat-label">总资产</div>
        <div className="stat-value">{formatMoney(totalAssets)}</div>
        <div className="stat-change" style={{ color: totalProfit >= 0 ? '#ffccc7' : '#b7eb8f' }}>
          {totalProfit >= 0 ? '+' : ''}{formatMoney(totalProfit)} ({formatPercent(totalProfitRate)})
        </div>
      </div>

      {/* 快捷入口 */}
      <Card title="快捷功能" className="card">
        <Grid columns={4} gap={8}>
          <Grid.Item
            onClick={() => window.location.hash = 'holdings'}
            style={{ textAlign: 'center', padding: '12px 0' }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
            <div style={{ fontSize: 13 }}>持仓</div>
          </Grid.Item>
          <Grid.Item
            onClick={() => window.location.hash = 'transactions'}
            style={{ textAlign: 'center', padding: '12px 0' }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>💰</div>
            <div style={{ fontSize: 13 }}>交易</div>
          </Grid.Item>
          <Grid.Item
            onClick={() => window.location.hash = 'funds'}
            style={{ textAlign: 'center', padding: '12px 0' }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>📈</div>
            <div style={{ fontSize: 13 }}>基金</div>
          </Grid.Item>
          <Grid.Item
            onClick={() => window.location.hash = 'articles'}
            style={{ textAlign: 'center', padding: '12px 0' }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>📚</div>
            <div style={{ fontSize: 13 }}>文章</div>
          </Grid.Item>
        </Grid>
      </Card>

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
                  <div className="item-title">{holding.fundName}</div>
                  <div className="item-subtitle">{holding.fundCode}</div>
                </div>
                <div className="item-right">
                  <div className="item-value">{formatMoney(holding.currentValue || holding.totalCost)}</div>
                  <div 
                    className="item-change" 
                    style={{ color: (holding.profit || 0) >= 0 ? '#ff4d4f' : '#52c41a' }}
                  >
                    {(holding.profit || 0) >= 0 ? '+' : ''}
                    {formatPercent(holding.profitRate || 0)}
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

      {/* 投资格言 */}
      <Card className="card" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
        <div style={{ fontSize: 14, color: '#389e0d', lineHeight: 1.6 }}>
          <strong>E大投资理念</strong>
          <p style={{ margin: '8px 0 0 0' }}>
            "估值不会告诉你明天涨还是跌，但它会告诉你哪里安全，哪里危险。"
          </p>
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
