#!/usr/bin/env node
/**
 * 简易CORS代理服务器 - 无需额外依赖
 * 使用 Node.js 内置 http 模块
 * 开发环境专用：忽略SSL证书验证
 */

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3001;

// 忽略 SSL 证书错误（仅开发环境使用）
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// 目标API配置
const PROXY_TARGETS = {
  '/api/eastmoney': {
    hostname: 'fundmobapi.eastmoney.com',
    port: 443,
    protocol: 'https:',
  },
  '/api/suggest': {
    hostname: 'searchapi.eastmoney.com',
    port: 443,
    protocol: 'https:',
  },
  '/api/qieman': {
    hostname: 'qieman.com',
    port: 443,
    protocol: 'https:',
  },
  '/api/history': {
    hostname: 'api.fund.eastmoney.com',
    port: 443,
    protocol: 'https:',
    needReferer: true,
  },
};

const server = http.createServer((req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // 查找匹配的目标
  let target = null;
  let targetPath = req.url;
  let needReferer = false;
  
  for (const [prefix, config] of Object.entries(PROXY_TARGETS)) {
    if (req.url.startsWith(prefix)) {
      target = config;
      targetPath = req.url.substring(prefix.length);
      needReferer = config.needReferer || false;
      break;
    }
  }
  
  if (!target) {
    // 返回健康检查信息
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        message: 'CORS代理服务器运行中',
        endpoints: Object.keys(PROXY_TARGETS),
      }));
      return;
    }
    
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
    return;
  }
  
  // 构建请求头（只保留必要的）
  const headers = {
    'host': target.hostname,
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh;q=0.9',
  };
  
  // 历史净值API需要Referer
  if (needReferer) {
    headers['Referer'] = 'https://fundf10.eastmoney.com/';
  }
  
  // 转发请求
  const options = {
    hostname: target.hostname,
    port: target.port,
    path: targetPath,
    method: req.method,
    headers,
    // 忽略SSL证书验证
    rejectUnauthorized: false,
  };
  
  console.log(`[Proxy] ${req.url} -> ${target.protocol}//${target.hostname}${targetPath}`);
  
  const proxyReq = https.request(options, (proxyRes) => {
    console.log(`[Proxy] 响应: ${proxyRes.statusCode}`);
    
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });
  
  proxyReq.on('error', (err) => {
    console.error('[Proxy] 错误:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });
  
  req.pipe(proxyReq, { end: true });
});

server.listen(PORT, () => {
  console.log(`
========================================
  CORS代理服务器已启动（简化版）
========================================

代理地址: http://localhost:${PORT}

可用端点:
  - http://localhost:${PORT}/api/eastmoney/... -> fundmobapi.eastmoney.com
  - http://localhost:${PORT}/api/suggest/... -> searchapi.eastmoney.com
  - http://localhost:${PORT}/api/qieman/... -> qieman.com
  - http://localhost:${PORT}/api/history/... -> api.fund.eastmoney.com (历史净值)

使用方式:
  1. 保持此窗口运行
  2. 启动前端: npm run dev
  3. 访问 http://localhost:5173/MyFundSys/

按 Ctrl+C 停止服务器
========================================
  `);
});
