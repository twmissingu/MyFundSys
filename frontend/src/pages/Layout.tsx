import React, { useState, useEffect } from 'react';
import { TabBar } from 'antd-mobile';
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
import './Layout.css';

const Layout: React.FC = () => {
  const [activeKey, setActiveKey] = useState('dashboard');

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

  return (
    <div className="layout-container">
      <div className="content">
        {activeTab?.component}
      </div>
      <TabBar
        activeKey={activeKey}
        onChange={setActiveKey}
        className="tab-bar"
      >
        {tabs.map(tab => (
          <TabBar.Item key={tab.key} icon={tab.icon} title={tab.title} />
        ))}
      </TabBar>
    </div>
  );
};

export default Layout;
