import React, { useState, useEffect, useCallback } from 'react';
import { Card, List, SearchBar, Tag, Button, Toast, Dialog, SpinLoading, SwipeAction, Tabs, Form, Input } from 'antd-mobile';
import { SearchOutline, RedoOutline, StarFill, StarOutline, AddOutline } from 'antd-mobile-icons';
import { searchFunds, getCachedFunds, batchRefreshFunds, markFundAsHolding, FundSearchResult } from '../services/fundApi';
import { useHoldings } from '../hooks/useSync';
import { db, FundCacheItem } from '../db';
import './Layout.css';

const FundList: React.FC = () => {
  // 状态管理
  const [activeTab, setActiveTab] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<FundSearchResult[]>([]);
  const [cachedFunds, setCachedFunds] = useState<FundCacheItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState({ current: 0, total: 0 });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm] = Form.useForm();
  const { holdings } = useHoldings();

  // 加载缓存基金
  const loadCachedFunds = useCallback(async () => {
    const funds = await getCachedFunds();
    setCachedFunds(funds);
  }, []);

  // 初始加载
  useEffect(() => {
    loadCachedFunds();
  }, [loadCachedFunds]);

  // 同步持仓状态
  useEffect(() => {
    const syncHoldingStatus = async () => {
      const holdingCodes = new Set(holdings.map(h => h.fundCode));
      
      for (const fund of cachedFunds) {
        const shouldBeHolding = holdingCodes.has(fund.code);
        if (fund.isHolding !== (shouldBeHolding ? 1 : 0)) {
          await markFundAsHolding(fund.code, shouldBeHolding);
        }
      }
      
      // 重新加载
      await loadCachedFunds();
    };
    
    syncHoldingStatus();
  }, [holdings, cachedFunds, loadCachedFunds]);

  // 搜索基金
  const handleSearch = async (value: string) => {
    setSearchText(value);
    
    if (!value || value.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const results = await searchFunds(value.trim());
      setSearchResults(results);
      
      // 刷新缓存列表
      await loadCachedFunds();
      
      if (results.length === 0) {
        Toast.show({ content: '未找到相关基金', position: 'bottom' });
      }
    } catch (error) {
      Toast.show({ content: '搜索失败', position: 'bottom' });
    } finally {
      setIsSearching(false);
    }
  };

  // 批量刷新
  const handleBatchRefresh = async () => {
    const fundsToRefresh = activeTab === 'holding' 
      ? cachedFunds.filter(f => f.isHolding)
      : cachedFunds;
    
    if (fundsToRefresh.length === 0) {
      Toast.show({ content: '没有需要刷新的基金', position: 'bottom' });
      return;
    }
    
    const codes = fundsToRefresh.map(f => f.code);
    
    setIsRefreshing(true);
    setRefreshProgress({ current: 0, total: codes.length });
    
    try {
      const { success, failed } = await batchRefreshFunds(codes);
      
      // 刷新本地数据
      await loadCachedFunds();
      
      if (failed.length === 0) {
        Toast.show({ 
          content: `成功刷新 ${success.length} 只基金`, 
          position: 'bottom' 
        });
      } else {
        Toast.show({ 
          content: `成功 ${success.length} 只，失败 ${failed.length} 只`, 
          position: 'bottom' 
        });
      }
    } catch (error) {
      Toast.show({ content: '刷新失败', position: 'bottom' });
    } finally {
      setIsRefreshing(false);
      setRefreshProgress({ current: 0, total: 0 });
    }
  };

  // 切换持仓标记
  const toggleHolding = async (fund: FundCacheItem) => {
    try {
      const newStatus = !fund.isHolding;
      await markFundAsHolding(fund.code, newStatus);
      await loadCachedFunds();
      
      Toast.show({
        content: newStatus ? '已添加到持仓关注' : '已取消持仓关注',
        position: 'bottom',
      });
    } catch (error) {
      Toast.show({ content: '操作失败', position: 'bottom' });
    }
  };

  // 查看基金详情
  const handleFundClick = (fundCode: string) => {
    window.location.hash = `fund/${fundCode}`;
  };

  // 获取要展示的基金列表
  const getDisplayFunds = () => {
    if (activeTab === 'holding') {
      return cachedFunds.filter(f => f.isHolding);
    }
    return cachedFunds;
  };

  const displayFunds = getDisplayFunds();

  // 渲染基金项
  const renderFundItem = (fund: FundCacheItem) => (
    <SwipeAction
      key={fund.id}
      rightActions={[
        {
          key: 'holding',
          text: fund.isHolding ? '取消持仓' : '标记持仓',
          color: fund.isHolding ? 'default' : 'warning',
          onClick: () => toggleHolding(fund),
        },
      ]}
    >
      <List.Item
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 500 }}>{fund.name}</span>
            {fund.isHolding && <StarFill color='#ff4d4f' />}
          </div>
        }
        description={
          <div style={{ fontSize: 13, color: '#999' }}>
            <div>代码: {fund.code}</div>
            {fund.nav && (
              <div style={{ marginTop: 4 }}>
                净值: {fund.nav.toFixed(4)} 
                {fund.navDate && <span style={{ marginLeft: 8 }}>({fund.navDate})</span>}
              </div>
            )}
          </div>
        }
        extra={
          fund.nav ? (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{fund.nav.toFixed(3)}</div>
              {fund.dailyChangeRate !== undefined && (
                <div 
                  style={{ 
                    fontSize: 13, 
                    color: fund.dailyChangeRate >= 0 ? '#ff4d4f' : '#52c41a'
                  }}
                >
                  {fund.dailyChangeRate >= 0 ? '+' : ''}{fund.dailyChangeRate.toFixed(2)}%
                </div>
              )}
            </div>
          ) : null
        }
        onClick={() => handleFundClick(fund.code)}
        arrow
      />
    </SwipeAction>
  );

  // 手动添加基金
  const handleAddFund = async (values: { code: string; name: string }) => {
    try {
      const existing = await db.fundCache.where('code').equals(values.code).first();
      if (existing) {
        Toast.show({ content: '该基金已存在', position: 'bottom' });
        return;
      }

      const now = new Date().toISOString();
      await db.fundCache.add({
        id: `fc_${Date.now()}`,
        code: values.code,
        name: values.name,
        category: '自定义',
        source: 'search',
        isHolding: false,
        holdingShares: 0,
        searchCount: 1,
        lastUpdated: now,
        createdAt: now,
        updatedAt: now,
      });

      Toast.show({ content: '添加成功', position: 'bottom' });
      setShowAddDialog(false);
      addForm.resetFields();
      await loadCachedFunds();
    } catch (error) {
      Toast.show({ content: '添加失败', position: 'bottom' });
    }
  };

  // 渲染搜索结果
  const renderSearchResults = () => (
    <Card 
      title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SearchOutline />
        <span>搜索结果</span>
        <Tag color='primary'>{searchResults.length}</Tag>
      </div>} 
      className="card"
      style={{ marginBottom: 12 }}
    >
      <List>
        {searchResults.map((fund, index) => (
          <List.Item
            key={`search-${fund.code}-${index}`}
            title={<span style={{ fontSize: 15, fontWeight: 500 }}>{fund.name}</span>}
            description={
              <div style={{ fontSize: 13, color: '#999' }}>
                代码: {fund.code}
                {fund.type && <span> | {fund.type}</span>}
              </div>
            }
            onClick={() => handleFundClick(fund.code)}
            arrow
          />
        ))}
      </List>
      
      {searchResults.length === 0 && !isSearching && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
          未找到相关基金，可点击"+ 手动添加"
        </div>
      )}
    </Card>
  );

  return (
    <div className="page-container">
      <h1 className="page-title">基金列表</h1>

      {/* 搜索栏 */}
      <Card className="card" style={{ marginBottom: 12 }}>
        <SearchBar
          placeholder="搜索基金代码或名称（至少2个字）"
          value={searchText}
          onChange={handleSearch}
          style={{ marginBottom: 8 }}
        />
        
        {isSearching && (
          <div style={{ textAlign: 'center', padding: '10px' }}>
            <SpinLoading style={{ '--size': '24px' }} />
            <span style={{ marginLeft: 8, color: '#999', fontSize: 13 }}>搜索中...</span>
          </div>
        )}
      </Card>

      {/* 搜索结果 */}
      {searchResults.length > 0 && renderSearchResults()}

      {/* 手动添加按钮 */}
      <div style={{ marginBottom: 12 }}>
        <Button
          block
          color='primary'
          fill='outline'
          onClick={() => setShowAddDialog(true)}
        >
          <AddOutline /> 手动添加基金
        </Button>
      </div>

      {/* 标签页切换 */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginBottom: 12 }}
      >
        <Tabs.Tab 
          title={`全部 (${cachedFunds.length})`} 
          key="all" 
        />
        <Tabs.Tab 
          title={`持仓 (${cachedFunds.filter(f => f.isHolding).length})`} 
          key="holding" 
        />
      </Tabs>

      {/* 批量刷新按钮 */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <Button
          block
          color="primary"
          fill="outline"
          loading={isRefreshing}
          onClick={handleBatchRefresh}
        >
          <RedoOutline /> 
          {isRefreshing 
            ? `刷新中 (${refreshProgress.current}/${refreshProgress.total})` 
            : `批量刷新 (${displayFunds.length})`
          }
        </Button>
      </div>

      {/* 基金列表 */}
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{activeTab === 'holding' ? '持仓基金' : '已缓存基金'}</span>
            <Tag color="primary">{displayFunds.length}</Tag>
          </div>
        } 
        className="card"
      >
        <List>
          {displayFunds.map(renderFundItem)}
        </List>
        
        {displayFunds.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            {activeTab === 'holding' 
              ? '暂无持仓基金，请在全部列表中标记' 
              : '暂无缓存基金，请使用搜索添加'
            }
          </div>
        )}
      </Card>

      {/* 提示信息 */}
      <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: 12 }}>
        <p>提示：搜索基金会自动缓存到本地</p>
        <p>左滑基金项可标记/取消持仓</p>
        <p>点击基金查看详情</p>
      </div>

      {/* 添加基金对话框 */}
      <Dialog
        visible={showAddDialog}
        title='手动添加基金'
        content={
          <Form
            form={addForm}
            layout='vertical'
            onFinish={handleAddFund}
          >
            <Form.Item
              name='code'
              label='基金代码'
              rules={[{ required: true, message: '请输入基金代码' }]}
            >
              <Input placeholder='如：510300' />
            </Form.Item>
            <Form.Item
              name='name'
              label='基金名称'
              rules={[{ required: true, message: '请输入基金名称' }]}
            >
              <Input placeholder='如：沪深300ETF' />
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
                addForm.resetFields();
              },
            },
            {
              key: 'confirm',
              text: '添加',
              bold: true,
              onClick: () => addForm.submit(),
            },
          ],
        ]}
      />
    </div>
  );
};

export default FundList;
