# MyFundSys 项目文档

## 📋 项目概述

MyFundSys 是一个个人基金投资管理系统，帮助用户管理基金持仓、记录交易、分析投资收益，并提供投资知识库（E大文章）。

**生产地址**：https://twmissingu.github.io/MyFundSys/

### 技术栈

- **前端**：React 18 + TypeScript + Vite + Ant Design Mobile 5
- **本地存储**：IndexedDB（Dexie.js v4）
- **云端存储**：Supabase（PostgreSQL + RLS）
- **API 代理**：Supabase Edge Functions（Deno，解决 CORS 限制）
- **部署**：GitHub Pages（静态前端）

---

## 🎯 功能需求与实现状态

### ✅ 已实现功能

1. **基金持仓管理**
   - 添加 / 删除持仓
   - 实时查看持仓市值和收益（含总资产统计）
   - 资产配置分析（饼图 + 市场分布）

2. **交易记录**
   - 记录买入 / 卖出交易
   - 支持在途交易（T+1 确认）
   - 交易历史查询

3. **基金查询**
   - 按代码 / 名称搜索基金（通过 Supabase Edge Function 代理东方财富 API）
   - 实时净值查询
   - 基金收藏（自选基金）+ 迷你图表

4. **投资分析**
   - 市场估值参考（PE/PB/百分位，由 GitHub Actions 每 2 小时更新）
   - 持仓分析与盈亏统计

5. **知识库**
   - E大投资文章展示

6. **数据管理**
   - 本地 IndexedDB 存储
   - Supabase 云端同步
   - 数据导入 / 导出（JSON）

### 🔧 已实现但暂未全面集成的功能

- **飞书通知**（`feishuService.ts`）：日报 / 大幅波动推送
- **定时任务**（`schedulerService.ts`）：自动抓取净值等
- **回测系统**（`backtest.ts`）：策略回测计算

---

## 🏗️ 系统架构

### API 调用链

```
前端（React）
  │
  └─ supabase.functions.invoke(fnName, { body: {...} })
       │
       └─ Supabase Edge Function（Deno 运行时，服务端）
            │
            └─ 东方财富 API（无 CORS 限制）
```

**重要约定**：
- `supabase.functions.invoke` 使用 **POST** 方法，参数通过 `body` 传递
- Edge Function 必须从 `req.json()` 读取参数（不从 URL/query string）
- 东方财富 API 需使用移动端 UA：`EMProjJijin/8.4.6 (iPhone; iOS 16.0; Scale/3.00)`
- **禁止**在前端直接 fetch 东方财富 API（浏览器 CORS 拦截）

### 双存储架构

```
Supabase 可用 → 读写 Supabase，同步到 IndexedDB（离线备份）
Supabase 不可用 → 纯 IndexedDB 离线模式
```

判断方式：`isSupabaseConfigured()`（位于 `src/lib/supabase.ts`）

---

## 📁 项目结构

```
MyFundSys/
├── frontend/                       # 前端项目（主体）
│   ├── src/
│   │   ├── pages/                  # 页面组件
│   │   │   ├── Layout.tsx          # 主布局 + 底部 Tab 导航
│   │   │   ├── Dashboard.tsx       # 首页（估值 + 持仓概览）
│   │   │   ├── Holdings.tsx        # 持仓管理
│   │   │   ├── Transactions.tsx    # 交易记录
│   │   │   ├── FundList.tsx        # 基金搜索 + 自选
│   │   │   ├── FundDetail.tsx      # 基金详情（历史净值）
│   │   │   ├── Reports.tsx         # 投资报告
│   │   │   ├── Articles.tsx        # E大文章知识库
│   │   │   ├── Strategy.tsx        # 投资策略
│   │   │   └── Settings.tsx        # 设置页
│   │   ├── components/             # 可复用组件
│   │   │   ├── FavoriteFunds.tsx   # 自选基金列表（含迷你图）
│   │   │   ├── SparklineChart.tsx  # 迷你折线图
│   │   │   └── FundHistoryCard.tsx # 历史净值卡片
│   │   ├── services/               # API 服务层
│   │   │   ├── fundApi.ts          # 基金数据 API（核心）
│   │   │   ├── syncService.ts      # Supabase 数据同步
│   │   │   ├── articleService.ts   # 文章服务
│   │   │   ├── feishuService.ts    # 飞书通知（待集成）
│   │   │   ├── schedulerService.ts # 定时任务（待集成）
│   │   │   └── backtest.ts         # 回测计算（待集成）
│   │   ├── hooks/                  # 自定义 Hooks
│   │   │   ├── useSync.ts          # 双存储同步 Hooks
│   │   │   ├── useDB.ts            # IndexedDB 操作 Hooks
│   │   │   └── useSupabase.ts      # Supabase CRUD Hooks
│   │   ├── db/
│   │   │   └── index.ts            # IndexedDB schema（Dexie v7）
│   │   ├── lib/
│   │   │   └── supabase.ts         # Supabase 客户端初始化
│   │   ├── types/
│   │   │   ├── index.ts            # 全局 TypeScript 类型
│   │   │   ├── database.ts         # Supabase 数据库类型
│   │   │   └── supabase.ts         # Supabase 生成类型
│   │   └── utils/
│   │       ├── index.ts            # 通用工具函数
│   │       ├── csv.ts              # CSV 导出
│   │       └── technicalIndicators.ts # 技术指标计算
│   ├── public/
│   │   └── valuation.json          # 市场估值数据（GitHub Actions 更新）
│   ├── vite.config.ts              # Vite 构建配置
│   ├── vitest.config.ts            # Vitest 测试配置
│   └── package.json
├── supabase/
│   └── functions/                  # Supabase Edge Functions（Deno）
│       ├── fund-nav/               # 查询基金净值
│       ├── fund-search/            # 搜索基金
│       └── fund-history/           # 查询历史净值
├── data/                           # E大文章数据
│   └── articles/
└── .github/
    └── workflows/
        ├── update-valuation.yml    # 每 2 小时更新估值数据
        └── deploy-frontend.yml     # 部署前端到 GitHub Pages
```

---

## 🔧 开发环境配置

### 启动前端开发服务

```bash
cd frontend
npm install
npm run dev     # 访问 http://localhost:5173/
```

### 必需环境变量（`frontend/.env`）

```bash
# Supabase 配置（必须使用 JWT 格式的 anon key，以 eyJ 开头）
VITE_SUPABASE_URL=https://xeddgyxugpwmgwmeetme.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...

# 登录密码
VITE_APP_PASSWORD=your_password
```

> ⚠️ `VITE_SUPABASE_ANON_KEY` 必须使用 **JWT 格式**（以 `eyJ` 开头），不能使用 `sb_publishable_` 格式（Edge Function 调用会 401）。

---

## 🗄️ Supabase 数据库表

| 表 | 说明 |
|----|------|
| `holdings` | 持仓记录（`fund_code` UNIQUE） |
| `transactions` | 交易记录（`buy`/`sell`） |
| `favorite_funds` | 自选基金 |
| `fund_cache` | 基金搜索缓存 |

RLS 已启用，策略为 ALLOW ALL（单用户模式，无 `user_id` 字段）。

---

## 📦 部署

### 前端（GitHub Pages）

```bash
cd frontend
npm run build   # 构建到 frontend/dist/
npm run deploy  # 推送到 gh-pages 分支
```

### Supabase Edge Functions 部署

```bash
SUPABASE_ACCESS_TOKEN=<token> supabase functions deploy fund-nav     --project-ref xeddgyxugpwmgwmeetme
SUPABASE_ACCESS_TOKEN=<token> supabase functions deploy fund-search  --project-ref xeddgyxugpwmgwmeetme
SUPABASE_ACCESS_TOKEN=<token> supabase functions deploy fund-history --project-ref xeddgyxugpwmgwmeetme
```

---

## 🧪 测试

测试框架：**Vitest** + Testing Library

```bash
cd frontend
npm test              # 运行所有测试（一次性）
npm run test:watch    # 监听模式（开发时使用）
npm run test:coverage # 生成覆盖率报告
```

### 测试覆盖范围

| 文件 | 测试内容 |
|------|---------|
| `src/__tests__/utils/index.test.ts` | 工具函数：`formatMoney`、`formatPercent`、`getValuationStatus`、`calculateMA`、`calculateStdDev` |
| `src/__tests__/services/fundApi.test.ts` | API 服务：搜索过滤逻辑、净值缓存、Edge Function 调用 |
| `src/__tests__/hooks/useSync.test.ts` | 持仓计算：买入建仓、追加、卖出后均价 / 份额更新 |

---

## 📝 代码规范

**组件结构**
```typescript
// 1. imports: React → UI 库 → services/hooks → types → CSS
// 2. interface Props { ... }
// 3. const Foo: React.FC<Props> = ({ ... }) => { ... }
// 4. export default Foo
```

**命名约定**
- 组件 / 页面：PascalCase（`FundDetail.tsx`）
- Hooks：`use` 前缀（`useSync.ts`）
- Service / 工具：camelCase（`fundApi.ts`）
- CSS：与组件同名（`FundDetail.css`）

**TypeScript**
- 严格模式，避免 `any`（第三方 API 响应除外）
- 类型定义集中于 `src/types/index.ts`

---

## 🔒 安全说明

- 密码以环境变量形式注入，不提交到 Git
- Supabase 服务使用 anon key（公开），依赖 RLS 策略保护数据
- API 调用全部通过服务端 Edge Function 代理（无需暴露私钥）
