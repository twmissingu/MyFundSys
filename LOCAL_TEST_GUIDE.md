# MyFundSys 本地测试指南

## 环境要求

- Node.js 18+ 
- npm 或 yarn

## 安装步骤

### 1. 进入前端目录
```bash
cd /Users/ztw/Documents/dev/MyFundSys/frontend
```

### 2. 安装依赖
```bash
npm install
```

### 3. 配置环境变量
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
```bash
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

## 测试步骤

### 测试 1：密码登录
1. 打开页面后应看到密码输入界面
2. 输入密码：`888`
3. 点击"进入系统"
4. 验证：成功进入主界面

### 测试 2：功能验证
1. **基金列表** - 查看95只ETF基金是否正常显示
2. **添加交易** - 尝试添加买入/卖出记录
3. **持仓计算** - 验证持仓是否自动更新
4. **数据导出** - 测试导出JSON功能

### 测试 3：退出登录
1. 点击顶部"退出"按钮
2. 验证：返回密码登录页面
3. 再次输入密码可以重新进入

### 测试 4：会话保持
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
- 确认密码是 `888`（三个8）
- 检查大小写（密码区分大小写）
