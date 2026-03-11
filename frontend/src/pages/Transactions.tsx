import React, { useState, useEffect } from 'react';
import { Card, List, Tabs, Tag, Toast, SwipeAction, Dialog, Button, Form, Input, SearchBar, SpinLoading } from 'antd-mobile';
import { AddOutline } from 'antd-mobile-icons';
import { useTransactions, deleteTransaction, addTransaction } from '../hooks/useSync';
import { db, FundCacheItem } from '../db';
import { searchByCode, FundSearchResult, fetchFundNav } from '../services/fundApi';
import { updateLocalHoldingAfterTransaction } from '../services/syncService';
import { formatMoney, formatDate } from '../utils';
import './Layout.css';

const Transactions: React.FC = () => {
  const [activeType, setActiveType] = useState('all');
  const [activeStatus, setActiveStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const { transactions, refresh } = useTransactions();
  const [fundCache, setFundCache] = useState<FundCacheItem[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [form] = Form.useForm();
  
  // 基金代码搜索相关状态
  const [codeSearchText, setCodeSearchText] = useState('');
  const [codeSearchResults, setCodeSearchResults] = useState<FundSearchResult[]>([]);
  const [isCodeSearching, setIsCodeSearching] = useState(false);
  const [selectedFund, setSelectedFund] = useState<FundSearchResult | null>(null);
  
  // 当前交易类型和基金净值
  const [currentTradeType, setCurrentTradeType] = useState<'buy' | 'sell'>('buy');
  const [currentNav, setCurrentNav] = useState<number | null>(null);

  // 加载基金缓存
  useEffect(() => {
    const loadFundCache = async () => {
      const funds = await db.fundCache.toArray();
      setFundCache(funds);
    };
    loadFundCache();
  }, []);
  
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
    form.setFieldsValue({ fundCode: undefined, amount: undefined, shares: undefined, fee: undefined });
  };
  
  // 监听交易类型变化
  const handleTradeTypeChange = (type: 'buy' | 'sell') => {
    setCurrentTradeType(type);
    form.setFieldsValue({ type });
    // 重置相关字段
    form.setFieldsValue({ amount: undefined, shares: undefined, fee: undefined });
  };
  
  // 获取基金净值
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

  // 筛选交易记录
  const filteredTransactions = transactions.filter(t => {
    // 按类型筛选
    if (activeType !== 'all' && t.type !== activeType) return false;
    // 按状态筛选
    if (activeStatus !== 'all' && t.status !== activeStatus) return false;
    return true;
  });
  
  // 获取在途交易数量
  const pendingCount = transactions.filter(t => t.status === 'pending').length;

  const handleDelete = async (id: string) => {
    await Dialog.confirm({
      content: '确定要删除这条交易记录吗？',
      onConfirm: async () => {
        try {
          await deleteTransaction(id);
          Toast.show({ content: '删除成功', position: 'bottom' });
          refresh();
        } catch (error) {
          Toast.show({ content: '删除失败', position: 'bottom' });
        }
      },
    });
  };

  // 处理在途交易
  const processPendingTransactions = async () => {
    try {
      // 获取所有在途交易
      const pendingTransactions = await db.transactions
        .where('status')
        .equals('pending')
        .toArray();
      
      if (pendingTransactions.length === 0) return;
      
      console.log(`[Pending] 发现 ${pendingTransactions.length} 笔在途交易`);
      let processedCount = 0;
      
      for (const transaction of pendingTransactions) {
        try {
          // 尝试获取净值
          const navData = await fetchFundNav(transaction.fundCode);
          
          if (navData && navData.nav > 0) {
            // 有净值数据，处理在途交易
            const tradePrice = navData.nav;
            let shares: number;
            let amount: number;
            
            if (transaction.type === 'buy') {
              // 买入：根据金额计算份额
              amount = transaction.amount;
              shares = amount / tradePrice;
            } else {
              // 卖出：根据份额计算金额
              shares = transaction.shares;
              amount = shares * tradePrice;
            }
            
            // 更新交易记录
            await db.transactions.update(transaction.id, {
              price: tradePrice,
              shares: shares,
              amount: amount,
              status: 'completed',
            });
            
            // 更新持仓
            await updateLocalHoldingAfterTransaction({
              ...transaction,
              price: tradePrice,
              shares: shares,
              amount: amount,
            });
            
            processedCount++;
            console.log(`[Pending] 处理完成: ${transaction.fundCode}`);
          }
        } catch (error) {
          console.error(`[Pending] 处理失败 ${transaction.fundCode}:`, error);
        }
      }
      
      if (processedCount > 0) {
        Toast.show({ 
          content: `已处理 ${processedCount} 笔在途交易`, 
          position: 'bottom' 
        });
        refresh();
      }
    } catch (error) {
      console.error('[Pending] 处理在途交易失败:', error);
    }
  };

  // 进入页面时自动处理在途交易
  useEffect(() => {
    processPendingTransactions();
  }, []);

  const handleAddTransaction = async (values: any) => {
    try {
      // 从缓存中查找基金
      let fund = fundCache.find(f => f.code === values.fundCode);
      
      // 如果缓存中没有，尝试从收藏基金中查找
      if (!fund) {
        const favoriteFund = await db.favoriteFunds.where('code').equals(values.fundCode).first();
        if (favoriteFund) {
          fund = {
            id: favoriteFund.id,
            code: favoriteFund.code,
            name: favoriteFund.name,
            category: favoriteFund.category,
            source: 'system',
            isHolding: false,
            holdingShares: 0,
            searchCount: 0,
            lastUpdated: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as FundCacheItem;
        }
      }
      
      if (!fund) {
        Toast.show({ 
          content: '请先搜索添加该基金到列表', 
          position: 'bottom' 
        });
        return;
      }

      // 获取当日净值作为成交价格
      let tradePrice = currentNav;
      if (!tradePrice) {
        try {
          const navData = await fetchFundNav(fund.code);
          tradePrice = navData?.nav || 0;
        } catch (error) {
          console.log('无法获取净值，将创建在途交易');
        }
      }

      // 判断是否为在途交易（无法获取净值或净值为0）
      const isPending = !tradePrice || tradePrice <= 0;
      
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

      await addTransaction({
        fundId: fund.id,
        fundCode: fund.code,
        fundName: fund.name,
        type: values.type,
        date: values.date,
        amount: amount,
        price: finalPrice,
        shares: shares,
        fee: 0,
        remark: values.remark,
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
      refresh();
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
      <h1 className="page-title">交易记录</h1>

      {/* 添加交易按钮 */}
      <Button
        block
        color="primary"
        onClick={() => setShowAddDialog(true)}
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

      <Card className="card">
        {filteredTransactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            暂无交易记录
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
                              color={transaction.type === 'buy' ? 'success' : 'danger'}
                              style={{ marginLeft: 8, fontSize: 11 }}
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
                          maxHeight: '150px', 
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
              <Input type="date" />
            </Form.Item>

            {currentTradeType === 'buy' ? (
              <>
                <Form.Item
                  name="amount"
                  label="买入金额（元）"
                  rules={[{ required: true, message: '请输入买入金额' }]}
                  help={currentNav ? `当前净值: ${currentNav.toFixed(4)}` : ''}
                >
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    onChange={(val) => {
                      const amount = parseFloat(val || '0');
                      if (amount > 0 && currentNav) {
                        const shares = amount / currentNav;
                        form.setFieldsValue({ shares: shares.toFixed(2) });
                      }
                    }}
                  />
                </Form.Item>
                <Form.Item
                  name="shares"
                  label="获得份额"
                  style={{ marginBottom: 0 }}
                >
                  <Input type="number" disabled placeholder="自动计算" />
                </Form.Item>
              </>
            ) : (
              <>
                <Form.Item
                  name="shares"
                  label="卖出份额"
                  rules={[{ required: true, message: '请输入卖出份额' }]}
                  help={currentNav ? `当前净值: ${currentNav.toFixed(4)}` : ''}
                >
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    onChange={(val) => {
                      const shares = parseFloat(val || '0');
                      if (shares > 0 && currentNav) {
                        const amount = shares * currentNav;
                        form.setFieldsValue({ amount: amount.toFixed(2) });
                      }
                    }}
                  />
                </Form.Item>
                <Form.Item
                  name="amount"
                  label="卖出金额（元）"
                  style={{ marginBottom: 0 }}
                >
                  <Input type="number" disabled placeholder="自动计算" />
                </Form.Item>
              </>
            )}

            <Form.Item
              name="remark"
              label="备注"
            >
              <Input placeholder="可选" />
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
