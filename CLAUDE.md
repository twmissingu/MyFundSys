# MyFundSys — Claude 项目配置

## 项目概述

个人基金投资管理系统，移动端 Web 应用。

**技术栈**
- 前端: React 18 + TypeScript + Vite + Ant Design Mobile
- 本地存储: IndexedDB (Dexie.js v4)
- 云端: Supabase (PostgreSQL + Edge Functions)
- 部署: GitHub Pages (`npm run deploy` → gh-pages)
- API: 东方财富 (通过 Supabase Edge Functions 代理，解决 CORS)

**仓库**: https://github.com/twmissingu/MyFundSys
**生产地址**: https://twmissingu.github.io/MyFundSys/

---

## 关键文件地图

| 文件 | 作用 |
|------|------|
| `frontend/src/pages/Layout.tsx` | 主布局 + 底部 Tab 导航 |
| `frontend/src/db/index.ts` | IndexedDB schema (Dexie，v7) |
| `frontend/src/lib/supabase.ts` | Supabase 客户端 + isSupabaseConfigured() |
| `frontend/src/services/fundApi.ts` | 基金数据 API（核心，含搜索/净值/缓存） |
| `frontend/src/hooks/useSync.ts` | 双存储同步（Supabase 优先，降级 Local） |
| `frontend/src/hooks/useDB.ts` | IndexedDB 操作 hooks |
| `frontend/src/hooks/useSupabase.ts` | Supabase CRUD hooks |
| `frontend/src/types/index.ts` | 全局 TypeScript 类型 |
| `supabase/functions/fund-nav/index.ts` | Edge Function: 查询净值 |
| `supabase/functions/fund-search/index.ts` | Edge Function: 搜索基金 |
| `frontend/vite.config.ts` | 构建配置 + 开发代理 |
| `.github/workflows/update-valuation.yml` | 每 2 小时自动更新估值数据 |

---

## 架构核心约定（必须遵守）

### 1. 基金 API 调用链
```
前端 → supabase.functions.invoke(fnName, {body:{...}})
     → Supabase Edge Function（Deno，服务端）
     → 东方财富 API（无 CORS 限制）
```
- **invoke 使用 POST**，Edge Function 必须从 `req.json()` 的 body 读取参数，不能从 URL 路径或 query string 读
- 东方财富 API 必须使用移动端 UA：`EMProjJijin/8.4.6 (iPhone; iOS 16.0; Scale/3.00)` + `Referer: https://fund.eastmoney.com/`
- **不得**在前端直接 fetch 东方财富 API（CORS 拦截）

### 2. 双存储优先级
```
Supabase 可用 → 读写 Supabase，同步到 IndexedDB
Supabase 不可用 → 纯 IndexedDB 离线模式
```
- 使用 `isSupabaseConfigured()` 判断，不要硬编码环境检测
- **禁止** `if (isGitHubPages)` 这类环境绕过逻辑（已删除，勿再引入）

### 3. Supabase Key 格式
- 必须使用 **JWT 格式** anon key（以 `eyJ` 开头）
- 不能使用 `sb_publishable_` 格式（Edge Function Authorization 会 401）

### 4. Edge Function 部署
```bash
SUPABASE_ACCESS_TOKEN=<token> supabase functions deploy fund-nav --project-ref xeddgyxugpwmgwmeetme
SUPABASE_ACCESS_TOKEN=<token> supabase functions deploy fund-search --project-ref xeddgyxugpwmgwmeetme
```

---

## 开发环境

### 启动
```bash
cd frontend
npm install
npm run dev         # http://localhost:5173/
```

### 必需环境变量（frontend/.env）
```bash
VITE_SUPABASE_URL=https://xeddgyxugpwmgwmeetme.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...（JWT 格式）
VITE_APP_PASSWORD=你的密码
```

### 构建与部署
```bash
npm run build       # TypeScript 编译 + Vite 构建 → frontend/dist/
npm run deploy      # 推送到 gh-pages 分支（GitHub Pages）
```

### 数据库 Schema 变更
```bash
# 修改 supabase/migrations/ 下的 SQL 文件
# 在 Supabase Dashboard 手动执行，或配置 supabase db push
```

---

## 代码规范

**组件结构**
```typescript
// 1. imports: React → UI库 → services/hooks → types → CSS
// 2. interface Props { ... }
// 3. const Foo: React.FC<Props> = ({ ... }) => { ... }
// 4. export default Foo
```

**命名**
- 组件/页面: PascalCase（`FundDetail.tsx`）
- Hooks: `use` 前缀（`useSync.ts`）
- Service/工具: camelCase（`fundApi.ts`）
- CSS: 与组件同名（`FundDetail.css`）

**数据操作**
- 本地写入通过 `useDB.ts` hooks
- 云端写入通过 `useSupabase.ts` hooks
- 读操作优先走 `useSync.ts`（自动处理双存储）

**TypeScript**
- 严格模式，不用 `any`（除第三方 API 响应）
- Vite build 允许忽略 TS 错误（esbuild 层），但代码层尽量修复

---

## Supabase 数据库表

| 表 | 说明 |
|----|------|
| `holdings` | 持仓（fund_code UNIQUE） |
| `transactions` | 交易记录（buy/sell） |
| `favorite_funds` | 自选基金 |
| `fund_cache` | 搜索缓存 |

RLS 开启，策略为 ALLOW ALL（单用户模式，无 user_id 字段）。

---

## 决策分层

- **自主决策**: 代码风格、错误修复、明显的优化
- **快速咨询**: 技术选型、架构模式（超时自动决策）
- **重大决策**: 业务逻辑变更、数据结构调整（必须确认）

## 异常处理原则

- 遇到冲突时暂停等待指示
- 不确定的业务需求立即询问
- 技术实现问题可以自主解决

---

## 团队主线程模式

### 角色定义
- 产品经理: 业务需求主线程
- 技术负责人: 架构决策主线程
- 开发者: 实现细节主线程
- Claude: 高效工作线程

### 协作流程
1. 需求分析 → 产品经理主导
2. 技术设计 → 技术负责人主导
3. 具体实现 → 开发者主导
4. 代码生成 → Claude 辅助执行
