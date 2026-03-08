#!/usr/bin/env node
/**
 * 简易CORS代理服务器
 * 用于开发环境转发API请求
 * 
 * 使用方法:
 * 1. 安装依赖: npm install express cors http-proxy-middleware
 * 2. 启动: node proxy-server.js
 * 3. 修改前端代码使用 http://localhost:3001/api/xxx
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = 3001;

// 启用CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 代理日志
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 东方财富基金API代理
app.use('/api/eastmoney', createProxyMiddleware({
  target: 'https://fundmobapi.eastmoney.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/eastmoney': ''
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log('[Proxy] EastMoney:', req.url);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log('[Proxy] EastMoney 响应:', proxyRes.statusCode);
  },
  onError: (err, req, res) => {
    console.error('[Proxy] EastMoney 错误:', err.message);
  }
}));

// 东方财富搜索API代理
app.use('/api/suggest', createProxyMiddleware({
  target: 'https://searchapi.eastmoney.com',
  changeOrigin: true,
  pathRewrite: {
    '^/api/suggest': ''
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log('[Proxy] Search:', req.url);
  }
}));

// 健康检查
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'CORS代理服务器运行中',
    endpoints: [
      '/api/eastmoney - 东方财富基金API',
      '/api/suggest - 东方财富搜索API'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`
========================================
  CORS代理服务器已启动
========================================

代理地址: http://localhost:${PORT}

可用端点:
  - http://localhost:${PORT}/api/eastmoney/FundMNewApi/...
  - http://localhost:${PORT}/api/suggest/api/suggest/...

使用方式:
  1. 保持此窗口运行
  2. 修改前端代码baseURL为: http://localhost:${PORT}
  3. 正常开发即可

按 Ctrl+C 停止服务器
========================================
  `);
});

