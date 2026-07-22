[![English](https://img.shields.io/badge/English-blue.svg)](README.md)
[![中文](https://img.shields.io/badge/中文-red.svg)](README_zh.md)

---

# MyFundSys — 基金投资管理系统

**批次级基金持仓 + 驾驶舱 + 净值自动确认 + 网格交易** — 每笔买入独立建仓，卖出按最低成本匹配，在途交易自动确认，网格策略一键执行并追溯全链路。

[在线体验](https://twmissingu.github.io/MyFundSys/) · [系统架构](#系统架构) · [快速开始](#快速开始)

## 为什么做这个？

大多数基金记账工具只显示单只基金的平均成本。MyFundSys 把**每笔买入当作独立批次**追踪，你能清楚看到哪些批次盈利、哪些浮亏、卖出时的真实已实现盈亏。在途交易（T+1 结算）无需手动填净值——系统自动确认。

## 核心功能

- **投资组合驾驶舱** — Dashboard 重构，行动卡片（网格触发/在途交易/告警/估值信号）、风险仪表盘（仓位/集中度/估值）
- **批次持仓管理** — 每笔买入独立追踪，精确计算浮动/已实现盈亏
- **交易全链路追溯** — FundDetail 新增"交易批次"Tab，按买入批次可视化展示卖出记录和浮盈
- **智能卖出匹配** — 按批次卖出时精确扣减指定批次；否则按网格执行匹配，再按成本最低优先
- **在途交易自动确认** — T+1 交易净值发布后自动结算；失败时告警并支持手动输入净值
- **落袋为安** — 已实现盈亏追踪，胜率、持有天数、累计收益统计
- **云端同步** — Supabase PostgreSQL，手机/电脑多设备同步
- **市场估值** — PE/PB 估值温度计，每 2 小时自动更新
- **基金搜索与详情** — 按代码/名称搜索，历史净值走势图（MACD/KDJ/MA5/10/20 技术指标）
- 🎯 **网格交易策略** — 小/中/大网参数配置、阶梯图展示、自动检测触发、一键执行
- 📤 **CSV/JSON 导入导出** — 完整数据备份和批量操作
- **移动端优先** — 响应式设计，Ant Design Mobile 组件库

## 系统架构

```
前端（React 18 + TypeScript）
  → supabase.functions.invoke('fund-nav', { body: { code } })
    → Supabase Edge Function（Deno 服务端）
      → 东方财富 API（模拟移动端 UA，无 CORS 限制）
```

**核心设计决策：**
- **Supabase 是唯一数据源** — 持仓从交易记录派生，不单独存储
- **批次派生**（`navUpdateService.ts`）— `deriveLots()` 从买卖交易构建批次
- **卖出匹配** — 最低成本优先（非 FIFO），`matchSellLots()` 实现
- **Hash 路由** — 无 react-router，Layout.tsx 底部 TabBar 6 个标签页

## 快速开始

### 前置条件

- Node.js >= 18
- [Supabase](https://supabase.com) 项目（免费版即可）

### 安装与运行

```bash
git clone https://github.com/twmissingu/MyFundSys.git
cd MyFundSys/frontend
npm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入你的 Supabase 凭据

npm run dev     # http://localhost:5173/
```

### 环境变量

```bash
# frontend/.env.local（不提交）
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...          # 必须是 JWT 格式，以 eyJ 开头
VITE_APP_PASSWORD=your_login_password
```

> **重要**：`VITE_SUPABASE_ANON_KEY` 必须使用 JWT 格式（以 `eyJ` 开头）。`sb_publishable_` 格式会导致 Edge Function 调用 401。

### 部署 Edge Functions

```bash
supabase functions deploy fund-nav     --project-ref <your-ref>
supabase functions deploy fund-search  --project-ref <your-ref>
supabase functions deploy fund-history --project-ref <your-ref>
```

## AI Agent 指南

本项目为 AI agent 交互优化：

```bash
# 1. 克隆并安装
git clone https://github.com/twmissingu/MyFundSys.git
cd MyFundSys/frontend
npm install

# 2. 配置（复制 .env.example → .env.local，填入 Supabase 凭据）
cp .env.example .env.local

# 3. 运行测试
npm test                    # 520 个测试（Web），Vitest 框架
npm run test:e2e            # Playwright E2E 测试

# 4. 构建
npm run build               # TypeScript 编译 + Vite 构建 → dist/

# 5. 部署
npm run deploy              # 推送到 gh-pages 分支
```

**Agent 关键文件：**
| 文件 | 用途 |
|------|------|
| `CLAUDE.md` | 完整项目指南、架构、约定 |
| `src/services/navUpdateService.ts` | 核心业务逻辑：批次派生、卖出匹配、在途处理 |
| `src/services/fundApi.ts` | 基金数据 API（净值/市场/缓存） |
| `src/services/lotTraceService.ts` | 按批次分组交易生命周期，用于追溯视图 |
| `src/services/alertService.ts` | 净值告警 CRUD（nav_date_mismatch / no_nav_data / api_error） |
| `src/services/gridService.ts` | 网格策略 CRUD、执行、状态推导 |
| `src/hooks/useSync.ts` | 数据访问 hooks（从交易派生持仓） |
| `src/hooks/useRiskMetrics.ts` | 组合风险聚合（资产/仓位/集中度/估值信号） |
| `src/hooks/useGrid.ts` | 网格策略 hooks（执行、清仓） |

## 测试

```bash
npm test                            # 运行所有测试
npm run test:watch                  # 监听模式
npx vitest run src/__tests__/services/fundApi.test.ts   # 单个文件
npm run test:e2e                    # Playwright E2E
```

**框架**：Vitest 4 + @testing-library/react — **520 个测试（Web），20 个测试文件**

## Android 客户端

React Native (Expo) 客户端位于 `android-app/`，与 Web 端共享同一 Supabase 数据库和 Edge Functions:

```bash
cd android-app
# 在 app.json → extra 中填入 Supabase 凭据
npx expo start
```

## 数据库表

| 表 | 说明 |
|----|------|
| `transactions` | 交易记录（buy/sell，pending/completed）— **主表** |
| `holdings` | 持仓记录（兼容性保留，实际从 transactions 派生） |
| `favorite_funds` | 自选基金 |
| `fund_cache` | 搜索缓存 |
| `grid_strategies` | 网格交易策略配置 |
| `grid_executions` | 网格交易执行记录 |
| `pending_alerts` | 在途交易净值匹配异常告警 |

RLS 已启用，策略为 ALLOW ALL（单用户模式）。

## 贡献

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feat/my-feature`）
3. 先写测试（推荐 TDD）
4. 使用约定式提交（`feat:`、`fix:`、`refactor:`）
5. 提交 PR

## 许可证

[MIT](LICENSE)

---

**免责声明**：本系统仅供个人投资管理使用，不构成投资建议。投资有风险，入市需谨慎。
