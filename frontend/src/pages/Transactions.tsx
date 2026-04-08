import React, { useState, useEffect, useMemo } from 'react';
import { Card, List, CapsuleTabs, Tag, Toast, SwipeAction, Dialog, Button, Form, Input, SearchBar, SpinLoading } from 'antd-mobile';
import { AddOutline, CloseOutline } from 'antd-mobile-icons';

import { useTransactions, useHoldings } from '../hooks/useSync';
import { addTransactionWithHoldingUpdate, processPendingTransactions, canDeleteTransaction } from '../services/navUpdateService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { searchByCode, fetchFundNav, fetchFundHistory } from '../services/fundApi';
import type { FundSearchResult } from '../types';
import { formatMoney, formatDate, isTradeDay, getNextTradeDay } from '../utils';
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
  const { transactions, loading, saveTransaction, removeTransaction, refresh } = useTransactions();
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
  const [form] = Form.useForm();
  const [dialogDate, setDialogDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [codeSearchText, setCodeSearchText] = useState('');
  const [codeSearchResults, setCodeSearchResults] = useState<FundSearchResult[]>([]);
  const [isCodeSearching, setIsCodeSearching] = useState(false);
  const [selectedFund, setSelectedFund] = useState<FundSearchResult | null>(null);

  const [currentTradeType, setCurrentTradeType] = useState<'buy' | 'sell'>('buy');
  const [currentNav, setCurrentNav] = useState<number | null>(null);
  const [selectedDateNav, setSelectedDateNav] = useState<{ nav: number; date: string } | null>(null);
  const [isDateNavLoading, setIsDateNavLoading] = useState(false);
  const [isPendingNav, setIsPendingNav] = useState(false);

  const [fundSearchText, setFundSearchText] = useState('');
  const [showFundDropdown, setShowFundDropdown] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (codeSearchText.trim().length >= 4) {
        setIsCodeSearching(true);
        try {
          const results = await searchByCode(codeSearchText.trim());
          setCodeSearchResults(results);
        } catch (error) {
          console.error('搜索失败:', error);
        } finally {
          setIsCodeSearching(false);
        }
      } else {
        setCodeSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [codeSearchText]);

  const handleSelectFund = (fund: FundSearchResult) => {
    setSelectedFund(fund);
    setCodeSearchText(fund.code);
    setCodeSearchResults([]);
    form.setFieldsValue({ fundCode: fund.code });
  };

  const resetSearch = () => {
    setCodeSearchText('');
    setCodeSearchResults([]);
    setSelectedFund(null);
    setCurrentNav(null);
    setSelectedDateNav(null);
    setIsPendingNav(false);
    form.setFieldsValue({ fundCode: undefined, amount: undefined, shares: undefined, fee: undefined });
  };

  const handleTradeTypeChange = (type: 'buy' | 'sell') => {
    setCurrentTradeType(type);
    form.setFieldsValue({ type });
    form.setFieldsValue({ amount: undefined, shares: undefined, fee: undefined });
  };

  useEffect(() => {
    const fetchNav = async () => {
      if (selectedFund?.code) {
        try {
          const navData = await fetchFundNav(selectedFund.code);
          if (navData) {
            setCurrentNav(navData.nav);
          }
        } catch (error) {
          console.error('获取净值失败:', error);
        }
      }
    };
    fetchNav();
  }, [selectedFund]);

  useEffect(() => {
    if (!dialogDate || !selectedFund?.code) {
      setSelectedDateNav(null);
      return;
    }

    let cancelled = false;

    const fetchDateNav = async () => {
      const today = new Date().toISOString().split('T')[0];

      if (dialogDate === today) {
        if (!isTradeDay(new Date())) {
          setIsPendingNav(true);
          setSelectedDateNav(null);
          return;
        }
        if (currentNav) {
          setIsPendingNav(false);
          setSelectedDateNav({ nav: currentNav, date: today });
        } else {
          setIsPendingNav(true);
          setSelectedDateNav(null);
        }
        return;
      }

      setIsDateNavLoading(true);
      try {
        let historyData = await fetchFundHistory(selectedFund.code, 1, 1, dialogDate, dialogDate);
        if (cancelled) return;

        if (historyData.length > 0) {
          setIsPendingNav(false);
          setSelectedDateNav({ nav: historyData[0].nav, date: historyData[0].date });
        } else {
          const nextData = await fetchFundHistory(selectedFund.code, 5, 1, dialogDate, '');
          if (cancelled) return;

          if (nextData.length > 0) {
            const nextRecord = nextData[nextData.length - 1];
            if (nextRecord.date >= dialogDate) {
              setIsPendingNav(false);
              setSelectedDateNav({ nav: nextRecord.nav, date: nextRecord.date });
            } else {
              setIsPendingNav(true);
              setSelectedDateNav(null);
            }
          } else {
            setIsPendingNav(true);
            setSelectedDateNav(null);
          }
        }
      } catch (error) {
        if (cancelled) return;
        console.error('获取历史净值失败:', error);
        setIsPendingNav(true);
        setSelectedDateNav(null);
      } finally {
        if (!cancelled) setIsDateNavLoading(false);
      }
    };

    fetchDateNav();
    return () => { cancelled = true; };
  }, [dialogDate, selectedFund?.code, currentNav]);

  useEffect(() => {
    if (isPendingNav) {
      form.setFieldsValue({ shares: undefined, amount: undefined });
      return;
    }

    const nav = selectedDateNav?.nav || currentNav;
    if (!nav) return;

    const amount = parseFloat(form.getFieldValue('amount') || '0');
    const shares = parseFloat(form.getFieldValue('shares') || '0');

    if (currentTradeType === 'buy' && amount > 0) {
      const newShares = amount / nav;
      form.setFieldsValue({ shares: newShares.toFixed(2) });
    } else if (currentTradeType === 'sell' && shares > 0) {
      const newAmount = shares * nav;
      form.setFieldsValue({ amount: newAmount.toFixed(2) });
    }
  }, [selectedDateNav, currentNav, currentTradeType, form, isPendingNav]);

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
      if (filterKey === 'pending') return t.status === 'pending';
      if (filterKey === 'buy') return t.type === 'buy' && t.status === 'completed';
      if (filterKey === 'sell') return t.type === 'sell' && t.status === 'completed';
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
    processPendingTransactions().then((result) => {
      if (result.processedCount > 0) {
        Toast.show({
          content: `已处理 ${result.processedCount} 笔在途交易`,
          position: 'bottom'
        });
        refresh();
        refreshHoldings();
      }
    });
  }, []);

  const handleAddTransaction = async (values: any) => {
    try {
      if (!selectedFund) {
        Toast.show({ content: '请先选择基金', position: 'bottom' });
        return;
      }

      if (isSupabaseConfigured()) {
        const { data: existing } = await supabase
          .from('favorite_funds')
          .select('id')
          .eq('fund_code', selectedFund.code)
          .limit(1)
          .maybeSingle();
        if (!existing) {
          await supabase.from('favorite_funds').insert({
            fund_code: selectedFund.code,
            fund_name: selectedFund.name,
            category: selectedFund.type,
          } as any);
        }
      }

      const tradeDate = new Date(values.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      tradeDate.setHours(0, 0, 0, 0);
      const actualTradeDay = isTradeDay(tradeDate) ? tradeDate : getNextTradeDay(tradeDate);

      let tradePrice: number | null = null;
      let isPending = false;

      if (selectedDateNav && selectedDateNav.date === values.date) {
        tradePrice = selectedDateNav.nav;
      }

      if (!tradePrice) {
        const isHistoricalDate = actualTradeDay < today;

        if (isHistoricalDate) {
          try {
            let historyData = await fetchFundHistory(selectedFund.code, 1, 1, values.date, values.date);
            if (historyData.length > 0) {
              tradePrice = historyData[0].nav;
            } else {
              const nextData = await fetchFundHistory(selectedFund.code, 5, 1, values.date, '');
              if (nextData.length > 0) {
                const nextRecord = nextData[nextData.length - 1];
                if (nextRecord.date >= values.date) {
                  tradePrice = nextRecord.nav;
                }
              }
            }
          } catch (error) {
            console.error('获取历史净值失败:', error);
          }
        } else {
          if (!isTradeDay(tradeDate)) {
            isPending = true;
          } else {
            tradePrice = currentNav;
            if (!tradePrice) {
              try {
                const navData = await fetchFundNav(selectedFund.code);
                tradePrice = navData?.nav || 0;
              } catch (error) {
                console.log('无法获取净值');
              }
            }

            const isAfterNavTime = new Date().getHours() >= 21;
            if (actualTradeDay > today) {
              isPending = true;
            } else if (actualTradeDay.getTime() === today.getTime() && !isAfterNavTime) {
              isPending = true;
            }
          }
        }
      }

      if (!tradePrice || tradePrice <= 0) {
        isPending = true;
      }

      const confirmDate = actualTradeDay.toISOString().split('T')[0];

      let shares: number;
      let amount: number;
      let finalPrice: number;

      if (values.type === 'buy') {
        amount = Number(values.amount);
        shares = isPending ? 0 : amount / (tradePrice || 1);
        finalPrice = isPending ? 0 : (tradePrice || 0);
      } else {
        shares = Number(values.shares);
        amount = isPending ? 0 : shares * (tradePrice || 0);
        finalPrice = isPending ? 0 : (tradePrice || 0);
      }

      await addTransactionWithHoldingUpdate({
        fundId: selectedFund.code,
        fundCode: selectedFund.code,
        fundName: selectedFund.name,
        type: values.type,
        date: values.date,
        confirmDate: confirmDate,
        amount: amount,
        price: finalPrice,
        shares: shares,
        fee: 0,
        status: isPending ? 'pending' : 'completed',
      });

      if (isPending) {
        Toast.show({
          content: '已创建在途交易，净值更新后将自动处理',
          position: 'bottom'
        });
      } else {
        Toast.show({
          content: `添加成功，${values.type === 'buy' ? '买入' : '卖出'}${shares.toFixed(2)}份`,
          position: 'bottom'
        });
      }

      setShowAddDialog(false);
      resetSearch();
      form.resetFields();
      setCurrentTradeType('buy');
      await refresh();
      await refreshHoldings();
    } catch (error) {
      console.error('Add transaction error:', error);
      Toast.show({ content: '添加失败', position: 'bottom' });
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
        onClick={() => {
          setDialogDate(new Date().toISOString().split('T')[0]);
          setShowAddDialog(true);
        }}
        style={{ marginBottom: 12 }}
      >
        <AddOutline /> 添加交易
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
            {!hasActiveFilter && filterKey === 'all' && (
              <Button
                size="small"
                color="primary"
                fill="outline"
                onClick={() => setShowAddDialog(true)}
              >
                <AddOutline /> 添加第一笔交易
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

      <Dialog
        visible={showAddDialog}
        title="添加交易"
        style={{ '--max-width': '95vw' }}
        bodyStyle={{ maxHeight: '80vh', overflowY: 'auto', padding: '16px 20px' }}
        onClose={() => {
          setShowAddDialog(false);
          resetSearch();
          form.resetFields();
        }}
        content={
          <Form
            form={form}
            layout="vertical"
            onFinish={handleAddTransaction}
          >
            <Form.Item
              name="fundCode"
              label="基金代码"
              rules={[{ required: true, message: '请选择基金' }]}
              style={{ marginBottom: 8 }}
            >
              <div>
                {selectedFund ? (
                  <div
                    style={{
                      padding: '8px 12px',
                      background: '#f0f7ff',
                      borderRadius: '4px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 500 }}>{selectedFund.name}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>{selectedFund.code}</div>
                    </div>
                    <Button size="small" onClick={resetSearch}>更换</Button>
                  </div>
                ) : (
                  <>
                    <SearchBar
                      placeholder="输入基金代码（如：000001）"
                      value={codeSearchText}
                      onChange={setCodeSearchText}
                      style={{ '--background': '#f5f5f5' }}
                    />
                    {isCodeSearching && (
                      <div style={{ textAlign: 'center', padding: '8px' }}>
                        <SpinLoading style={{ '--size': '16px' }} />
                      </div>
                    )}
                    {!isCodeSearching && codeSearchResults.length > 0 && (
                      <div
                        style={{
                          maxHeight: '200px',
                          overflowY: 'auto',
                          border: '1px solid #f0f0f0',
                          borderRadius: '4px',
                          marginTop: '4px'
                        }}
                      >
                        {codeSearchResults
                          .filter((fund, index, self) =>
                            index === self.findIndex(f => f.code === fund.code)
                          )
                          .map((fund) => (
                            <div
                              key={fund.code}
                              onClick={() => handleSelectFund(fund)}
                              style={{
                                padding: '8px 12px',
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
                    {!isCodeSearching && codeSearchText.length >= 4 && codeSearchResults.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '8px', color: '#999', fontSize: 12 }}>
                        未找到匹配代码的基金
                      </div>
                    )}
                    {!isCodeSearching && codeSearchText.length >= 2 && codeSearchText.length < 4 && (
                      <div style={{ textAlign: 'center', padding: '4px', color: '#999', fontSize: 11 }}>
                        继续输入以获得更准确的结果...
                      </div>
                    )}
                  </>
                )}
              </div>
            </Form.Item>

            <Form.Item
              name="type"
              label="交易类型"
              rules={[{ required: true }]}
              initialValue="buy"
            >
              <div style={{ display: 'flex', gap: 12 }}>
                <div
                  onClick={() => handleTradeTypeChange('buy')}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    textAlign: 'center',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.2s',
                    border: currentTradeType === 'buy' ? '2px solid #1677ff' : '1px solid #d9d9d9',
                    backgroundColor: currentTradeType === 'buy' ? '#e6f4ff' : '#fff',
                    color: currentTradeType === 'buy' ? '#1677ff' : '#666',
                  }}
                >
                  买入
                </div>
                <div
                  onClick={() => handleTradeTypeChange('sell')}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    textAlign: 'center',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.2s',
                    border: currentTradeType === 'sell' ? '2px solid #ff4d4f' : '1px solid #d9d9d9',
                    backgroundColor: currentTradeType === 'sell' ? '#fff1f0' : '#fff',
                    color: currentTradeType === 'sell' ? '#ff4d4f' : '#666',
                  }}
                >
                  卖出
                </div>
              </div>
            </Form.Item>

            <Form.Item
              name="date"
              label="交易日期"
              rules={[{ required: true }]}
              initialValue={new Date().toISOString().split('T')[0]}
            >
              <Input type="date" style={{ height: 44 }} onChange={(val) => {
                setDialogDate(val || new Date().toISOString().split('T')[0]);
              }} />
            </Form.Item>

            {(selectedDateNav || isPendingNav || isDateNavLoading) && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: 16,
                  background: isPendingNav ? '#f5f5f5' : `${selectedDateNav ? '#52c41a' : '#faad14'}10`,
                  border: `1px solid ${isPendingNav ? '#d9d9d9' : selectedDateNav ? '#52c41a' : '#faad14'}`,
                }}
              >
                {isDateNavLoading ? (
                  <span style={{ fontSize: 13, color: '#999' }}>正在获取净值...</span>
                ) : isPendingNav ? (
                  <span style={{ fontSize: 13, color: '#999' }}>在途交易，净值待定</span>
                ) : selectedDateNav ? (
                  <div style={{ fontSize: 14 }}>
                    <span style={{ color: '#666' }}>净值: </span>
                    <span style={{ fontWeight: 600, color: '#333' }}>{selectedDateNav.nav.toFixed(4)}</span>
                    <span style={{ color: '#999', marginLeft: 8 }}>({selectedDateNav.date})</span>
                  </div>
                ) : null}
              </div>
            )}

            {currentTradeType === 'buy' ? (
              <>
                <Form.Item
                  name="amount"
                  label="交易金额（元）"
                  rules={[
                    { required: true, message: '请输入交易金额' },
                    { validator: (_, value) => parseFloat(value || '0') > 0 ? Promise.resolve() : Promise.reject(new Error('交易金额必须大于0')) },
                  ]}
                  help={isPendingNav
                    ? '在途交易，净值待定'
                    : isDateNavLoading
                      ? '正在获取净值...'
                      : selectedDateNav
                        ? `使用净值: ${selectedDateNav.nav.toFixed(4)}`
                        : currentNav
                          ? `使用当前净值: ${currentNav.toFixed(4)}`
                          : ''}
                >
                  <Input
                    type="number"
                    placeholder="0.00"
                    style={{ height: 44 }}
                    onChange={(val) => {
                      if (isPendingNav) return;
                      const amount = parseFloat(val || '0');
                      const nav = selectedDateNav?.nav || currentNav;
                      if (amount > 0 && nav) {
                        const shares = amount / nav;
                        form.setFieldsValue({ shares: shares.toFixed(2) });
                      }
                    }}
                  />
                </Form.Item>
                <Form.Item
                  name="shares"
                  label="交易份额"
                  style={{ marginBottom: 0 }}
                >
                  <Input type="number" disabled placeholder="自动计算" style={{ height: 44 }} />
                </Form.Item>
              </>
            ) : (
              <>
                <Form.Item
                  name="shares"
                  label="交易份额"
                  rules={[
                    { required: true, message: '请输入交易份额' },
                    { validator: (_, value) => parseFloat(value || '0') > 0 ? Promise.resolve() : Promise.reject(new Error('交易份额必须大于0')) },
                  ]}
                  help={isPendingNav
                    ? '在途交易，净值待定'
                    : isDateNavLoading
                      ? '正在获取净值...'
                      : selectedDateNav
                        ? `使用净值: ${selectedDateNav.nav.toFixed(4)}`
                        : currentNav
                          ? `使用当前净值: ${currentNav.toFixed(4)}`
                          : ''}
                >
                  <Input
                    type="number"
                    placeholder="0.00"
                    style={{ height: 44 }}
                    onChange={(val) => {
                      if (isPendingNav) return;
                      const shares = parseFloat(val || '0');
                      const nav = selectedDateNav?.nav || currentNav;
                      if (shares > 0 && nav) {
                        const amount = shares * nav;
                        form.setFieldsValue({ amount: amount.toFixed(2) });
                      }
                    }}
                  />
                </Form.Item>
                <Form.Item
                  name="amount"
                  label="交易金额（元）"
                  style={{ marginBottom: 0 }}
                >
                  <Input type="number" disabled placeholder="自动计算" style={{ height: 44 }} />
                </Form.Item>
              </>
            )}

            <Form.Item
              name="remark"
              label="备注"
            >
              <Input placeholder="可选" style={{ height: 44 }} />
            </Form.Item>
          </Form>
        }
        actions={[
          [
            {
              key: 'cancel',
              text: '取消',
              onClick: () => {
                setShowAddDialog(false);
                resetSearch();
                form.resetFields();
                setCurrentTradeType('buy');
              },
            },
            {
              key: 'confirm',
              text: '确定',
              bold: true,
              onClick: async () => {
                const values = await form.validateFields();
                if (values) {
                  await handleAddTransaction(values);
                }
              },
            },
          ],
        ]}
      />
    </div>
  );
};

export default Transactions;
