# MyFundSys 本地测试指南

## 环境要求

- Node.js 18+ 
- npm 或 yarn

## 快速启动（推荐）

### 一键启动
```bash
./start-dev.sh
```
此脚本会自动启动 CORS 代理服务器和前端开发服务器。

## 手动安装步骤

### 1. 进入前端目录
```bash
cd /Users/ztw/Documents/dev/MyFundSys/frontend
```

### 2. 安装依赖
```bash
npm install
```

### 3. 配置环境变量（可选）
```bash
cp .env.example .env
```

编辑 `.env` 文件，填入您的 Supabase 凭证：
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

> 如果您没有 Supabase 账号，可以先不配置，系统会运行在本地模式（IndexedDB存储）

### 4. 启动开发服务器

**需要先启动 CORS 代理服务器（用于访问真实基金API）：**
```bash
# 在项目根目录执行
node proxy-simple.js
```

**然后启动前端：**
```bash
cd frontend
npm run dev
```

### 5. 访问页面
打开浏览器访问：
```
http://localhost:5173/MyFundSys/
```
或
```
http://localhost:5173/
```

## 开发环境架构

```
浏览器 (localhost:5173)
    ↓ API请求
CORS代理服务器 (localhost:3001)
    ↓ 转发请求
东方财富API (fundmobapi.eastmoney.com)
```

### 为什么需要代理服务器？

由于浏览器的安全策略（CORS），前端无法直接访问第三方 API。代理服务器的作用：
1. 接收前端请求
2. 添加 CORS 头允许跨域
3. 转发到东方财富 API
4. 返回结果给前端

### 测试代理服务器

```bash
# 检查代理状态
curl http://localhost:3001/

# 测试基金API
curl "http://localhost:3001/api/eastmoney/FundMNewApi/FundMNFInfo?pageIndex=1&pageSize=500&appType=ttjj&plat=Android&product=EFund&Version=1&deviceid=4252d0ac69bb50&Fcodes=510300"
```

## 测试步骤

### 测试 1：密码登录
1. 打开页面后应看到密码输入界面
2. 输入密码（使用你在环境变量中设置的密码）
3. 点击"进入系统"
4. 验证：成功进入主界面

### 测试 2：基金搜索
1. 在搜索框输入基金代码（如 `510300`）
2. 应显示搜索结果
3. 点击基金可查看详情
4. 验证：净值、涨跌幅数据为真实数据

### 测试 3：添加交易
1. 尝试添加买入/卖出记录
2. 验证持仓是否自动更新

### 测试 4：数据导出
1. 测试导出JSON功能

### 测试 5：退出登录
1. 点击顶部"退出"按钮
2. 验证：返回密码登录页面
3. 再次输入密码可以重新进入

### 测试 6：会话保持
1. 登录后刷新页面
2. 验证：保持登录状态，不需要重新输入密码
3. 清除浏览器缓存后应需要重新登录

## 生产构建测试

```bash
npm run build
```

构建成功后，会在 `dist` 目录生成静态文件。

## 常见问题

### 问题 1：端口被占用
如果 5173 端口被占用，Vite 会自动使用其他端口，注意控制台输出的实际地址。

### 问题 2：Supabase 连接失败
- 检查 `.env` 文件配置是否正确
- 检查网络连接
- 不配置时系统会自动使用本地 IndexedDB 模式

### 问题 3：密码错误
- 确认密码正确（注意大小写）
- 检查 `.env` 文件中的 `VITE_APP_PASSWORD` 设置

### 问题 4：代理服务器启动失败
- 检查 3001 端口是否被占用：`lsof -i :3001`
- 查看日志：`tail -f /tmp/proxy.log`
- 手动启动：`node proxy-simple.js`

### 问题 5：基金API返回空数据
- 检查代理服务器是否运行：`curl http://localhost:3001/`
- 检查网络连接
- 查看浏览器开发者工具 Network 标签页
