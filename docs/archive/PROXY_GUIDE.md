# 开发环境使用真实API指南

由于浏览器的CORS安全限制，开发环境需要启动代理服务器才能调用真实API。

## 快速开始

### 1. 启动代理服务器（新开终端窗口）

```bash
cd /Users/ztw/Documents/dev/MyFundSys
bash start-proxy.sh
```

首次运行会自动安装依赖，稍等片刻。

你会看到：
```
========================================
  CORS代理服务器已启动
========================================

代理地址: http://localhost:3001
...
```

**保持此窗口运行**，不要关闭。

### 2. 启动前端开发服务器（另一个终端窗口）

```bash
cd /Users/ztw/Documents/dev/MyFundSys/frontend
npm run dev
```

### 3. 正常使用

现在打开 http://localhost:5173/MyFundSys/ 即可正常使用真实API。

代理服务器会自动转发：
- 基金详情API → 东方财富真实数据
- 基金搜索API → 东方财富真实数据

## 验证代理是否工作

在基金详情页，打开浏览器开发者工具（F12），查看Console：

```
[API] Fetching: http://localhost:3001/api/eastmoney/FundMNewApi/...
```

看到类似日志说明代理正常工作。

## 常见问题

### 代理服务器启动失败

检查3001端口是否被占用：
```bash
lsof -i :3001
```

如果被占用，终止占用进程或修改proxy-server.js中的端口号。

### 前端还是显示模拟数据

检查：
1. 代理服务器是否正在运行
2. 浏览器Console是否有`[API]`开头的日志
3. 网络请求是否发送到`http://localhost:3001`

### 停止代理服务器

在代理服务器终端按 `Ctrl + C`

## 原理说明

```
浏览器 → http://localhost:3001/api/xxx 
    ↓
代理服务器(Node.js) 
    ↓
https://fundmobapi.eastmoney.com/api/xxx (真实API)
```

代理服务器添加CORS头，解决浏览器跨域限制。
