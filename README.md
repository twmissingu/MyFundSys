# MyFundSys - 基金投资管理系统

> 基于 E大（ETF拯救世界）投资理念的个人基金投资管理工具

**生产地址**: https://twmissingu.github.io/MyFundSys/

---

## 📋 项目概述

MyFundSys 是一个个人基金投资管理系统，帮助用户管理基金持仓、记录交易、分析投资收益。

### 核心功能

- 💼 **批次持仓管理** — 每笔买入独立追踪，精确计算盈亏
- 📝 **交易记录** — 完整的买入/卖出记录，支持在途交易（T+1 确认）
- 🎯 **落袋为安** — 已实现盈亏追踪，胜率统计
- ☁️ **云端存储** — Supabase 存储，支持多设备访问
- 📊 **市场估值** — 全市场 PE/PB，颜色分级显示
- 💾 **数据管理** — JSON/CSV 导入导出备份

### 持仓管理

- 按批次展示每笔买入，独立显示盈亏
- 在途买入自动展示，净值确认后自动更新
- 左滑卖出，支持 1/4、1/3、1/2、全部卖出
- 卖出按成本最低批次自动匹配

### 交易管理

- 添加交易时自动获取当日/下一交易日净值
- 非交易日自动匹配，在途交易自动处理
- 买入红色标识，卖出绿色标识
- 删除前检查是否已被部分卖出

---

## 🏗️ 技术栈

### 前端

| 技术 | 用途 |
|------|------|
| React 18 + TypeScript | 前端框架 |
| Vite | 构建工具 |
| Ant Design Mobile | UI 组件库 |
| Recharts | 图表库 |
| Vitest | 单元测试 |

### 后端

| 技术 | 用途 |
|------|------|
| Supabase (PostgreSQL) | 数据库 |
| Supabase Edge Functions (Deno) | API 代理 |

### Edge Functions

| 函数 | 功能 |
|------|------|
| `fund-nav` | 基金净值查询 |
| `fund-search` | 基金搜索（支持后端收费基金映射） |
| `fund-history` | 历史净值查询（支持精确日期） |

---

## 📁 项目结构

```
MyFundSys/
├── frontend/                       # 前端项目（主体）
│   ├── src/
│   │   ├── pages/                  # 页面组件
│   │   │   ├── Layout.tsx          # 主布局 + 底部 Tab 导航
│   │   │   ├── Dashboard.tsx       # 首页（估值 + 持仓概览）
│   │   │   ├── Holdings.tsx        # 持仓管理（批次展示）
│   │   │   ├── Transactions.tsx    # 交易记录
│   │   │   ├── FundList.tsx        # 基金搜索 + 自选
│   │   │   ├── FundDetail.tsx      # 基金详情（历史净值）
│   │   │   ├── Strategy.tsx        # 投资策略
│   │   │   └── Settings.tsx        # 设置页
│   │   ├── components/             # 可复用组件
│   │   │   ├── TotalAssetsCard.tsx # 总资产卡片
│   │   │   ├── FavoriteFunds.tsx   # 自选基金列表
│   │   │   ├── SparklineChart.tsx  # 迷你折线图
│   │   │   └── FundHistoryCard.tsx # 历史净值卡片
│   │   ├── services/               # API 服务层
│   │   │   ├── fundApi.ts          # 基金数据 API（核心）
│   │   │   └── navUpdateService.ts # 批次派生、卖出匹配、在途处理
│   │   ├── hooks/                  # 自定义 Hooks
│   │   │   ├── useSync.ts          # 数据访问 hooks（从交易派生持仓）
│   │   │   └── useSupabase.ts      # 认证相关 hooks
│   │   ├── db/
│   │   │   └── index.ts            # Supabase 数据操作
│   │   ├── lib/
│   │   │   └── supabase.ts         # Supabase 客户端初始化
│   │   ├── types/
│   │   │   ├── index.ts            # 全局 TypeScript 类型
│   │   │   └── database.ts         # Supabase 数据库类型
│   │   └── utils/
│   │       ├── index.ts            # 通用工具函数
│   │       ├── csv.ts              # CSV 导入导出
│   │       └── technicalIndicators.ts # 技术指标计算
│   ├── public/
│   │   └── valuation.json          # 市场估值数据（GitHub Actions 更新）
│   ├── vitest.config.ts            # Vitest 测试配置
│   └── package.json
├── supabase/
│   └── functions/                  # Supabase Edge Functions（Deno）
│       ├── fund-nav/               # 查询基金净值
│       ├── fund-search/            # 搜索基金
│       └── fund-history/           # 查询历史净值
├── docs/                           # 项目文档
└── .github/
    └── workflows/
        ├── update-valuation.yml    # 每 2 小时更新估值数据
        └── deploy-frontend.yml     # 部署前端到 GitHub Pages
```

---

## 🚀 快速开始

### 启动前端开发服务

```bash
cd frontend

# 1. 安装依赖
npm install

# 2. 配置环境变量（本地测试）
# 创建 frontend/.env.local，填入测试 Supabase 密钥

# 3. 启动开发服务器
npm run dev     # 访问 http://localhost:5173/
```

### 环境变量

```
frontend/.env          → 生产 Supabase
frontend/.env.local    → 测试 Supabase（本地优先使用，不提交）
```

Vite 自动优先读取 `.env.local`，本地开发连接测试环境，部署时自动使用生产配置。

```bash
# 必需环境变量
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...          # JWT 格式，以 eyJ 开头
VITE_APP_PASSWORD=your_login_password
```

> ⚠️ `VITE_SUPABASE_ANON_KEY` 必须使用 **JWT 格式**（以 `eyJ` 开头），不能使用 `sb_publishable_` 格式（Edge Function 调用会 401）。

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

**重要约定**:
- `supabase.functions.invoke` 使用 **POST** 方法，参数通过 `body` 传递
- Edge Function 必须从 `req.json()` 读取参数（不从 URL/query string）
- 东方财富 API 需使用移动端 UA: `EMProjJijin/8.4.6 (iPhone; iOS 16.0; Scale/3.00)`
- **禁止**在前端直接 fetch 东方财富 API（浏览器 CORS 拦截）

### 数据架构

```
Supabase → 唯一数据源
  ↓
前端从 transactions 派生持仓批次（Lot）
  ↓
批次 → 持仓明细 + 落袋为安（已实现盈亏）
```

- 使用 `isSupabaseConfigured()` 检查连接状态
- Supabase anon key 必须为 JWT 格式（以 `eyJ` 开头）

---

## 🗄️ 数据库表

| 表 | 说明 |
|----|------|
| `transactions` | 交易记录（buy/sell，pending/completed） |
| `holdings` | 持仓记录（兼容性保留，实际从 transactions 派生） |
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
SUPABASE_ACCESS_TOKEN=<token> supabase functions deploy fund-nav     --project-ref <project-ref>
SUPABASE_ACCESS_TOKEN=<token> supabase functions deploy fund-search  --project-ref <project-ref>
SUPABASE_ACCESS_TOKEN=<token> supabase functions deploy fund-history --project-ref <project-ref>
```

---

## 🧪 测试

测试框架: **Vitest** + Testing Library

```bash
cd frontend
npm test              # 运行所有测试
npx vitest run src/__tests__/services/fundApi.test.ts    # 单个文件
npx vitest run -t "test name"  # 按名称
```

### 测试覆盖范围

| 测试文件 | 覆盖内容 |
|----------|---------|
| `lotDerivation.test.ts` | 批次派生、已实现盈亏、持仓汇总、卖出匹配 |
| `fundApi.test.ts` | API 服务：搜索过滤逻辑、净值缓存、Edge Function 调用 |
| `useSync.test.ts` | 持仓计算：买入建仓、追加、卖出后均价/份额更新 |
| `transactionDateNav.test.tsx` | 交易日期与净值逻辑 |

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
- 组件/页面: PascalCase（`FundDetail.tsx`）
- Hooks: `use` 前缀（`useSync.ts`）
- Service/工具: camelCase（`fundApi.ts`）
- 测试: `*.test.ts` 或 `*.spec.ts`

**TypeScript**
- 严格模式，避免 `any`（第三方 API 响应除外）
- 类型定义集中于 `src/types/index.ts`

---

## 📚 文档

| 文档 | 说明 |
|------|------|
| [需求规格书](./docs/archive/SRS.md) | 完整功能需求与业务逻辑 |
| [Edge Functions API](./docs/EDGE_FUNCTIONS_API.md) | Edge Functions 接口文档 |
| [代码审查问题](./docs/CODE_REVIEW_ISSUES_20260406.md) | 代码审查发现的问题与修复计划 |
| [Session 总结](./docs/archive/SESSION_SUMMARY_20260406.md) | 架构重构与持仓批次管理改动总结 |

---

## 🔒 安全说明

- 密码以环境变量形式注入，不提交到 Git
- Supabase 服务使用 anon key（公开），依赖 RLS 策略保护数据
- API 调用全部通过服务端 Edge Function 代理（无需暴露私钥）

---

## 📄 许可证

MIT License

## 🙏 致谢

- [ETF拯救世界](https://xueqiu.com/4771730473) - 投资理念启发
- [Supabase](https://supabase.com) - 开源后端服务

---

**免责声明**: 本系统仅供个人投资管理使用，不构成投资建议。投资有风险，入市需谨慎。
