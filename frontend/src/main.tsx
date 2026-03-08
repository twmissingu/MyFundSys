import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd-mobile';
import zhCN from 'antd-mobile/es/locales/zh-CN';
import Layout from './pages/Layout';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN}>
      <Layout />
    </ConfigProvider>
  </React.StrictMode>,
);
// Force rebuild at 2026年 3月 8日 星期日 17时13分05秒 CST
