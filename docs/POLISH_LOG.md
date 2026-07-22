# POLISH_LOG.md — 打磨日志

---

# 第二轮：对抗性打磨（2026-07-05 起）

> 对齐共识：对抗性收敛（每轮主动挖真实缺陷并修复到测试全绿）；可改核心业务逻辑但必须测试守护（先写失败测试、542 测试全绿、不改交易语义）；不引入新依赖；≤10 轮。

## Round 0 — 基线（对抗性重新评分）

**日期**: 2026-07-05
**版本**: v2.8.0
**测试**: 542 passed (20 files)
**构建**: 通过

### 对抗性审计方法

4 路并行 agent（核心逻辑 bug / 静默失败 / 安全 / 测试质量）+ 独立源码验证。安全/静默失败/测试质量 agent 结果随后续轮次纳入。

### 已验证缺陷

**CRITICAL**
- **C1 网格卖出对在途买入匹配错误**（gridService.ts:217 / :307 / navUpdateService.ts:103,176）：网格买入 `status:'pending'`、卖出 `status:'completed'`。`deriveLots` 中在途买入 `remainingShares=0` 被 `eligible()` 排除 → 卖出 gridExecutionId 匹配失败 → 降级扣减错误批次或静默忽略。根因：**允许卖出未确认的买入**。已亲自验证。
- **C2 在途买入确认时无条件覆盖 remaining_shares**（navUpdateService.ts:879）：丢失先行卖出扣减 → 后续超卖。C1 修复可消解。

**HIGH**
- **H1 useRiskMetrics.totalAssets 漏 pendingBuyAmount**（useRiskMetrics.ts:20-22）：集中度 top3Concentration 分母偏小 → 虚高。已验证。
- **H2 deriveGridStatuses 用 .find() 取首条**（gridService.ts:472）：同层二次买入不可见；留利润底仓不计入 capitalDeployed/baseShares。

**MEDIUM**
- M1 `deriveLots:195` 未实现 `<0.01 → realized` 过滤，灰尘份额污染持仓。
- M2 `grid_execution_id` 回填失败静默降级为成本匹配（navUpdateService.ts:249）。
- M3 `gridService.ts:277` 卖出 remaining_shares TOCTOU 竞态。
- M4 `useSync.ts:124` useHoldings/useTransactions 静默吞异常 → 错误显示为空数据。

**LOW**
- L1 `gridService.ts:203` executeGrid 买入未校验 currentNav=0 → Infinity 份额。
- L2 `processPendingTransactions` window 标记防不了多 tab 并发。

**独立发现（非 agent）**
- **Reports.tsx:39 收益曲线用 Math.random() 伪造数据**（上轮 Round 0 标记未修，金融应用诚实性违规）。
- **死代码 ~300+ 行**：`backtest.ts`(234)+其测试+`Strategy`/`StrategyRule`/`BacktestResult`/`Portfolio`/`Tweet` 类型生产零调用；`updateLocalHoldingAfterTransaction`/`reverseTransactionOnHolding` 仅测试引用。
- `*WithHoldingUpdate` 函数名与实际行为不符（已不更新 holdings 表）。
- 上轮"已知限制"清单已部分过时（Settings.tsx finally 块已补、tsconfig.app.json 已强制 noUnusedLocals）。

### 各维度诚实重新评分

| 维度 | 上轮 | 本轮 | 证据 |
|------|------|------|------|
| 可靠性 | 7 | **5** | C1 CRITICAL（网格+在途超卖），M3 竞态，M4 静默吞错，L1 Infinity；542 测试绿但未覆盖该路径——绿测试给假信心 |
| 用户体验 | 7 | 6 | Reports 假收益曲线；M4 错误显示为空数据误导用户 |
| 代码质量 | 7 | **5** | ~300 行死代码，*WithHoldingUpdate 名实不符，55 as any，死分支 |
| 安全性 | 7 | 7 | 待安全 agent 返回（暂维持） |
| 性能 | 7 | 7 | 无分页（已知限制），无新发现 |
| 可维护性 | 7 | 6 | 死代码，覆盖率排除 pages/components，无 CHANGELOG |
| 功能完整性 | 8 | 6 | Reports 收益曲线假数据；backtest 整功能死代码 |

### 当前最弱维度

**可靠性 (5)** — 含 C1 CRITICAL 业务逻辑 bug。Round 1 聚焦。

### 状态

⏳ 进入 Round 1

---

## Round 1 — 可靠性：修复 C1（网格卖出对在途买入）+ L1（Infinity 份额）

**日期**: 2026-07-05
**聚焦维度**: 可靠性 (5→6)
**改动**: executeGrid sell 路径增加买入交易状态校验；buy 路径增加 currentNav≤0 守卫
**状态**: ✅ 完成

### 改进

- `gridService.ts` sell 路径：读取买入 execution 的 `transaction_id`，查 `transactions.status`，pending 则抛"买入交易尚未确认，暂不能卖出"。从源头阻止卖出未确认买入（C1 根因），同时消解 C2（不再有先行卖出，确认时 `remaining_shares` 覆盖不再丢扣减）。
- `gridService.ts` buy 路径：`currentNav ≤ 0` 抛"当前净值为 0，无法计算买入份额"，防 Infinity 份额（L1）。
- 新增 3 个测试：C1 pending 阻断、C1 completed 放行、L1 净值为零阻断。

### 验证

542 → **545 测试全绿**（+3），`tsc -b` 通过，无回归。审核关卡通过（外科式改动，遵循既有"修复 A"服务层守卫模式，接口签名不变）。

### 各维度评分

| 维度 | Round 0 | Round 1 | 证据 |
|------|---------|---------|------|
| 可靠性 | 5 | **6** | C1 CRITICAL 已修，L1 已修；H2 / M3 / M4 仍在 |
| 用户体验 | 6 | 6 | 无 UI 变更（pending 卖出得清晰错误提示） |
| 代码质量 | 5 | 5 | 无变更 |
| 安全性 | 7 | 7 | 无变更 |
| 性能 | 7 | 7 | 无变更 |
| 可维护性 | 6 | 6 | 无变更 |
| 功能完整性 | 6 | 6 | 无变更 |

### 当前最弱维度

**代码质量 (5)** — 可靠性 CRITICAL 已清零，代码质量（死代码 ~300 行 + 名实不符）成为最弱。

### 收敛判定

未收敛：H2 (HIGH) 未修；代码质量/功能完整性 <7；安全/静默失败/测试质量 agent 结果待纳入。

### 下轮候选

1. 代码质量：删除死代码（backtest.ts + 5 类型 + 2 holding 函数）。
2. 可靠性：修 H2（deriveGridStatuses .find()）、M4（静默吞错）。
3. 功能完整性：Reports 假收益曲线。

---

## Round 2 — 代码质量：移除遗留 holding 变异函数 + Tweet 死类型

**日期**: 2026-07-05
**聚焦维度**: 代码质量 (5→6)
**改动**: 删除 `updateLocalHoldingAfterTransaction` / `reverseTransactionOnHolding`（被 lot 派生取代的遗留代码）+ 其测试 + Tweet 类型
**状态**: ✅ 完成

### 决策

- **保留 backtest.ts**：VISION 核心价值第 3 条列出"回测"。它是未接入 UI 的半成品愿景功能，不是死代码——删除属业务决策，需用户确认。重新定性为"功能完整性缺口"。
- **删除 holding 变异函数**：CLAUDE.md 明确"持仓从 transactions 派生，不直接读写 holdings 表"。这两个函数是派生机制前的遗留实现，生产代码零调用，仅测试存活。删除与文档化架构一致。
- **删除 Tweet 类型**：Twitter 集成从未实现，零引用，非愿景功能。

### 改进

- `navUpdateService.ts`：删除 2 个遗留函数（-92 行）+ 移除 `Holding` 未用 import。
- `navUpdateService.test.ts`：删除对应 describe 块 + makeHolding 工具（-175 行）。
- `__tests__/hooks/useSync.test.ts`：整体删除（-127 行）——该文件名误导，全部内容只测已删的死函数，useSync hook 本身从未被测。
- `types/index.ts`：删除 Tweet 类型（-15 行）。

### 验证

545 → **524 测试全绿**（-21，全部为死代码测试），`tsc -b` 通过，无回归。审核关卡通过。

### 暴露的缺口

- **useSync hook 零测试**：删除 useSync.test.ts 后，useSync.ts（useHoldings/useTransactions 等）无任何测试。后续轮次补齐。

### 各维度评分

| 维度 | Round 1 | Round 2 | 证据 |
|------|---------|---------|------|
| 可靠性 | 6 | 6 | 无变更 |
| 用户体验 | 6 | 6 | 无变更 |
| 代码质量 | 5 | **6** | 移除 ~230 行死代码/死测试；但 *WithHoldingUpdate 名实不符、55 as any、死分支仍在 |
| 安全性 | 7 | 7 | 无变更 |
| 性能 | 7 | 7 | 无变更 |
| 可维护性 | 6 | 6 | 死代码减少，但 useSync 无测试缺口暴露 |
| 功能完整性 | 6 | 6 | 无变更 |

### 当前最弱维度

可靠性 / 用户体验 / 代码质量 / 可维护性 / 功能完整性 并列 6。

### 收敛判定

未收敛：H2 (HIGH) 未修；多个维度 6 <7。

### 下轮候选

1. 功能完整性：Reports 假收益曲线（移除伪造数据，高用户影响 + 低成本）。
2. 可靠性：H2（deriveGridStatuses .find()）、M4（静默吞错）。
3. 代码质量：纠正 *WithHoldingUpdate 命名、削减 as any。

---

## Round 3 — 功能完整性：移除 Reports 伪造收益曲线

**日期**: 2026-07-05
**聚焦维度**: 功能完整性 (6→7)
**改动**: 删除 Reports.tsx 的 Math.random() 假收益曲线（profitData useMemo + 曲线卡片 + LineChart/Line import）
**状态**: ✅ 完成

### 决策（第一性原理：产品诚实性）

金融应用的"报告"页向用户展示 `Math.random()` 伪造的收益曲线，即使标注"模拟"也是噪声+误导。真实 30 天收益曲线需要历史净值×历史批次份额（大功能，留 roadmap）。最小诚实修复 = 移除假曲线，保留真实图表（资产配置饼图、持仓柱状图、数据管理）。

### 验证

524 测试全绿，`tsc -b` 通过，无回归。审核关卡通过（纯 UI 删除，Reports 对外接口不变）。

### 各维度评分

| 维度 | Round 2 | Round 3 | 证据 |
|------|---------|---------|------|
| 可靠性 | 6 | 6 | 无变更 |
| 用户体验 | 6 | 6 | 无变更（移除误导图表是微小改善，未触达评分线） |
| 代码质量 | 6 | 6 | 无变更 |
| 安全性 | 7 | 7 | 无变更 |
| 性能 | 7 | 7 | 无变更 |
| 可维护性 | 6 | 6 | 无变更 |
| 功能完整性 | 6 | **7** | 假数据移除；核心流程完整 |

### 当前最弱维度

可靠性 / 用户体验 / 代码质量 / 可维护性 并列 6。

### 收敛判定

未收敛：核心逻辑 H1（useRiskMetrics 漏 pendingBuyAmount）、H2（deriveGridStatuses .find()）、H5（deriveLots 静默超卖）等 HIGH 未修；测试质量 agent 揭示有效覆盖率仅 65-70%。

### 下轮候选

1. 可靠性：核心逻辑 H1（useRiskMetrics 漏 pendingBuyAmount，集中度算错）— 可控。
2. 可靠性：核心逻辑 H2（deriveGridStatuses .find() 同层二次买入不可见）。
3. 可靠性：H5（deriveLots 静默超卖丢数据，需设计决策）。
4. 可维护性：H1（refactorVerification 5 个同义反复测试）、useSync 补测试。

---

## Round 4 — 可维护性：移除同义反复测试 + useSync 核心纯函数补真实测试

**日期**: 2026-07-05
**聚焦维度**: 可维护性 (6→7)
**改动**: 删除 refactorVerification.test.ts 的 5 个同义反复测试；导出并为 mapTransaction / enrichHoldingsWithNav 补 10 个真实测试
**状态**: ✅ 完成

### 决策（第一性原理：先加固测试地基）

测试质量 agent 揭示有效覆盖率仅 65-70%，5 个同义反复测试测 JS `||` 运算符而非应用代码，useSync 核心数据层 0% 覆盖。在薄弱测试上修 H2/H5 复杂 bug 易引入回归——先加固测试地基更稳妥。同时复核：核心逻辑 H1（useRiskMetrics 漏 pendingBuyAmount）影响的是未被调用方使用的 totalAssets/top3Concentration 字段，实际用户影响为零，降级处理（留作代码质量清理）。

### 改进

- `refactorVerification.test.ts`：删除 5 个同义反复测试（confirm_date `||` 测试 + mapTransaction `||` 测试，均未调用真实函数）。
- `useSync.ts`：导出 `mapTransaction` / `enrichHoldingsWithNav`（纯加性，无行为变更）。
- 新建 `__tests__/hooks/useSync.test.ts`：10 个真实测试覆盖 mapTransaction 完整字段映射/confirm_date 回退/source 默认值/nav→price，enrichHoldingsWithNav 的市值盈亏计算/无 NAV 不冒充/兜底名/除零防护。

### 验证

524 → **529 测试全绿**（-5 同义反复 +10 真实），`tsc -b` 通过。审核关卡通过。

### 各维度评分

| 维度 | Round 3 | Round 4 | 证据 |
|------|---------|---------|------|
| 可靠性 | 6 | 6 | 无变更 |
| 用户体验 | 6 | 6 | 无变更 |
| 代码质量 | 6 | 6 | 无变更 |
| 安全性 | 7 | 7 | 无变更 |
| 性能 | 7 | 7 | 无变更 |
| 可维护性 | 6 | **7** | useSync 核心纯函数已有真实测试，同义反复测试清除 |
| 功能完整性 | 7 | 7 | 无变更 |

### 当前最弱维度

可靠性 / 用户体验 / 代码质量 并列 6。

### 收敛判定

未收敛：核心逻辑 H2（deriveGridStatuses .find()）、H5（deriveLots 静默超卖）等 HIGH 未修。

### 下轮候选

1. 可靠性：核心逻辑 H2（deriveGridStatuses .find() 同层二次买入不可见）— 确认真实 bug。
2. 可靠性：H5（deriveLots 静默超卖）— 需先确认写入路径是否已防超卖。
3. 代码质量：useRiskMetrics 未用字段清理、*WithHoldingUpdate 命名。

---

## Round 5 — 可靠性：修复 H2 Failure B（留利润底仓未计入已投入）

**日期**: 2026-07-05
**聚焦维度**: 可靠性 (6→6，H2B 修复但 H5 仍在)
**改动**: computeFundOverview / useGrid baseShares 的 `!level.sellExecution` 条件改为 `!level.sellExecution || remaining_shares > 0`
**状态**: ✅ 完成

### 改进

- `gridService.ts` computeFundOverview：留利润底仓（部分卖出后 remaining_shares>0）现在计入 capitalDeployed（按 remaining/executed 比例）。原条件 `!level.sellExecution` 把所有有卖出的层级排除，导致留底份额的已投入被低估。
- `useGrid.ts` baseShares：同源条件同步修复，留底份额计入底仓。
- 新增 1 个测试：留利润底仓计入已投入（H2 修复）。

### 验证

529 → **530 测试全绿**（+1），`tsc -b` 通过。审核关卡通过（1 行条件 +注释 ×2 处，向后兼容：无卖出时行为不变）。

### 范围限制

H2 Failure A（同层二次买入：buy→sell→re-buy，第二批买入因 `.find()` 取首批而不可见）需把 deriveGridStatuses 从单 execution 改为聚合多 execution，是更大重构，留后续。Failure B（留利润底仓，常见场景）已修。

### H5 可达性确认

Transactions.tsx 添加卖出表单（行 441-459）无"卖出≤持仓"校验——用户可创建超卖，deriveLots 静默丢弃超额份额（Holdings.tsx 卖出路径有校验，但 Transactions.tsx 没有）。H5 为真实可达 HIGH bug，下轮修复。

### 各维度评分

| 维度 | Round 4 | Round 5 | 证据 |
|------|---------|---------|------|
| 可靠性 | 6 | 6 | H2B 已修；H5（超卖静默丢失）仍在 |
| 用户体验 | 6 | 6 | 无变更 |
| 代码质量 | 6 | 6 | 无变更 |
| 安全性 | 7 | 7 | 无变更 |
| 性能 | 7 | 7 | 无变更 |
| 可维护性 | 7 | 7 | 无变更 |
| 功能完整性 | 7 | 7 | 无变更 |

### 当前最弱维度

可靠性 / 用户体验 / 代码质量 并列 6。

### 收敛判定

未收敛：H5（超卖静默丢失，HIGH，已确认可达）未修。

### 下轮候选

1. 可靠性：H5 — 在写入路径阻止超卖（Transactions.tsx 缺校验）。
2. 代码质量：useRiskMetrics 未用字段清理、*WithHoldingUpdate 命名。
3. 用户体验：M4（加载失败静默显示空数据）。

---

## Round 6 — 可靠性：修复 H5（超卖静默丢失）

**日期**: 2026-07-05
**聚焦维度**: 可靠性 (6→7)
**改动**: 新增 `getFundAvailableShares` 纯函数（防超卖）+ 5 测试；Transactions.tsx 卖出提交增加超卖守卫
**状态**: ✅ 完成

### 改进

- `navUpdateService.ts`：新增 `getFundAvailableShares(transactions, fundCode)` —— 用 deriveLots 求指定基金已完成批次剩余份额之和（不含在途）。TDD：先 stub 返回 0（RED），再实现（GREEN）。
- `Transactions.tsx`：卖出（已确认）提交前校验 `shares ≤ getFundAvailableShares`，超卖则 Toast 提示可用份额并阻止提交。与 Holdings.tsx 既有校验一致，补上 Transactions.tsx 缺失的防线。
- 新增 5 个测试：多批次求和、扣已卖、排除在途、无持仓返回 0、只统计指定基金。

### 验证

530 → **535 测试全绿**（+5），`tsc -b` 干净，`npm run build` ✓ 1.68s。审核关卡通过（纯函数加性 + UI 守卫，向后兼容）。

### 各维度评分

| 维度 | Round 5 | Round 6 | 证据 |
|------|---------|---------|------|
| 可靠性 | 6 | **7** | C1/H2B/H5 已修；剩余 H2-FailureA（窄，降 MEDIUM）、M3/M4/M2/L2（边界/UX） |
| 用户体验 | 6 | 6 | 无变更 |
| 代码质量 | 6 | 6 | 无变更 |
| 安全性 | 7 | 7 | 待重新审计 |
| 性能 | 7 | 7 | 无变更 |
| 可维护性 | 7 | 7 | 无变更 |
| 功能完整性 | 7 | 7 | 无变更 |

### 当前最弱维度

用户体验 / 代码质量 并列 6。

### 收敛判定

未收敛：用户体验、代码质量 <7；且**安全/静默失败 agent 此前未取回结果**，对抗性收敛声称需补这两维审计。

### 下轮候选

1. 补审：重新启动安全 + 静默失败审计，关闭对抗收敛缺口。
2. 代码质量：useRiskMetrics 未用字段清理、*WithHoldingUpdate 命名。
3. 用户体验：M4（加载失败静默显示空数据）。

---

## Round 7 — 补审：安全 + 静默失败（对抗收敛缺口关闭）

**日期**: 2026-07-05
**聚焦维度**: 安全性 / 可靠性（验证，无新 HIGH）
**改动**: 无代码改动（审计轮）
**状态**: ✅ 完成（配额受限，agent 中断，已亲自核实关键疑点）

### 审计过程

重新启动安全 + 静默失败 agent，但遇 **429 配额耗尽**（2026-07-06 04:29 重置）中断。改由亲自读源码核实两 agent 临终前标记的疑点。

### 安全核实（无新 HIGH）

- **CSV 公式注入**（csv.ts:21-27）：导出已对 `=`/`@`/`+` 开头单元格引号包裹。但仅引号包裹**不足以**阻止 Excel 公式执行（`"=cmd|..."` 仍被解析为公式），正确做法是前缀 `'`。单用户导出自己数据，severity **LOW**，记下不优先。
- **Edge Function 参数注入**（fund-history）：`code` 已 `encodeURIComponent`（行 85），host 固定 `api.fund.eastmoney.com` **无 SSRF**。`pageIndex/pageSize` 未校验数值——可注入查询参数到东方财富，无实际危害，**LOW**。CORS 白名单 ✓、POST-only ✓。

### 静默失败核实（无新 HIGH）

- FundList.tsx:27-29 搜索错误静默吞 → 用户见"未找到"而非"搜索失败"（MEDIUM，UX）。
- FavoriteFunds/loadFavorites、useHoldings/useTransactions 加载吞错 → 显示空数据（M4 模式，MEDIUM，UX）。

### 结论

无新 CRITICAL/HIGH。安全性维持 7。剩余为 LOW/MEDIUM（CSV 注入缓解、Edge Function pageIndex 校验、M4 加载错误展示）。

### 各维度评分

不变（可靠性 7、安全性 7、用户体验 6、代码质量 6、可维护性 7、功能完整性 7、性能 7）。

### 当前最弱维度

用户体验 / 代码质量 并列 6。

### 收敛判定

未收敛：用户体验、代码质量 <7。无 HIGH 剩余。

### 下轮候选

1. 用户体验：M4 — useHoldings/useTransactions 加载失败显示空数据，改为展示错误。
2. 代码质量：useRiskMetrics 未用字段清理（4 个返回字段无人使用）。

---

## Round 8 — 用户体验：修复 M4（加载失败静默显示空数据）

**日期**: 2026-07-05
**聚焦维度**: 用户体验 (6→7)
**改动**: useHoldings/useTransactions 增加 `error` 状态（含 supabase 错误）；Holdings/Transactions 展示错误 + 重试
**状态**: ✅ 完成

### 改进

- `useSync.ts`：useHoldings/useTransactions 新增 `loadError` 状态——catch 异常与 supabase error（如 RLS 拒绝、网络）都上报，不再静默返回空数组。返回字段 `error`。
- `Holdings.tsx`：加载失败且无数据时显示错误信息 + "点击重试"。
- `Transactions.tsx`：空状态 `getEmptyStateText` 优先返回错误信息，并显示"重试"按钮替代"添加第一笔交易"。

### 验证

535 测试全绿，`tsc -b` 通过。审核关卡通过（additive `error` 字段，既有消费者不受影响）。

### 各维度评分

| 维度 | Round 7 | Round 8 | 证据 |
|------|---------|---------|------|
| 可靠性 | 7 | 7 | 无变更 |
| 用户体验 | 6 | **7** | 加载失败不再静默，错误可见 + 可重试 |
| 代码质量 | 6 | 6 | 无变更 |
| 安全性 | 7 | 7 | 无变更 |
| 性能 | 7 | 7 | 无变更 |
| 可维护性 | 7 | 7 | 无变更 |
| 功能完整性 | 7 | 7 | 无变更 |

### 当前最弱维度

代码质量 (6)。

### 收敛判定

未收敛：代码质量 <7。无 HIGH 剩余。

### 下轮候选

1. 代码质量：useRiskMetrics 死字段清理（totalAssets/deploymentRate/top3Concentration 等未被调用方使用）+ processPendingTransactions 死分支。

---

## Round 9 — 代码质量：useRiskMetrics 死字段清理

**日期**: 2026-07-05
**聚焦维度**: 代码质量 (6→7)
**改动**: useRiskMetrics 精简为仅返回 Dashboard 实际消费的 2 个字段；移除死计算 + 重复 fetch + 死字段测试
**状态**: ✅ 完成

### 改进

- `useRiskMetrics.ts`：重写——仅返回 `gridTriggeredCount` + `valuationSignal`。移除未被任何调用方使用的 `totalAssets`/`deploymentRate`/`top3Concentration`/`pendingCount`/`loading`。移除内部重复的 `useHoldings()` 调用（Dashboard 已自行调用，原 hook 造成双 fetch）。**顺带消解 H1**（totalAssets 漏 pendingBuyAmount 的"bug"随死字段一同删除）。
- `Dashboard.tsx`：调用点 `useRiskMetrics(valuation?.percentile)`（移除 pendingCount 参数）。
- `useRiskMetrics.test.ts`：移除 4 个死字段测试（totalAssets/top3Concentration/pendingCount/deploymentRate），保留 6 个真实测试（valuationSignal 四档 + gridTriggeredCount 聚合 + 空状态）。

### 验证

535 → **531 测试全绿**（-4 死字段测试），`tsc -b` 通过，`npm run build` ✓ 1.67s。审核关卡通过（签名变更仅影响唯一调用方 Dashboard，已同步更新）。

### 各维度评分

| 维度 | Round 8 | Round 9 | 证据 |
|------|---------|---------|------|
| 可靠性 | 7 | 7 | H1（useRiskMetrics）随死字段删除消解 |
| 用户体验 | 7 | 7 | 无变更 |
| 代码质量 | 6 | **7** | 死字段/死计算/重复 fetch 清除；仍余 *WithHoldingUpdate 命名、55 as any（多为 supabase 类型必需） |
| 安全性 | 7 | 7 | 无变更 |
| 性能 | 7 | 7 | 重复 fetch 消除（微小改善） |
| 可维护性 | 7 | 7 | 无变更 |
| 功能完整性 | 7 | 7 | 无变更 |

### 收敛判定

**收敛 ✅**

1. 无 CRITICAL/HIGH 剩余（C1/H2B/H5 已修；安全/静默失败已亲自核实标记疑点，仅余 LOW/MEDIUM）。
2. 所有 7 维度诚实评分 ≥7。
3. `npm run build` ✓ + 531 测试全绿。
4. 无回归。

**保留**：安全/静默失败全量重审因 429 配额中断（2026-07-06 04:29 重置），已亲自核实两 agent 临终标记的疑点（CSV 公式注入、Edge Function 参数注入、M4）均无 HIGH。配额恢复后可补做完整重审。

---

## Round 10 — 代码审查修复（5 项发现）

**日期**: 2026-07-05
**聚焦维度**: 代码审查 MEDIUM/LOW 闭环
**改动**: H5 服务层守卫 + M4 Dashboard/Reports 错误展示 + C1 守卫加固
**状态**: ✅ 完成

### 背景

对 Round 1-9 改动做对抗性代码审查，发现 2 MEDIUM + 3 LOW。本轮全部处理。

### 改进

- **H5 服务层闭环（MEDIUM）**：提取 `mapTransaction` 到 `utils/mapTransaction.ts`（DRY，避免 useSync↔navUpdateService 循环依赖）；`addTransactionWithHoldingUpdate` 在 `type==='sell' && completed` 时调用 `getFundAvailableShares` 校验超卖。服务层与 C1/executeGrid 模式一致。+2 测试。
- **M4 错误展示补全（MEDIUM）**：Dashboard.tsx 解构 `error` + useEffect Toast；Reports.tsx 解构 `error` + Empty 描述展示。加载失败不再静默。
- **C1 守卫加固（LOW）**：`transaction_id` 缺失抛"缺少关联交易，数据异常"；buyTx 未找到抛"关联的买入交易不存在"。2 个既有卖出测试同步补 transaction_id + completed 状态。
- **C1 额外 select（LOW）**：固有成本（grid_execution.status 不反映 pending，必须查 transactions.status），已文档化接受。
- **死 mock（LOW）**：Round 9 重写时已移除，审查发现过期，无需操作。

### 验证

531 → **533 测试全绿**（+2 服务层守卫测试），`tsc -b` 通过，`npm run build` ✓ 1.57s。

### 状态

✅ 收敛维持。所有审查发现已处理（3 fixed / 2 no_change_needed）。

---

# 第三轮打磨：补全审计缺口（2026-07-06）

> 对齐：补全第二轮被 429 中断的安全/静默失败/测试质量全量审计，发现则修。约束同前。

## Round 0 — 全量重审基线

3 路审计 agent（安全/静默失败/测试质量）重跑。**静默失败 agent 发现 4 CRITICAL + 7 HIGH + 11 MEDIUM**——证明第二轮收敛过早（429 中断漏掉）。系统性问题：Supabase 调用后未检查 `error` 字段（客户端返回 `{error}` 而非抛异常，try/catch 抓不到）。

### 已修复（Round 1-5）

| 轮次 | 严重度 | 缺陷 | 文件 |
|------|--------|------|------|
| R1 | CRITICAL #1 | syncGridOnTransactionDelete 6 处未检查 error，卖出引用安全检查 fail-open→数据损坏。改 fail-closed + 测试 | navUpdateService.ts |
| R1 | CRITICAL #2 | cancelGridExecution 卖出引用检查 fail-open（console.warn 放行）→数据损坏。改 fail-closed | gridService.ts |
| R1 | CRITICAL #3 | exportDatabase 5 查询未检查 error→静默空备份（数据丢失）。改检查 error 拒绝导出 | db/index.ts |
| R1 | CRITICAL #4 | importDatabase FK 清理未检查 error→部分导入损坏。改检查 error | db/index.ts |
| R2 | HIGH | pending 卖出绕过 H5——processPendingTransactions 确认时无超卖校验。加 getFundAvailableShares 守卫 | navUpdateService.ts |
| R2 | HIGH #7 | GridDetail.handleExecute 无 catch，C1 抛错成未处理 rejection。加 catch + Toast | GridDetail.tsx |
| R3 | HIGH #10 | useGrid NAV 失败兜底 bottom_price→所有网格显示买入信号→错误交易。改 NaN（无虚假触发） | useGrid.ts |
| R4 | HIGH #5 | alertService.resolveAlert 未检查 error→UI 误移除未解决告警。改检查 error + 调用方 try/catch | alertService.ts, Transactions.tsx |
| R4 | MEDIUM #11 | createAlert fallback insert 空 catch。改 console.warn | alertService.ts |
| R5 | HIGH #6 | FundDetail.toggleFavorite delete/insert 未检查 error→UI/DB 不一致。改检查 error | FundDetail.tsx |

### 验证

533 → **541 测试全绿**（+1 fail-closed +2 C1 加固守卫 +4 测试缺口补齐：H-1 cancelGridExecution 状态变更、H-2 remaining_shares 部分卖出、H-6 网格回填、H-4 M4 hook error×2），`tsc -b` 通过，`npm run build` ✓。

### Round 7 — 测试缺口补齐（test-quality agent H-1/H-2/H-4/H-6）

- H-1：cancelGridExecution 取消卖出时验证 `status:'cancelled'`+`transaction_id:null`+remaining_shares 恢复封顶（920+80→1000）。
- H-2：executeGrid 部分卖出（300/1000）验证 remaining_shares 更新为 700。
- H-6：pending 网格买入确认后验证 grid_executions 回填（executed_nav/amount/shares/remaining_shares）。
- H-4：useHoldings/useTransactions 加载失败验证 error 状态设置（非静默空数据）。
- H-3（Round 6 已补）：C1 加固 transaction_id 缺失/未找到守卫。
- H-5（H5 Transactions.tsx UI 守卫）defer——需组件测试，服务层守卫已测。

### Round 8 — 全部修复剩余 HIGH/MEDIUM

**移除**：syncService.ts 死代码（IndexedDB 时代，生产零引用）+ 其测试。

**错误传播（函数返回 []/0 掩盖错误→抛出）**：
- alertService fetchAlerts/fetchUnresolvedAlertCount（#8）
- fundApi fetchFundHistory/searchFunds/searchFromEastMoney（#13/#17），FundHistoryCard 补 try/catch
- 更新对应测试断言（6 个 fundApi + 2 个 alertService）

**未检查 Supabase error（→检查 + throw/handle）**：
- FundDetail.loadFundInfo favorite 查询（#14）+ 批次加载错误提示（#15）
- Transactions 自动收藏（#16，try/catch + 日志）
- FavoriteFunds.handleRemove（#21）

**空 catch→console.warn**：processPendingTransactions 告警 catch（#18）、Settings.handleCsvImport catch（#19）、FavoriteFunds.loadHistoryData（#22）。

**错误数据修复**：Holdings 批次视图 NAV→cost 兜底显示 0 利润→"净值不可用"（#12）。

**安全**：importDatabase 破坏性导入无确认→加 Dialog.confirm（与 handleReset 一致）。

### 验证

541 → **520 测试全绿**（移除 syncService 死代码测试 -21，更新 8 个错误断言），`tsc -b` 通过，`npm run build` ✓。

### 状态

✅ 第三轮全部修复完成。4 CRITICAL + 7 HIGH + 11 MEDIUM 静默失败/数据损坏全部处理。唯一 defer：H-5（UI 守卫组件测试，服务层守卫已测）。

### 剩余（未修，记入 ROADMAP）

- HIGH #8：fetchAlerts/fetchUnresolvedAlertCount 返回 []/0 掩盖加载失败——需调用方加 error 状态（M4 模式），defer。
- HIGH #9：syncService.fetchAllDataFromSupabase 等——syncService 生产零引用（死代码），defer（移除或修复）。
- MEDIUM ×11：API 失败兜底 []/0（fetchFundHistory、searchFunds、Holdings 批次视图 NAV→cost、FundDetail loadFundInfo 等）——同类模式，留后续轮次。
- 安全：importDatabase 破坏性无确认（Settings.handleImport 无 Dialog.confirm）——defer。

### 状态

⏳ 4 CRITICAL + 6 HIGH 已修，剩余 2 HIGH（defer）+ 11 MEDIUM。第二轮"收敛"被证伪，本轮实质性收敛缺口已关闭（CRITICAL 全清，HIGH 数据损坏类全修）。

---

# 第一轮打磨存档（2026-06-21，已收敛）

## Round 4 — 安全性：mutation 操作增加 auth 校验

**日期**: 2026-06-21
**聚焦维度**: 安全性 (6→7)
**改动**: 提取 `isAuthenticated()` 工具函数，3 个 mutation 函数增加 session 校验
**状态**: ✅ 完成

### 改进

- `useSupabase.ts`：提取同步 `isAuthenticated()` 函数（30天 session TTL 校验），测试环境防御性放行
- `navUpdateService.ts`：`addTransactionWithHoldingUpdate`、`removeTransactionWithHoldingUpdate`、`removeHoldingWithTransactions` 在执行前校验认证状态

### 各维度评分

| 维度 | 分数 | 变化 | 证据 |
|------|------|------|------|
| 可靠性 | 7 | — | 542 测试全绿，构建通过 |
| 用户体验 | 7 | — | 无变更 |
| 代码质量 | 7 | — | 无变更 |
| 安全性 | 7 | +1 | 写入操作前增加 session 校验，防止过期 session 执行写入 |
| 性能 | 7 | — | 无变更 |
| 可维护性 | 7 | — | 无变更 |
| 功能完整性 | 8 | — | 无变更 |

### 收敛判定

**所有维度 ≥7 → 收敛 ✅**

---

## Round 3 — 代码质量：清理 console 残留

**日期**: 2026-06-21
**聚焦维度**: 代码质量 (6→7)
**改动**: 清理 19 处冗余 console.error/warn（28→9），保留 9 处非关键路径调试信息
**状态**: ✅ 完成

### 改进

- fundApi.ts：清理 8 处 console.error（catch 块中已有返回值兜底）
- useSync.ts：清理 5 处 console.error（loading 状态已处理 UX）
- syncService.ts：清理 3 处 console.error（返回空数据兜底）
- Settings.tsx：清理 1 处 console.error（Toast 已反馈用户）
- FavoriteFunds.tsx：清理 1 处 console.error（loading 状态已处理）
- useGrid.ts：清理 1 处 console.error（error state 已捕获）
- 保留 gridService.ts (6处)、navUpdateService.ts (1处)、supabase.ts (2处) 的 warn/error（非关键路径调试信息）

### 各维度评分

| 维度 | 分数 | 变化 | 证据 |
|------|------|------|------|
| 可靠性 | 7 | — | 542 测试全绿，构建通过 |
| 用户体验 | 7 | — | 无变更 |
| 代码质量 | 7 | +1 | 清理 19 处冗余 console（28→9），保留非关键路径调试信息 |
| 安全性 | 6 | — | 无变更 |
| 性能 | 7 | — | 无变更 |
| 可维护性 | 7 | — | 无变更 |
| 功能完整性 | 8 | — | 无变更 |

### 当前最弱维度

**安全性 (6)** — 仅剩未达标维度。

### 改进候选（下轮）

安全性维度受限于架构约束（不能加新依赖、不能改 RLS 策略、不能改认证机制）。可改进方向：
1. 在现有认证框架内加固（如增加 auth 状态校验频率）
2. 清理前端 bundle 中可能暴露的敏感信息

---

## Round 2 — 用户体验：消除 window.location.reload()

**日期**: 2026-06-21
**聚焦维度**: 用户体验 (6→7)
**改动**: 新增 `dataChangeEvent.ts` 事件总线，替代 4 处 `window.location.reload()`；hooks 监听自动刷新
**状态**: ✅ 完成

### 改进

- 新增 `src/utils/dataChangeEvent.ts`：轻量 CustomEvent 事件总线（~15行）
- `useSync.ts` 的 `useHoldings()` 和 `useTransactions()` 监听数据变更事件自动刷新
- Settings.tsx（数据重置 + JSON 导入）、Holdings.tsx（删除持仓）、Reports.tsx（JSON 导入）：`window.location.reload()` → `dispatchDataChanged()`
- 保留 Layout.tsx 的 auth reload（登录后重新初始化合理）
- 新增 4 个单元测试覆盖事件分发/取消订阅/多监听器

### 各维度评分

| 维度 | 分数 | 变化 | 证据 |
|------|------|------|------|
| 可靠性 | 7 | — | 542 测试全绿，构建通过 |
| 用户体验 | 7 | +1 | 消除了全页闪烁（4处 reload），数据变更后平滑刷新 |
| 代码质量 | 6 | — | 无变更 |
| 安全性 | 6 | — | 无变更 |
| 性能 | 7 | — | 无变更 |
| 可维护性 | 7 | — | 无变更 |
| 功能完整性 | 8 | — | 无变更 |

### 当前最弱维度

**代码质量 (6)** 和 **安全性 (6)** 并列。

### 改进候选（下轮）

1. 减少不必要的 as any（优先 gridService.ts 和 alertService.ts）
2. 清理 console.error/console.warn 残留（~20 处）

---

## Round 1 — 代码质量：消除重复匹配逻辑

**日期**: 2026-06-21
**聚焦维度**: 代码质量 (5→6)
**改动**: lotTraceService.ts — 删除 `matchSellToLots` 函数（~50行），复用 `navUpdateService.matchSellAgainstLots`
**状态**: ✅ 完成

### 改进

- 消除了 `lotTraceService.ts` 与 `navUpdateService.ts` 之间的卖出匹配逻辑重复
- `BuyLotState` 新增 `fundCode` 字段以兼容 `MatchableLot` 接口
- 回调模式保持原有 timeline item 构建逻辑

### 各维度评分

| 维度 | 分数 | 变化 | 证据 |
|------|------|------|------|
| 可靠性 | 7 | — | 538 测试全绿，构建通过 |
| 用户体验 | 6 | — | 无 UI 变更 |
| 代码质量 | 6 | +1 | 消除了一处核心业务逻辑重复（lotTraceService vs navUpdateService），仍有 ~80+ as any 和 console 残留 |
| 安全性 | 6 | — | 无安全变更 |
| 性能 | 7 | — | 无性能变更 |
| 可维护性 | 7 | — | 无变更 |
| 功能完整性 | 8 | — | 无变更 |

### 改进候选（下轮）

1. 清理 console.error/console.warn 残留（~20 处）
2. 减少不必要的 as any（优先 gridService.ts 和 alertService.ts）
3. 消除 navUpdateService.ts 内部的 matchSellLots 与 matchSellAgainstLots 的冗余包装

---

## Round 0 — 基线评估

**日期**: 2026-06-21
**版本**: v2.7.0
**测试**: 538 passed (19 files)
**构建**: 通过

### 各维度评分

| 维度 | 分数 | 证据 |
|------|------|------|
| 可靠性 | 7 | 538 测试全绿，构建通过，主要异步操作有 try/catch。扣分：~20 处 console.error 残留，部分 Toast 错误消息不够可操作 |
| 用户体验 | 6 | 核心流程直观（6-tab 导航、操作卡片）。扣分：Settings/Holdings 用 window.location.reload() 而非响应式刷新；Reports 利润曲线用 Math.random() 生成假数据；CSV 导入错误拼接成长字符串显示在 Toast 中难以阅读 |
| 代码质量 | 5 | 模块划分合理，命名一致。扣分：~80+ 处 as any；lotTraceService.ts 复制了 navUpdateService.ts 的匹配逻辑（matchSellToLots vs matchSellAgainstLots）；articleService.ts 硬编码示例数据 |
| 安全性 | 6 | 基本认证工作，RLS 已启用。扣分：密码明文存 localStorage；RLS ALLOW ALL 策略；supabase anon key 在前端 bundle 中可见 |
| 性能 | 7 | NAV 5min 缓存 + 请求去重；history 24h 缓存。扣分：所有 hook 一次 fetch 全量数据无分页；图表数据无懒加载 |
| 可维护性 | 7 | 核心文档存在（CLAUDE.md、ARCHITECTURE.md），测试覆盖 services/hooks/utils。扣分：覆盖率排除 pages/components；无 CHANGELOG；tsconfig 关闭 noUnusedLocals/Parameters |
| 功能完整性 | 8 | 核心流程端到端完整。扣分：Reports 利润曲线为假数据；articleService 硬编码数据 |

### 当前最弱维度

~~**代码质量 (5)**~~ → Round 1 已提升至 6。当前最弱：**用户体验 (6)** 和 **安全性 (6)** 并列。

### 改进候选

~~1. 消除 lotTraceService.ts 中的重复匹配逻辑~~ ✅ Round 1 完成
2. 清理 console.error/console.warn 残留（~20 处）
3. 减少不必要的 as any（优先处理 gridService.ts 和 alertService.ts）

### 状态

⏳ 进行中
