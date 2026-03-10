import React, { useState, useEffect, useCallback } from 'react';
import { Card, List, SearchBar, Tag, Button, Toast, Dialog, SpinLoading, SwipeAction, Tabs, Form, Input } from 'antd-mobile';
import { SearchOutline, RedoOutline, StarFill, StarOutline, AddOutline } from 'antd-mobile-icons';
import { searchByCode, searchByName, searchFunds, getCachedFunds, batchRefreshFunds, markFundAsHolding, FundSearchResult } from '../services/fundApi';
import { useHoldings } from '../hooks/useSync';
import { db, FundCacheItem } from '../db';
import './Layout.css';

const FundList: React.FC = () => {
  // 状态管理
  const [activeTab, setActiveTab] = useState('all');
  
  // 双搜索栏状态
  const [codeSearchText, setCodeSearchText] = useState('');
  const [nameSearchText, setNameSearchText] = useState('');
  const [codeSearchResults, setCodeSearchResults] = useState<FundSearchResult[]>([]);
  const [nameSearchResults, setNameSearchResults] = useState<FundSearchResult[]>([]);
  const [isCodeSearching, setIsCodeSearching] = useState(false);
  const [isNameSearching, setIsNameSearching] = useState(false);
  
  // 兼容旧版搜索
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<FundSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [cachedFunds, setCachedFunds] = useState<FundCacheItem[]>([]);
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
        if (fund.isHolding !== shouldBeHolding) {
          await markFundAsHolding(fund.code, shouldBeHolding);
        }
      }
      
      // 重新加载
      await loadCachedFunds();
    };
    
    syncHoldingStatus();
  }, [holdings, cachedFunds, loadCachedFunds]);

  // 按代码搜索基金
  const handleCodeSearch = async (value: string) => {
    setCodeSearchText(value);
    setNameSearchText(''); // 清空名称搜索
    setNameSearchResults([]);
    
    if (!value || value.trim().length < 2) {
      setCodeSearchResults([]);
      return;
    }
    
    setIsCodeSearching(true);
    try {
      const results = await searchByCode(value.trim());
      setCodeSearchResults(results);
      
      // 刷新缓存列表
      await loadCachedFunds();
      
      if (results.length === 0) {
        Toast.show({ content: '未找到匹配代码的基金', position: 'bottom' });
      }
    } catch (error) {
      Toast.show({ content: '搜索失败', position: 'bottom' });
    } finally {
      setIsCodeSearching(false);
    }
  };

  // 按名称搜索基金
  const handleNameSearch = async (value: string) => {
    setNameSearchText(value);
    setCodeSearchText(''); // 清空代码搜索
    setCodeSearchResults([]);
    
    if (!value || value.trim().length < 2) {
      setNameSearchResults([]);
      return;
    }
    
    setIsNameSearching(true);
    try {
      const results = await searchByName(value.trim());
      setNameSearchResults(results);
      
      // 刷新缓存列表
      await loadCachedFunds();
      
      if (results.length === 0) {
        Toast.show({ content: '未找到匹配名称的基金', position: 'bottom' });
      }
    } catch (error) {
      Toast.show({ content: '搜索失败', position: 'bottom' });
    } finally {
      setIsNameSearching(false);
    }
  };

  // 兼容旧版搜索（综合搜索）
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
      
      // 清空搜索结果
      setCodeSearchText('');
      setCodeSearchResults([]);
      setNameSearchText('');
      setNameSearchResults([]);
      
      await loadCachedFunds();
    } catch (error) {
      Toast.show({ content: '添加失败', position: 'bottom' });
    }
  };

  // 渲染代码搜索结果
  const renderCodeSearchResults = () => (
    <Card 
      title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SearchOutline />
        <span>代码搜索结果</span>
        <Tag color='primary'>{codeSearchResults.length}</Tag>
      </div>} 
      className="card"
      style={{ marginBottom: 12 }}
    >
      <List>
        {codeSearchResults.map((fund, index) => (
          <List.Item
            key={`code-search-${fund.code}-${index}`}
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
      
      {codeSearchResults.length === 0 && !isCodeSearching && codeSearchText.length >= 2 && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
          未找到匹配代码的基金
        </div>
      )}
    </Card>
  );

  // 渲染名称搜索结果
  const renderNameSearchResults = () => (
    <Card 
      title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SearchOutline />
        <span>名称搜索结果</span>
        <Tag color='primary'>{nameSearchResults.length}</Tag>
      </div>} 
      className="card"
      style={{ marginBottom: 12 }}
    >
      <List>
        {nameSearchResults.map((fund, index) => (
          <List.Item
            key={`name-search-${fund.code}-${index}`}
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
      
      {nameSearchResults.length === 0 && !isNameSearching && nameSearchText.length >= 2 && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
          未找到匹配名称的基金
        </div>
      )}
    </Card>
  );

  // 兼容旧版搜索结果
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

      {/* 双搜索栏 */}
      <Card className="card" style={{ marginBottom: 12 }}>
        {/* 代码搜索 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: '#333' }}>
            基金代码搜索
          </div>
          <SearchBar
            placeholder="输入基金代码（如：510300，至少2位）"
            value={codeSearchText}
            onChange={handleCodeSearch}
          />
          {isCodeSearching && (
            <div style={{ textAlign: 'center', padding: '8px' }}>
              <SpinLoading style={{ '--size': '20px' }} />
              <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>代码搜索中...</span>
            </div>
          )}
        </div>

        {/* 分割线 */}
        <div style={{ borderTop: '1px solid #f0f0f0', margin: '12px 0' }} />

        {/* 名称搜索 */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, color: '#333' }}>
            基金名称搜索
          </div>
          <SearchBar
            placeholder="输入基金名称（如：沪深300，至少2个字）"
            value={nameSearchText}
            onChange={handleNameSearch}
          />
          {isNameSearching && (
            <div style={{ textAlign: 'center', padding: '8px' }}>
              <SpinLoading style={{ '--size': '20px' }} />
              <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>名称搜索中...</span>
            </div>
          )}
        </div>
      </Card>

      {/* 代码搜索结果 */}
      {codeSearchResults.length > 0 && renderCodeSearchResults()}

      {/* 名称搜索结果 */}
      {nameSearchResults.length > 0 && renderNameSearchResults()}

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
