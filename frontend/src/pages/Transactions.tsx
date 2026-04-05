import React, { useState, useEffect } from 'react';
import { Card, List, Tabs, Tag, Toast, SwipeAction, Dialog, Button, Form, Input, SearchBar, SpinLoading, Picker } from 'antd-mobile';
import { AddOutline } from 'antd-mobile-icons';

import { useTransactions, useHoldings } from '../hooks/useSync';
import { addTransactionWithHoldingUpdate, processPendingTransactions, canDeleteTransaction } from '../services/navUpdateService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { searchByCode, fetchFundNav, fetchFundHistory } from '../services/fundApi';
import type { FundSearchResult } from '../types';
import { formatMoney, formatDate } from '../utils';
import './Layout.css';

/**
 * 判断是否为交易日（周一至周五，不考虑节假日）
 */
function isTradeDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6; // 0=周日, 6=周六
}

/**
 * 获取下一个交易日
 */
function getNextTradeDay(date: Date): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  while (!isTradeDay(next)) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

const Transactions: React.FC = () => {
  // 解析 hash 中的查询参数
  const getFundCodeFromHash = () => {
    const hash = window.location.hash;
    const match = hash.match(/\?fundCode=([^&]+)/);
    return match ? match[1] : null;
  };
  
  const [fundCodeFromUrl, setFundCodeFromUrl] = useState<string | null>(getFundCodeFromHash());
  
  const [activeType, setActiveType] = useState('all');
  const [activeStatus, setActiveStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const [selectedFundCode, setSelectedFundCode] = useState<string>(fundCodeFromUrl || 'all');
  const [showFundPicker, setShowFundPicker] = useState(false);
  const { transactions, loading, saveTransaction, removeTransaction, refresh } = useTransactions();
  const { refresh: refreshHoldings } = useHoldings();
  
  // 监听 hash 变化
  useEffect(() => {
    const handleHashChange = () => {
      const newFundCode = getFundCodeFromHash();
      setFundCodeFromUrl(newFundCode);
      setSelectedFundCode(newFundCode || 'all');
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [form] = Form.useForm();
  const [dialogDate, setDialogDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // 基金代码搜索相关状态
  const [codeSearchText, setCodeSearchText] = useState('');
  const [codeSearchResults, setCodeSearchResults] = useState<FundSearchResult[]>([]);
  const [isCodeSearching, setIsCodeSearching] = useState(false);
  const [selectedFund, setSelectedFund] = useState<FundSearchResult | null>(null);
  
  // 当前交易类型和基金净值
  const [currentTradeType, setCurrentTradeType] = useState<'buy' | 'sell'>('buy');
  const [currentNav, setCurrentNav] = useState<number | null>(null);
  const [selectedDateNav, setSelectedDateNav] = useState<{ nav: number; date: string } | null>(null);
  const [isDateNavLoading, setIsDateNavLoading] = useState(false);
  const [isPendingNav, setIsPendingNav] = useState(false);

  // 防抖搜索基金代码
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
  
  // 选择基金
  const handleSelectFund = (fund: FundSearchResult) => {
    setSelectedFund(fund);
    setCodeSearchText(fund.code);
    setCodeSearchResults([]);
    form.setFieldsValue({ fundCode: fund.code });
  };
  
  // 重置搜索
  const resetSearch = () => {
    setCodeSearchText('');
    setCodeSearchResults([]);
    setSelectedFund(null);
    setCurrentNav(null);
    setSelectedDateNav(null);
    setIsPendingNav(false);
    form.setFieldsValue({ fundCode: undefined, amount: undefined, shares: undefined, fee: undefined });
  };
  
  // 监听交易类型变化
  const handleTradeTypeChange = (type: 'buy' | 'sell') => {
    setCurrentTradeType(type);
    form.setFieldsValue({ type });
    // 重置相关字段
    form.setFieldsValue({ amount: undefined, shares: undefined, fee: undefined });
  };
  
  // 获取基金净值（最新净值）
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

  // 监听对话框日期变化，获取该日期的净值
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

  // 当净值数据更新时，自动重新计算份额/金额
  useEffect(() => {
    // 如果在途状态，清空计算结果
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

  // 从交易记录中提取所有唯一的基金代码（用于筛选）
  const uniqueFundCodes = Array.from(new Set(transactions.map(t => t.fundCode)));
  
  // 准备 Picker 选项（只显示基金名称，更简洁）
  const fundPickerColumns = [
    [
      { label: '全部基金', value: 'all' },
      ...uniqueFundCodes.map(code => {
        const fundName = transactions.find(t => t.fundCode === code)?.fundName || code;
        return { label: fundName, value: code };
      }),
    ],
  ];
  
  // 当前选中的基金显示文本
  const selectedFundLabel = selectedFundCode === 'all' 
    ? '全部基金' 
    : (transactions.find(t => t.fundCode === selectedFundCode)?.fundName || selectedFundCode);
  
  // 清除基金筛选，返回全部
  const clearFundFilter = () => {
    setSelectedFundCode('all');
    window.location.hash = '#transactions';
  };

  // 筛选交易记录
  const filteredTransactions = transactions.filter(t => {
    // 按类型筛选
    if (activeType !== 'all' && t.type !== activeType) return false;
    // 按状态筛选
    if (activeStatus !== 'all' && t.status !== activeStatus) return false;
    // 按基金代码筛选
    if (selectedFundCode !== 'all' && t.fundCode !== selectedFundCode) return false;
    return true;
  });
  
  // 获取在途交易数量
  const pendingCount = transactions.filter(t => t.status === 'pending').length;

  const handleDelete = async (id: string) => {
    // 验证是否可以删除
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

  // 进入页面时自动处理在途交易
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
      // 使用已选择的基金（用户在搜索框中选择的）
      if (!selectedFund) {
        Toast.show({ content: '请先选择基金', position: 'bottom' });
        return;
      }

      // 自动收藏基金（如果未收藏）
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

      // 优先使用已获取的日期净值
      const tradeDate = new Date(values.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      tradeDate.setHours(0, 0, 0, 0);
      const actualTradeDay = isTradeDay(tradeDate) ? tradeDate : getNextTradeDay(tradeDate);
      
      let tradePrice: number | null = null;
      let isPending = false;
      
      // 优先使用已获取的日期净值
      if (selectedDateNav && selectedDateNav.date === values.date) {
        tradePrice = selectedDateNav.nav;
      }
      
      // 如果没有，尝试获取
      if (!tradePrice) {
        const isHistoricalDate = actualTradeDay < today;
        
        if (isHistoricalDate) {
          try {
            // 先尝试精确匹配
            let historyData = await fetchFundHistory(selectedFund.code, 1, 1, values.date, values.date);
            if (historyData.length > 0) {
              tradePrice = historyData[0].nav;
            } else {
              // 精确匹配失败（非交易日）：查找下一交易日净值
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
          // 今天或未来：检查是否是交易日
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
      
      // 根据交易类型计算份额和金额
      let shares: number;
      let amount: number;
      let finalPrice: number;
      
      if (values.type === 'buy') {
        // 买入：输入金额，计算份额（如果在途，份额先设为0）
        amount = Number(values.amount);
        shares = isPending ? 0 : amount / (tradePrice || 1);
        finalPrice = isPending ? 0 : (tradePrice || 0);
      } else {
        // 卖出：输入份额，计算金额（如果在途，金额先设为0）
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

  // 按日期分组
  const groupedTransactions = filteredTransactions.reduce((groups, t) => {
    const date = t.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(t);
    return groups;
  }, {} as Record<string, typeof transactions>);

  const sortedDates = Object.keys(groupedTransactions).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <div className="page-container">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        {fundCodeFromUrl && (
          <Button
            size='small'
            fill='none'
            onClick={clearFundFilter}
            style={{ marginRight: 8, padding: '4px 8px' }}
          >
            ← 返回全部
          </Button>
        )}
        <h1 className="page-title" style={{ margin: 0 }}>
          {fundCodeFromUrl ? `${selectedFundLabel} 的交易` : '交易记录'}
        </h1>
      </div>

      {/* 添加交易按钮 */}
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

      <Tabs
        activeKey={activeStatus}
        onChange={(key) => setActiveStatus(key as 'all' | 'pending' | 'completed')}
        style={{ marginBottom: 12 }}
      >
        <Tabs.Tab title="全部交易" key="all" />
        <Tabs.Tab 
          title={pendingCount > 0 ? `在途 (${pendingCount})` : '在途'} 
          key="pending" 
        />
        <Tabs.Tab title="已完成" key="completed" />
      </Tabs>

      <Tabs
        activeKey={activeType}
        onChange={setActiveType}
        style={{ marginBottom: 12 }}
      >
        <Tabs.Tab title="全部" key="all" />
        <Tabs.Tab title="买入" key="buy" />
        <Tabs.Tab title="卖出" key="sell" />
      </Tabs>

      {/* 基金代码筛选 - 使用 Picker 滚轮选择 */}
      {(uniqueFundCodes.length > 0 || fundCodeFromUrl) && (
        <div style={{ marginBottom: 12 }}>
          <Button
            fill='outline'
            size='small'
            onClick={() => setShowFundPicker(true)}
            style={{
              width: '100%',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #e0e0e0',
              background: '#fff',
            }}
          >
            <span style={{ 
              color: selectedFundCode === 'all' ? '#999' : '#333',
              fontSize: 14,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 'calc(100% - 40px)',
            }}>
              {selectedFundLabel}
            </span>
            <span style={{ color: '#1677ff', fontSize: 13, flexShrink: 0 }}>
              选择基金 ▼
            </span>
          </Button>
          
          <Picker
            visible={showFundPicker}
            columns={fundPickerColumns}
            value={[selectedFundCode]}
            onConfirm={(val) => {
              setSelectedFundCode(val[0] as string);
              setShowFundPicker(false);
              // 更新 URL 参数
              if (val[0] === 'all') {
                window.location.hash = '#transactions';
              } else {
                window.location.hash = `#transactions?fundCode=${val[0]}`;
              }
            }}
            onCancel={() => setShowFundPicker(false)}
          />
        </div>
      )}

      <Card className="card">
        {filteredTransactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            {fundCodeFromUrl 
              ? `${selectedFundLabel} 暂无交易记录`
              : '暂无交易记录'
            }
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

      {/* 添加交易对话框 */}
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
            {/* 基金代码搜索 */}
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

            {/* 净值预览卡片 */}
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
