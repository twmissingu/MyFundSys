import React, { useState, useEffect } from 'react';
import { Card, List, Toast, SwipeAction, Tabs, Popup, Input, Button, Dialog } from 'antd-mobile';
import { CloseOutline } from 'antd-mobile-icons';
import { useHoldings, useTransactions } from '../hooks/useSync';
import { deriveLots, deriveRealizedLots, type Lot } from '../services/navUpdateService';
import { fetchFundNav } from '../services/fundApi';
import { formatMoney, formatPercent } from '../utils';
import TotalAssetsCard from '../components/TotalAssetsCard';
import './Layout.css';

const Holdings: React.FC = () => {
  const { holdings, lots, loading, removeHolding, refresh } = useHoldings();
  const { transactions, saveTransaction, refresh: refreshTransactions } = useTransactions();
  const [activeTab, setActiveTab] = useState('lots');

  // 在途买入金额
  const pendingBuyAmount = transactions
    .filter(t => t.status === 'pending' && t.type === 'buy')
    .reduce((sum, t) => sum + t.amount, 0);

  // 已实现盈亏
  const realizedLots = deriveRealizedLots(transactions);
  const realizedPnL = realizedLots.reduce((sum, lot) => sum + lot.profit, 0);

  // 加载在途交易
  useEffect(() => {
    refresh();
  }, []);

  const handleDeleteHolding = async (id: string) => {
    await Dialog.confirm({
      content: '确定要删除这个持仓吗？关联的交易记录也会被删除。',
      onConfirm: async () => {
        try {
          await removeHolding(id);
          Toast.show({ content: '删除成功', position: 'bottom' });
          window.location.reload();
        } catch {
          Toast.show({ content: '删除失败', position: 'bottom' });
        }
      },
    });
  };

  // 卖出弹窗状态
  const [sellModal, setSellModal] = useState<{
    lot: Lot | null;
    shares: string;
    loading: boolean;
  }>({ lot: null, shares: '', loading: false });

  const handleSellClick = (lot: Lot) => {
    setSellModal({ lot, shares: lot.remainingShares.toFixed(2), loading: false });
  };

  const handleSellAll = () => {
    if (sellModal.lot) {
      setSellModal(prev => ({ ...prev, shares: prev.lot!.remainingShares.toFixed(2) }));
    }
  };

  const handleSellConfirm = async () => {
    if (!sellModal.lot) return;
    const sellShares = parseFloat(sellModal.shares);
    if (isNaN(sellShares) || sellShares <= 0) {
      Toast.show({ content: '请输入有效的份额', position: 'bottom' });
      return;
    }
    if (sellShares > sellModal.lot.remainingShares) {
      Toast.show({ content: '卖出份额不能超过可用份额', position: 'bottom' });
      return;
    }

    setSellModal(prev => ({ ...prev, loading: true }));
    try {
      // 获取最新净值
      const navData = await fetchFundNav(sellModal.lot!.fundCode);
      const price = navData?.nav || sellModal.lot!.cost;
      const amount = sellShares * price;

      // 创建卖出交易
      await saveTransaction({
        fundId: sellModal.lot!.fundCode,
        fundCode: sellModal.lot!.fundCode,
        fundName: sellModal.lot!.fundName,
        type: 'sell',
        date: new Date().toISOString().split('T')[0],
        amount,
        price,
        shares: sellShares,
        fee: 0,
        status: 'completed',
      });

      setSellModal({ lot: null, shares: '', loading: false });
      Toast.show({ content: '卖出成功', position: 'bottom' });
      await refresh();
      await refreshTransactions();
    } catch {
      Toast.show({ content: '卖出失败', position: 'bottom' });
    } finally {
      setSellModal(prev => ({ ...prev, loading: false }));
    }
  };

  // 批量获取批次净值
  const [lotNavMap, setLotNavMap] = useState<Map<string, { nav: number; navDate: string }>>(new Map());

  useEffect(() => {
    if (lots.length === 0) return;
    const fetchNavs = async () => {
      const fundCodes = [...new Set(lots.map(l => l.fundCode))];
      const map = new Map<string, { nav: number; navDate: string }>();
      const batchSize = 5;
      for (let i = 0; i < fundCodes.length; i += batchSize) {
        const batch = fundCodes.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (code) => {
            try {
              const navData = await fetchFundNav(code);
              if (navData && navData.nav > 0) {
                return { code, nav: navData.nav, navDate: navData.navDate };
              }
            } catch { /* ignore */ }
            return null;
          })
        );
        results.forEach(r => { if (r) map.set(r.code, { nav: r.nav, navDate: r.navDate }); });
        if (i + batchSize < fundCodes.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      setLotNavMap(map);
    };
    fetchNavs();
  }, [lots]);

  // 持仓明细 - 按批次展示
  const renderLotsView = () => (
    <Card title={`持仓明细 (${lots.length})`} className="card">
      {lots.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          暂无持仓，请在交易页面添加交易记录
        </div>
      ) : (
        <List>
          {lots.map(lot => {
            // 在途买入
            if (lot.isPending) {
              return (
                <div key={lot.id} style={{ padding: '12px 16px', marginBottom: 8, background: '#f5f5f5', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 500 }}>{lot.fundName || lot.fundCode}</div>
                      <div style={{ fontSize: 13, color: '#999' }}>
                        {lot.fundCode} | 在途买入 {lot.date}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, color: '#999' }}>
                        金额: {formatMoney(lot.amount ?? 0)}
                      </div>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        净值待定
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const navInfo = lotNavMap.get(lot.fundCode);
            const currentNav = navInfo?.nav ?? lot.cost;
            const currentValue = currentNav * lot.remainingShares;
            const cost = lot.cost * lot.remainingShares;
            const profit = currentValue - cost;
            const profitRate = cost > 0 ? profit / cost : 0;

            return (
              <SwipeAction
                key={lot.id}
                rightActions={[
                  {
                    key: 'sell',
                    text: '卖出',
                    color: 'warning',
                    onClick: () => handleSellClick(lot),
                  },
                ]}
              >
                <div onClick={() => window.location.hash = `#transactions?fundCode=${lot.fundCode}`}>
                  <List.Item
                    title={<div style={{ fontSize: 15, fontWeight: 500 }}>{lot.fundName || lot.fundCode}</div>}
                    description={
                      <div style={{ fontSize: 13, color: '#999' }}>
                        {lot.fundCode} | 买入 {lot.date}
                      </div>
                    }
                    extra={
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 15, fontWeight: 500 }}>
                          {formatMoney(currentValue)}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            color: profit >= 0 ? '#ff4d4f' : '#52c41a'
                          }}
                        >
                          {profit >= 0 ? '+' : ''}{formatMoney(profit)} ({formatPercent(profitRate)})
                        </div>
                      </div>
                    }
                  >
                    <div style={{ padding: '8px 0' }}>
                      <div style={{ fontSize: 13, color: '#666' }}>
                        份额: {lot.remainingShares.toFixed(2)} | 成本: {lot.cost.toFixed(4)}
                      </div>
                    </div>
                  </List.Item>
                </div>
              </SwipeAction>
            );
          })}
        </List>
      )}
    </Card>
  );

  // 落袋为安
  const renderRealizedPnLView = () => (
    <>
      {/* 汇总卡片 */}
      {realizedLots.length > 0 && (
        <Card className="card" style={{ marginBottom: 12, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>落袋为安汇总</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: realizedPnL >= 0 ? '#ff4d4f' : '#52c41a' }}>
            {realizedPnL >= 0 ? '+' : ''}{formatMoney(realizedPnL)}
          </div>
          <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
            盈利 {realizedLots.filter(l => l.profit > 0).length} 笔 | 亏损 {realizedLots.filter(l => l.profit <= 0).length} 笔 | 胜率 {realizedLots.length > 0 ? ((realizedLots.filter(l => l.profit > 0).length / realizedLots.length) * 100).toFixed(1) : 0}%
          </div>
        </Card>
      )}

      <Card title={`落袋为安 (${realizedLots.length})`} className="card">
        {realizedLots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            暂无落袋为安记录
          </div>
        ) : (
          <List>
            {realizedLots.map(lot => (
              <List.Item
                key={lot.id}
                title={<div style={{ fontSize: 15, fontWeight: 500 }}>{lot.fundName || lot.fundCode}</div>}
                description={
                  <div style={{ fontSize: 13, color: '#999' }}>
                    {lot.fundCode} | 买入 {lot.buyDate} → 卖出 {lot.sellDate} | 持有 {lot.holdingDays} 天
                  </div>
                }
                extra={
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>
                      {formatMoney(lot.profit)}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: lot.profit >= 0 ? '#ff4d4f' : '#52c41a'
                      }}
                    >
                      {formatPercent(lot.profitRate)}
                    </div>
                  </div>
                }
              >
                <div style={{ padding: '8px 0' }}>
                  <div style={{ fontSize: 13, color: '#666' }}>
                    份额: {lot.shares.toFixed(2)} | 买入: {lot.buyNav.toFixed(4)} → 卖出: {lot.sellNav.toFixed(4)}
                  </div>
                </div>
              </List.Item>
            ))}
          </List>
        )}
      </Card>
    </>
  );

  // 统计分析（简化版）
  const renderStatsView = () => (
    <Card title="资产分布" className="card">
      {holdings.length > 0 ? (
        <List>
          {holdings.map(h => {
            const value = h.currentValue ?? h.totalCost;
            const totalValue = holdings.reduce((s, x) => s + (x.currentValue ?? x.totalCost), 0);
            const pct = totalValue > 0 ? (value / totalValue * 100).toFixed(1) : '0.0';
            return (
              <List.Item
                key={h.fundCode}
                title={h.fundName || h.fundCode}
                description={`占比 ${pct}%`}
                extra={<div style={{ textAlign: 'right' }}>
                  <div>{formatMoney(value)}</div>
                  <div style={{ fontSize: 12, color: (h.profit ?? 0) >= 0 ? '#ff4d4f' : '#52c41a' }}>
                    {(h.profit ?? 0) >= 0 ? '+' : ''}{formatPercent(h.profitRate ?? 0)}
                  </div>
                </div>}
              />
            );
          })}
        </List>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>暂无持仓数据</div>
      )}
    </Card>
  );

  if (loading) {
    return (
      <div className="page-container">
        <h1 className="page-title">持仓管理</h1>
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>加载中...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <h1 className="page-title">持仓管理</h1>

      {/* 资产总览 */}
      <TotalAssetsCard holdings={holdings} pendingBuyAmount={pendingBuyAmount} realizedPnL={realizedPnL} />

      {/* 标签页切换 */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginBottom: 12 }}
      >
        <Tabs.Tab title="持仓明细" key="lots" />
        <Tabs.Tab title="落袋为安" key="realized" />
        <Tabs.Tab title="统计分析" key="stats" />
      </Tabs>

      {/* 内容区域 */}
      {activeTab === 'lots' && renderLotsView()}
      {activeTab === 'realized' && renderRealizedPnLView()}
      {activeTab === 'stats' && renderStatsView()}

      {/* 卖出弹窗 */}
      <Popup
        visible={!!sellModal.lot}
        onMaskClick={() => setSellModal({ lot: null, shares: '', loading: false })}
        position="bottom"
        bodyStyle={{ borderTopLeftRadius: '16px', borderTopRightRadius: '16px', minHeight: '300px' }}
      >
        {sellModal.lot && (
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                卖出 - {sellModal.lot.fundName || sellModal.lot.fundCode}
              </div>
              <CloseOutline onClick={() => setSellModal({ lot: null, shares: '', loading: false })} style={{ fontSize: 20, color: '#999' }} />
            </div>

            <div style={{ fontSize: 13, color: '#999', marginBottom: 12 }}>
              可用份额: {sellModal.lot.remainingShares.toFixed(2)}
            </div>

            <Input
              type="number"
              placeholder="卖出份额"
              value={sellModal.shares}
              onChange={(val) => setSellModal(prev => ({ ...prev, shares: val }))}
              style={{ height: 44, marginBottom: 12 }}
            />

            <Button
              size="small"
              color="primary"
              fill="outline"
              onClick={handleSellAll}
              style={{ marginBottom: 16 }}
            >
              全部卖出
            </Button>

            {sellModal.shares && !isNaN(parseFloat(sellModal.shares)) && (
              <div style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
                预计金额: {formatMoney(parseFloat(sellModal.shares) * (lotNavMap.get(sellModal.lot!.fundCode)?.nav ?? sellModal.lot!.cost))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <Button
                block
                onClick={() => setSellModal({ lot: null, shares: '', loading: false })}
                style={{ flex: 1 }}
              >
                取消
              </Button>
              <Button
                block
                color="primary"
                loading={sellModal.loading}
                onClick={handleSellConfirm}
                style={{ flex: 1 }}
              >
                确认卖出
              </Button>
            </div>
          </div>
        )}
      </Popup>
    </div>
  );
};

export default Holdings;
