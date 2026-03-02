import React, { useState } from 'react';
import { Card, List, Tabs, Tag, Toast, SwipeAction, Dialog } from 'antd-mobile';
import { useTransactions, deleteTransaction } from '../hooks/useDB';
import { formatMoney, formatDate } from '../utils';
import './Layout.css';

const Transactions: React.FC = () => {
  const [activeType, setActiveType] = useState('all');
  const { transactions, loading, refresh } = useTransactions();

  // 筛选交易记录
  const filteredTransactions = transactions.filter(t => {
    if (activeType === 'all') return true;
    return t.type === activeType;
  });

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
                          </div>
                        }
                        description={
                          <div style={{ fontSize: 13, color: '#999' }}>
                            {transaction.fundCode} | 价格: {transaction.price.toFixed(4)}
                          </div>
                        }
                        extra={
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 15, fontWeight: 500 }}>
                              {formatMoney(transaction.amount)}
                            </div>
                            <div style={{ fontSize: 13, color: '#999' }}>
                              {transaction.shares.toFixed(2)} 份
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
    </div>
  );
};

export default Transactions;
