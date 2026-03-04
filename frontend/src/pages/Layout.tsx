import React, { useState, useEffect } from 'react';
import { TabBar, Button, Toast } from 'antd-mobile';
import {
  AppOutline,
  HistogramOutline,
  UnorderedListOutline,
  SetOutline,
  FileOutline,
} from 'antd-mobile-icons';
import Dashboard from './Dashboard';
import FundList from './FundList';
import Holdings from './Holdings';
import Transactions from './Transactions';
import Articles from './Articles';
import Strategy from './Strategy';
import Settings from './Settings';
import AuthPage from './AuthPage';
import { useCurrentUser, signOut } from '../hooks/useSupabase';
import { isSupabaseConfigured } from '../lib/supabase';
import './Layout.css';

const Layout: React.FC = () => {
  const [activeKey, setActiveKey] = useState('dashboard');
  const [showAuth, setShowAuth] = useState(false);
  const { user } = useCurrentUser();
  const isConfigured = isSupabaseConfigured();

  // 如果没有配置 Supabase，显示警告
  useEffect(() => {
    if (!isConfigured) {
      console.warn('Supabase not configured. Running in local-only mode.');
    }
  }, [isConfigured]);

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
      icon: <FileOutline />,
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
      icon: <SetOutline />,
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
    const { error } = await signOut();
    if (error) {
      Toast.show({ content: '退出失败', position: 'bottom' });
    } else {
      Toast.show({ content: '已退出登录', position: 'bottom' });
    }
  };

  // 如果显示认证页面
  if (showAuth) {
    return (
      <AuthPage onAuthSuccess={() => setShowAuth(false)} />
    );
  }

  return (
    <div className="layout-container">
      {/* 顶部用户状态栏 */}
      {isConfigured && (
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
          justifyContent: 'flex-end',
          padding: '0 16px',
          zIndex: 100,
        }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: '#666' }}>
                {(user as any)?.email}
              </span>
              <Button
                size="mini"
                onClick={handleLogout}
              >
                退出
              </Button>
            </div>
          ) : (
            <Button
              size="mini"
              color="primary"
              onClick={() => setShowAuth(true)}
            >
              登录/注册
            </Button>
          )}
        </div>
      )}

      <div 
        className="content" 
        style={{ 
          paddingTop: isConfigured ? 44 : 0,
          paddingBottom: 60,
        }}
      >
        {activeTab?.component}
      </div>

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
    </div>
  );
};

export default Layout;
