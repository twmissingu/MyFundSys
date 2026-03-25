# MyFundSys Supabase 部署指南

## 🎯 架构概述

```
Supabase Platform (单一平台)
├── Frontend Hosting (React + Vite)
├── Edge Functions (基金API代理)
└── PostgreSQL (数据持久化)
```

## 📋 部署步骤

### 1. 创建 Supabase 项目

1. 访问 [Supabase Dashboard](https://app.supabase.com)
2. 点击 "New Project"
3. 填写项目名称：MyFundSys
4. 选择地区（建议选择靠近用户的地区）
5. 等待项目创建完成（约 2-3 分钟）

### 2. 配置数据库

1. 进入项目 Dashboard
2. 点击左侧 "SQL Editor"
3. 新建查询，粘贴 `supabase/migrations/001_initial_schema.sql` 内容
4. 点击 "Run" 执行

### 3. 部署 Edge Functions

#### 安装 Supabase CLI

```bash
npm install -g supabase
```

#### 登录 Supabase

```bash
supabase login
```

#### 初始化项目

```bash
cd /Users/twzhan/Documents/dev/MyFundSys
supabase init
```

#### 链接远程项目

```bash
supabase link --project-ref your-project-ref
```

#### 部署 Edge Functions

```bash
# 部署基金净值查询
supabase functions deploy fund-nav

# 部署基金搜索
supabase functions deploy fund-search
```

### 4. 配置前端环境变量

1. 复制环境变量文件

```bash
cd frontend
cp .env.example .env
```

2. 编辑 `.env` 文件，填入 Supabase 配置：

```bash
# 从 Supabase Project Settings → API 获取
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# 设置登录密码
VITE_APP_PASSWORD=888
```

### 5. 构建前端

```bash
cd frontend
npm install
npm run build
```

### 6. 部署前端到 Supabase Hosting

```bash
# 使用 Supabase CLI 部署
supabase hosting publish

# 或者手动上传 dist 文件夹到 Supabase Storage
```

## 🔧 配置说明

### Edge Functions 配置

Edge Functions 已配置 CORS 头，允许 GitHub Pages 或其他域名访问：

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```

### 数据库安全

- 启用了 Row Level Security (RLS)
- 单用户模式：允许所有访问（个人使用）
- 如需多用户，请修改 RLS 策略

### 环境变量

| 变量名 | 说明 | 获取方式 |
|--------|------|----------|
| VITE_SUPABASE_URL | Supabase 项目 URL | Project Settings → API |
| VITE_SUPABASE_ANON_KEY | Supabase anon key | Project Settings → API |
| VITE_APP_PASSWORD | 登录密码 | 自定义 |

## 🧪 测试部署

### 测试 Edge Functions

```bash
# 测试基金搜索
curl "https://your-project-ref.supabase.co/functions/v1/fund-search?keyword=000001"

# 测试基金净值
curl "https://your-project-ref.supabase.co/functions/v1/fund-nav/000001"
```

### 测试数据库

在 Supabase Dashboard → Table Editor 中查看数据表。

## 🚀 生产环境优化

### 1. 启用缓存

在 Edge Functions 中添加缓存头：

```typescript
const cacheHeaders = {
  'Cache-Control': 'public, max-age=60', // 缓存 60 秒
};
```

### 2. 监控和日志

- 在 Supabase Dashboard → Functions 中查看调用日志
- 在 Database → Logs 中查看数据库日志

### 3. 备份策略

- Supabase 自动每日备份
- 可在 Settings → Database 中配置备份保留期

## 📱 访问应用

部署完成后，应用可通过以下地址访问：

- **Supabase Hosting**: `https://your-project-ref.supabase.co`
- **自定义域名**: 在 Settings → Hosting 中配置

## 🔒 安全建议

1. **定期轮换 API Key**
2. **监控异常访问**
3. **启用数据库备份**
4. **使用强密码**

## 🆘 故障排除

### Edge Function 返回 500

检查 Supabase Dashboard → Functions → Logs 查看错误信息。

### 数据库连接失败

确认 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 配置正确。

### CORS 错误

Edge Functions 已配置 CORS，如仍有问题，检查请求来源域名。

## 📚 相关文档

- [Supabase 文档](https://supabase.com/docs)
- [Edge Functions 文档](https://supabase.com/docs/guides/functions)
- [项目文档](./PROJECT_DOCUMENTATION.md)
- [开发指南](./DEVELOPMENT_GUIDE.md)
