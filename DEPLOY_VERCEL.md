# Vercel 部署指南

## 🚀 快速开始

### 1. 准备工作

- [Vercel 账号](https://vercel.com/signup)（可使用 GitHub 账号登录）
- [Upstash 账号](https://console.upstash.com/)（用于 Redis 数据库）

### 2. 配置 Upstash Redis

1. 登录 [Upstash Console](https://console.upstash.com/)
2. 创建新的 Redis 数据库
3. 选择区域（建议选择 `us-east-1` 或 `ap-southeast-1`）
4. 复制以下信息：
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### 3. 部署到 Vercel

#### 方式一：通过 Vercel CLI

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

#### 方式二：通过 GitHub 集成

1. 将代码推送到 GitHub
2. 登录 Vercel Dashboard
3. 点击 "Add New Project"
4. 导入 GitHub 仓库
5. 配置环境变量（见下方）
6. 点击 Deploy

### 4. 配置环境变量

在 Vercel Dashboard → Project Settings → Environment Variables 中添加：

```
APP_PASSWORD=your_secure_password
UPSTASH_REDIS_REST_URL=https://your-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
```

### 5. 验证部署

部署完成后，访问 Vercel 提供的域名：

- 前端页面：`https://your-project.vercel.app`
- API测试：`https://your-project.vercel.app/api/fund/000001`

## 📁 项目结构说明

```
MyFundSys/
├── frontend/          # React + Vite 前端
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── api/               # Vercel Edge Functions
│   ├── fund/[code].ts # 基金净值API
│   ├── search.ts      # 基金搜索API
│   ├── transactions.ts# 交易数据API
│   └── auth.ts        # 认证API
├── vercel.json        # Vercel配置
└── package.json       # 根package.json
```

## 🔧 本地开发

```bash
# 安装依赖
npm install
cd frontend && npm install

# 启动开发服务器
npm run dev

# 前端运行在 http://localhost:5173
# API 需要单独测试或使用 vercel dev
```

## 🧪 测试 API

```bash
# 测试基金净值
curl https://your-project.vercel.app/api/fund/000001

# 测试基金搜索
curl "https://your-project.vercel.app/api/search?keyword=沪深300"

# 测试认证
curl -X POST https://your-project.vercel.app/api/auth \
  -H "Content-Type: application/json" \
  -d '{"password":"your_password"}'
```

## 📝 注意事项

1. **免费额度**：
   - Vercel Hobby：每月 100GB 带宽，无限请求数
   - Upstash：每日 10,000 请求，足够个人使用

2. **数据持久化**：
   - 所有数据存储在 Upstash Redis
   - 跨设备访问时数据实时同步
   - 无需担心数据丢失

3. **CORS 问题**：
   - API 已配置 CORS 头，允许所有域名访问
   - 无需担心跨域限制

4. **安全性**：
   - 密码存储在 Vercel 环境变量
   - Redis Token 不会暴露给前端
   - 建议定期更换密码

## 🐛 故障排除

### API 返回 500 错误

检查 Vercel Functions Logs：
```
Vercel Dashboard → Project → Functions → Logs
```

### Redis 连接失败

1. 确认环境变量是否正确设置
2. 检查 Upstash Redis 是否正常运行
3. 确认 Redis Token 未过期

### 前端无法访问 API

1. 检查 `VITE_API_BASE_URL` 是否设置为 `/api`
2. 确认 vercel.json 路由配置正确
3. 检查浏览器控制台网络请求

## 📚 相关文档

- [Vercel 文档](https://vercel.com/docs)
- [Upstash 文档](https://docs.upstash.com/)
- [项目文档](./PROJECT_DOCUMENTATION.md)
- [开发指南](./DEVELOPMENT_GUIDE.md)

## 💰 费用说明

**完全免费！**

- Vercel Hobby：免费
- Upstash Redis：免费额度足够个人使用
- 东方财富 API：免费

如果数据量增长，可考虑：
- Vercel Pro：$20/月
- Upstash 付费版：$10/月起
