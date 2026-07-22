import AddTransactionDialog from '../components/AddTransactionDialog';
import React, { useState, useEffect, useMemo } from 'react';
import { Card, List, CapsuleTabs, Tag, Toast, SwipeAction, Button, Dialog, SearchBar } from 'antd-mobile';
import { AddOutline, CloseOutline } from 'antd-mobile-icons';

import { useTransactions, useHoldings } from '../hooks/useSync';
import { processPendingTransactions, canDeleteTransaction } from '../services/navUpdateService';
import { fetchAlerts, resolveAlert } from '../services/alertService';
import PendingAlertCard from '../components/PendingAlertCard';
import type { PendingAlert } from '../services/alertService';
import { formatMoney, formatDate } from '../utils';

import './Layout.css';

type FilterKey = 'all' | 'buy' | 'sell' | 'pending';

interface FundOption {
  code: string;
  name: string;
}

const Transactions: React.FC = () => {
  const parseHash = () => {
    const hash = window.location.hash;
    const queryString = hash.includes('?') ? hash.split('?')[1] : '';
    const params = new URLSearchParams(queryString);
    return {
      type: (params.get('type') as FilterKey) || 'all',
      fundCode: params.get('fundCode') || null,
    };
  };

  const initialParams = parseHash();

  const [filterKey, setFilterKey] = useState<FilterKey>(initialParams.type);
  const [selectedFundCode, setSelectedFundCode] = useState<string>(initialParams.fundCode || 'all');
  const { transactions, loading, error, saveTransaction, removeTransaction, refresh } = useTransactions();
  const { refresh: refreshHoldings } = useHoldings();

  useEffect(() => {
    const handleHashChange = () => {
      const params = parseHash();
      setFilterKey(params.type);
      setSelectedFundCode(params.fundCode || 'all');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const updateHash = (type: FilterKey, fundCode: string) => {
    const params = new URLSearchParams();
    if (type !== 'all') params.set('type', type);
    if (fundCode !== 'all') params.set('fundCode', fundCode);
    const query = params.toString();
    window.location.hash = query ? `#transactions?${query}` : '#transactions';
  };

  const handleFilterChange = (key: string) => {
    const newKey = key as FilterKey;
    setFilterKey(newKey);
    updateHash(newKey, selectedFundCode);
  };

  const handleFundSelect = (code: string) => {
    setSelectedFundCode(code);
    updateHash(filterKey, code);
  };

  const clearFundFilter = () => {
    setSelectedFundCode('all');
    updateHash(filterKey, 'all');
  };

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [refreshingPending, setRefreshingPending] = useState(false);
  const [alerts, setAlerts] = useState<PendingAlert[]>([]);

  const handleRefreshPending = async () => {
    setRefreshingPending(true);
    try {
      const result = await processPendingTransactions();
      Toast.show({
        content: `处理完成：${result.processedCount} 笔成功${result.errors.length > 0 ? `，${result.errors.length} 笔失败` : ''}`,
        duration: 3000,
      });
      await refresh();
      await refreshHoldings();
    } catch {
      Toast.show({ content: '刷新失败', position: 'bottom' });
    } finally {
      setRefreshingPending(false);
    }
  };

  const [fundSearchText, setFundSearchText] = useState('');
  const [showFundDropdown, setShowFundDropdown] = useState(false);

  const fundOptions = useMemo<FundOption[]>(() => {
    const uniqueCodes = Array.from(new Set(transactions.map(t => t.fundCode)));
    return uniqueCodes.map(code => ({
      code,
      name: transactions.find(t => t.fundCode === code)?.fundName || code,
    }));
  }, [transactions]);

  const filteredFundOptions = useMemo(() => {
    if (!fundSearchText.trim()) return fundOptions;
    const keyword = fundSearchText.trim().toLowerCase();
    return fundOptions.filter(f =>
      f.name.toLowerCase().includes(keyword) || f.code.includes(keyword)
    );
  }, [fundOptions, fundSearchText]);

  const selectedFundName = selectedFundCode === 'all'
    ? ''
    : (transactions.find(t => t.fundCode === selectedFundCode)?.fundName || selectedFundCode);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // 类型过滤
      if (filterKey === 'pending' && t.status !== 'pending') return false;
      if (filterKey === 'buy' && (t.type !== 'buy' || t.status !== 'completed')) return false;
      if (filterKey === 'sell' && (t.type !== 'sell' || t.status !== 'completed')) return false;

      // 基金过滤（所有 filterKey 下都生效）
      if (selectedFundCode !== 'all' && t.fundCode !== selectedFundCode) return false;

      return true;
    });
  }, [transactions, filterKey, selectedFundCode]);

  const handleDelete = async (id: string) => {
    const checkResult = canDeleteTransaction(transactions, id);
    if (!checkResult.canDelete) {
      Toast.show({ content: checkResult.reason || '无法删除', position: 'bottom', duration: 5000 });
      return;
    }

    await Dialog.confirm({
      content: '确定要删除这条交易记录吗？',
      onConfirm: async () => {
        try {
          await removeTransaction(id);
          Toast.show({ content: '删除成功', position: 'bottom' });
          await refresh();
          await refreshHoldings();
        } catch (error) {
          Toast.show({ content: '删除失败', position: 'bottom' });
        }
      },
    });
  };

  useEffect(() => {
    let cancelled = false;
    processPendingTransactions().then((result) => {
      if (cancelled) return;
      if (result.processedCount > 0) {
        Toast.show({
          content: `已处理 ${result.processedCount} 笔在途交易`,
          position: 'bottom'
        });
        refresh();
        refreshHoldings();
      }
    }).catch(() => {});
    fetchAlerts().then((alerts) => {
      if (!cancelled) setAlerts(alerts);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [refresh, refreshHoldings]);

  const handleResolveAlert = async (alertId: string) => {
    try {
      await resolveAlert(alertId, 'resolved');
      setAlerts(prev => prev.filter(a => a.id !== alertId));
      await refresh();
      await refreshHoldings();
    } catch (err) {
      Toast.show({ content: err instanceof Error ? err.message : '操作失败', position: 'bottom' });
    }
  };

  const handleIgnoreAlert = async (alertId: string) => {
    try {
      await resolveAlert(alertId, 'ignored');
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err) {
      Toast.show({ content: err instanceof Error ? err.message : '操作失败', position: 'bottom' });
    }
  };

  const handleDeleteTransactionFromAlert = async (transactionId: string) => {
    try {
      await removeTransaction(transactionId);
      setAlerts(prev => prev.filter(a => a.transactionId !== transactionId));
      await refresh();
      await refreshHoldings();
    } catch {
      Toast.show({ content: '删除失败', position: 'bottom' });
    }
  };

  const groupedTransactions = useMemo(() => {
    return filteredTransactions.reduce((groups, t) => {
      const date = t.date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(t);
      return groups;
    }, {} as Record<string, typeof transactions>);
  }, [filteredTransactions]);

  const sortedDates = useMemo(() =>
    Object.keys(groupedTransactions).sort((a, b) =>
      new Date(b).getTime() - new Date(a).getTime()
    ), [groupedTransactions]);

  const hasActiveFilter = selectedFundCode !== 'all';

  const getEmptyStateText = () => {
    // M4 修复：加载失败时显示错误而非"暂无交易记录"
    if (error) return error;
    if (filterKey !== 'all' && !hasActiveFilter) {
      const labels: Record<FilterKey, string> = {
        all: '',
        buy: '买入',
        sell: '卖出',
        pending: '在途',
      };
      return `暂无${labels[filterKey]}交易记录`;
    }
    if (hasActiveFilter) {
      return `${selectedFundName} 暂无匹配的交易记录`;
    }
    return '暂无交易记录';
  };

  return (
    <div className="page-container">
      <h1 className="page-title" style={{ marginBottom: 16 }}>交易记录</h1>

      <Button
        block
        color="primary"
        onClick={() => setShowAddDialog(true)}
        style={{ marginBottom: 12 }}
      >
        <AddOutline /> 添加交易
      </Button>

      <Button
        block
        color="default"
        loading={refreshingPending}
        onClick={handleRefreshPending}
        style={{ marginBottom: 12 }}
      >
        刷新在途交易
      </Button>

      <CapsuleTabs
        activeKey={filterKey}
        onChange={handleFilterChange}
        style={{ marginBottom: 12 }}
      >
        <CapsuleTabs.Tab title="全部" key="all" />
        <CapsuleTabs.Tab title="买入" key="buy" />
        <CapsuleTabs.Tab title="卖出" key="sell" />
        <CapsuleTabs.Tab title="在途" key="pending" />
      </CapsuleTabs>

      {fundOptions.length > 0 && (
        <div style={{ marginBottom: 12, position: 'relative' }}>
          <SearchBar
            placeholder="搜索基金名称或代码"
            value={fundSearchText}
            onChange={(val) => {
              setFundSearchText(val);
              setShowFundDropdown(val.length > 0);
            }}
            onFocus={() => {
              if (fundSearchText) setShowFundDropdown(true);
            }}
            onBlur={() => {
              setTimeout(() => setShowFundDropdown(false), 200);
            }}
            style={{ '--background': '#f5f5f5' }}
          />
          {showFundDropdown && filteredFundOptions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                maxHeight: '200px',
                overflowY: 'auto',
                background: '#fff',
                border: '1px solid #f0f0f0',
                borderRadius: '0 0 8px 8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                zIndex: 100,
              }}
            >
              {filteredFundOptions.map((fund) => (
                <div
                  key={fund.code}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleFundSelect(fund.code);
                    setFundSearchText('');
                    setShowFundDropdown(false);
                  }}
                  style={{
                    padding: '10px 16px',
                    borderBottom: '1px solid #f5f5f5',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{fund.name}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{fund.code}</div>
                </div>
              ))}
            </div>
          )}
          {showFundDropdown && fundSearchText && filteredFundOptions.length === 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                padding: '12px',
                textAlign: 'center',
                background: '#fff',
                border: '1px solid #f0f0f0',
                borderRadius: '0 0 8px 8px',
                color: '#999',
                fontSize: 13,
                zIndex: 100,
              }}
            >
              无匹配的基金
            </div>
          )}
        </div>
      )}

      {alerts.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {alerts.map(a => (
            <PendingAlertCard
              key={a.id}
              alert={a}
              onResolve={handleResolveAlert}
              onIgnore={handleIgnoreAlert}
              onDeleteTransaction={handleDeleteTransactionFromAlert}
            />
          ))}
        </div>
      )}

      {hasActiveFilter && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 8px',
              borderRadius: 4,
              background: '#e6f4ff',
              color: '#1677ff',
              fontSize: 13,
            }}
          >
            <span>{selectedFundName}</span>
            <CloseOutline
              onClick={clearFundFilter}
              style={{ fontSize: 14, cursor: 'pointer' }}
            />
          </div>
        </div>
      )}

      <Card className="card">
        {filteredTransactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
            <div style={{ fontSize: 14, marginBottom: 16 }}>{getEmptyStateText()}</div>
            {!hasActiveFilter && filterKey === 'all' && !error && (
              <Button
                size="small"
                color="primary"
                fill="outline"
                onClick={() => setShowAddDialog(true)}
              >
                <AddOutline /> 添加第一笔交易
              </Button>
            )}
            {error && (
              <Button
                size="small"
                fill="outline"
                onClick={() => refresh()}
              >
                重试
              </Button>
            )}
            {hasActiveFilter && (
              <Button
                size="small"
                fill="outline"
                onClick={clearFundFilter}
              >
                清除筛选
              </Button>
            )}
          </div>
        ) : (
          <div>
            {sortedDates.map(date => (
              <div key={date}>
                <div
                  style={{
                    padding: '8px 0',
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#666',
                    borderBottom: '1px solid #f0f0f0'
                  }}
                >
                  {formatDate(date)}
                </div>
                <List>
                  {groupedTransactions[date].map(transaction => (
                    <SwipeAction
                      key={transaction.id}
                      rightActions={[
                        {
                          key: 'delete',
                          text: '删除',
                          color: 'danger',
                          onClick: () => handleDelete(transaction.id),
                        },
                      ]}
                    >
                      <List.Item
                        title={
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{ fontSize: 15, fontWeight: 500 }}>
                              {transaction.fundName}
                            </div>
                            <Tag
                              style={{ marginLeft: 8, fontSize: 11, background: transaction.type === 'buy' ? '#fff1f0' : '#f6ffed', color: transaction.type === 'buy' ? '#ff4d4f' : '#52c41a', border: `1px solid ${transaction.type === 'buy' ? '#ffa39e' : '#b7eb8f'}` }}
                            >
                              {transaction.type === 'buy' ? '买入' : '卖出'}
                            </Tag>
                            {transaction.status === 'pending' && (
                              <Tag
                                color="warning"
                                style={{ marginLeft: 8, fontSize: 11 }}
                              >
                                在途
                              </Tag>
                            )}
                          </div>
                        }
                        description={
                          <div style={{ fontSize: 13, color: '#999' }}>
                            {transaction.fundCode}
                            {transaction.status === 'pending'
                              ? ' | 等待净值确认'
                              : ` | 价格: ${transaction.price.toFixed(4)}`
                            }
                          </div>
                        }
                        extra={
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 15, fontWeight: 500 }}>
                              {transaction.status === 'pending'
                                ? (transaction.type === 'buy' ? `¥${transaction.amount.toFixed(2)}` : `${transaction.shares.toFixed(2)}份`)
                                : formatMoney(transaction.amount)
                              }
                            </div>
                            <div style={{ fontSize: 13, color: '#999' }}>
                              {transaction.status === 'pending'
                                ? '待确认'
                                : `${transaction.shares.toFixed(2)} 份`
                              }
                            </div>
                          </div>
                        }
                      />
                    </SwipeAction>
                  ))}
                </List>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div style={{ textAlign: 'center', padding: '12px', color: '#999', fontSize: 13 }}>
        共 {filteredTransactions.length} 条记录
      </div>

      <AddTransactionDialog
        visible={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        transactions={transactions}
        onTransactionAdded={async () => {
          await refresh();
          await refreshHoldings();
        }}
      />
    </div>
  );
};

export default Transactions;
