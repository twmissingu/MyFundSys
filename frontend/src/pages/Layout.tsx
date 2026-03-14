import React, { useState, useEffect } from 'react';
import { TabBar, Button, Toast, Badge } from 'antd-mobile';
import {
  AppOutline,
  HistogramOutline,
  UnorderedListOutline,
  SetOutline,
  FileOutline,
  PayCircleOutline,
  FlagOutline,
} from 'antd-mobile-icons';
import Dashboard from './Dashboard';
import FundList from './FundList';
import FundDetail from './FundDetail';
import Holdings from './Holdings';
import Transactions from './Transactions';
import Articles from './Articles';
import Strategy from './Strategy';
import Settings from './Settings';
import AuthPage from './AuthPage';
import { useSyncStatus } from '../hooks/useSync';
import { useAuthStatus, signOut } from '../hooks/useSupabase';
import { isSupabaseConfigured } from '../lib/supabase';
import './Layout.css';

const Layout: React.FC = () => {
  const [activeKey, setActiveKey] = useState('dashboard');
  const [currentView, setCurrentView] = useState<{ type: string; params?: any }>({ type: 'tab' });
  const { isAuthenticated, loading } = useAuthStatus();
  const { status: syncStatus } = useSyncStatus();
  const isConfigured = isSupabaseConfigured();

  // 监听 hash 变化
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      
      if (hash.startsWith('fund/')) {
        const fundCode = hash.replace('fund/', '');
        setCurrentView({ type: 'fundDetail', params: { fundCode } });
      } else if (hash === 'holdings' || hash.startsWith('holdings?')) {
        setActiveKey('holdings');
        setCurrentView({ type: 'tab' });
      } else if (hash === 'transactions' || hash.startsWith('transactions?')) {
        setActiveKey('transactions');
        setCurrentView({ type: 'tab' });
      } else if (hash === 'funds' || hash.startsWith('funds?')) {
        setActiveKey('funds');
        setCurrentView({ type: 'tab' });
      } else if (hash === 'articles' || hash.startsWith('articles?')) {
        setActiveKey('articles');
        setCurrentView({ type: 'tab' });
      } else {
        setCurrentView({ type: 'tab' });
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const tabs = [
    {
      key: 'dashboard',
      title: '首页',
      icon: <AppOutline />,
      component: <Dashboard />,
    },
    {
      key: 'funds',
      title: '基金',
      icon: <UnorderedListOutline />,
      component: <FundList />,
    },
    {
      key: 'holdings',
      title: '持仓',
      icon: <HistogramOutline />,
      component: <Holdings />,
    },
    {
      key: 'transactions',
      title: '交易',
      icon: <PayCircleOutline />,
      component: <Transactions />,
    },
    {
      key: 'articles',
      title: '文章',
      icon: <FileOutline />,
      component: <Articles />,
    },
    {
      key: 'strategy',
      title: '策略',
      icon: <FlagOutline />,
      component: <Strategy />,
    },
    {
      key: 'settings',
      title: '设置',
      icon: <SetOutline />,
      component: <Settings />,
    },
  ];

  const activeTab = tabs.find(tab => tab.key === activeKey);

  const handleLogout = async () => {
    await signOut();
    Toast.show({ content: '已退出登录', position: 'bottom' });
    window.location.reload();
  };

  // 渲染当前内容
  const renderContent = () => {
    if (currentView.type === 'fundDetail') {
      return <FundDetail />;
    }
    return activeTab?.component;
  };

  // 如果还在加载中，显示空白
  if (loading) {
    return <div className="layout-container" />;
  }

  // 如果未登录，显示登录页
  if (!isAuthenticated) {
    return <AuthPage onAuthSuccess={() => window.location.reload()} />;
  }

  return (
    <div className="layout-container">
      {/* 顶部状态栏 */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 44,
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isConfigured && (
            <>
              <Badge 
                color={syncStatus.isOnline ? '#52c41a' : '#faad14'} 
                content={syncStatus.isSyncing ? '同步中' : syncStatus.isOnline ? '在线' : '离线'}
              />
              {syncStatus.pendingChanges > 0 && (
                <Badge content={`${syncStatus.pendingChanges} 待同步`} style={{ background: '#fa8c16' }} />
              )}
            </>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#666' }}>
            已登录
          </span>
          <Button
            size="mini"
            onClick={handleLogout}
          >
            退出
          </Button>
        </div>
      </div>

      <div 
        className="content" 
        style={{ 
          paddingTop: 44,
          paddingBottom: currentView.type === 'tab' ? 60 : 0,
        }}
      >
        {renderContent()}
      </div>

      {currentView.type === 'tab' && (
        <TabBar
          activeKey={activeKey}
          onChange={setActiveKey}
          className="tab-bar"
          style={{ height: 60 }}
        >
          {tabs.map(tab => (
            <TabBar.Item key={tab.key} icon={tab.icon} title={tab.title} />
          ))}
        </TabBar>
      )}
    </div>
  );
};

export default Layout;
