# 代码审查问题记录

> 审查日期: 2026-04-06  
> 审查范围: 全项目代码、架构、UI/UX、文档

---

## 一、严重问题 (Critical) — 必须修复

### 1. FundDetail.tsx 收藏功能使用已废弃的 IndexedDB API
**文件**: `frontend/src/pages/FundDetail.tsx:100-111`
```typescript
await db.favoriteFunds.where('code').equals(fundCode).delete();
await db.favoriteFunds.add({...});
```
**问题**: 项目已迁移到 Supabase 为唯一数据源，但收藏功能仍调用不存在的 `db` 对象，导致收藏/取消收藏功能完全不可用。
**影响**: 用户点击星标按钮会抛出 `db is not defined` 运行时错误。
**修复**: 改用 `supabase.from('favorite_funds')` 操作。

---

### 2. `mapTransaction` 丢失 confirmDate 数据
**文件**: `frontend/src/hooks/useSync.ts:82-98`
```typescript
confirmDate: t.date,  // 第90行，直接用 date 覆盖
```
**问题**: 数据库 `transactions` 表没有 `confirm_date` 字段，但 `types/index.ts` 中 Transaction 接口定义了 `confirmDate` 可选字段。映射时把 `confirmDate` 硬编码为 `t.date`，导致确认日期信息丢失。
**影响**: 在途交易的确认日期无法正确追踪，`processPendingTransactions` 中 `transaction.confirm_date` 可能为 undefined。
**修复**: 需在数据库添加 `confirm_date` 列，或在映射时从其他字段推导。

---

### 3. `useStrategies` Hook 是空壳
**文件**: `frontend/src/hooks/useSync.ts:277-299`
```typescript
const loadStrategies = useCallback(async () => {
  setLoading(true);
  try {
    setStrategies([]);  // 永远返回空数组
  } finally {
    setLoading(false);
  }
}, []);
```
**问题**: 策略数据从未从任何数据源加载，始终返回空数组。Strategy 页面通过 `localStorage` 读写自定义策略，与 Supabase 架构完全脱节。
**影响**: 系统策略永远为空，策略功能仅依赖 localStorage，数据无法跨设备同步。

---

## 二、高优先级问题 (High)

### 4. Holdings.tsx 卖出时 NAV 回退到成本价
**文件**: `frontend/src/pages/Holdings.tsx:78-79`
```typescript
const price = navData?.nav || sellModal.lot!.cost;
```
**问题**: 当 `fetchFundNav` 返回 null 时，卖出价格回退到买入成本价。如果用户在不联网或 API 失败时卖出，会以成本价成交，导致盈亏计算完全错误。
**影响**: 用户可能误以为以当前市价卖出，实际以成本价记录。
**建议**: 卖出前应验证 NAV 有效性，若无法获取应阻止操作并提示用户。

### 5. `enrichHoldingsWithNav` 与 Holdings.tsx 净值获取逻辑重复
**文件**: 
- `frontend/src/hooks/useSync.ts:206-271`
- `frontend/src/pages/Holdings.tsx:108-137`

**问题**: 两处都在批量获取基金 NAV，逻辑几乎相同但实现细节不同（batch size、错误处理、缓存策略）。
**影响**: 维护成本高，容易出现不一致。
**建议**: 提取为共享服务函数。

### 6. `removeHoldingWithTransactions` 通过 holdings 表 ID 删除，但架构已改为从 transactions 派生
**文件**: `frontend/src/services/navUpdateService.ts:438-452`
**问题**: 项目架构说明 "持仓从交易记录派生，不再依赖 holdings 表"，但此函数仍查询 `holdings` 表获取 `fund_code`，然后删除该基金的所有交易。
**影响**: 
- 如果 holdings 表为空（符合新架构），此函数无法工作
- 删除所有同基金代码的交易过于激进，可能误删其他持仓的交易
**建议**: 重新设计删除逻辑，应基于交易记录而非 holdings 表。

### 7. `processPendingTransactions` 在途处理缺少 confirm_date 字段
**文件**: `frontend/src/services/navUpdateService.ts:508`
```typescript
const confirmDate = transaction.confirm_date || transaction.date;
```
**问题**: `confirm_date` 字段在数据库 schema (`types/database.ts`) 中不存在，在 `mapTransaction` 中也未被正确映射。这意味着所有在途交易的 confirmDate 都回退到 `date`。
**影响**: 如果用户选择未来日期创建在途交易，`confirm_date` 不会被保存，导致在途处理逻辑判断错误。

### 8. `addTransactionWithHoldingUpdate` 没有返回插入结果
**文件**: `frontend/src/services/navUpdateService.ts:413`
```typescript
await supabase.from('transactions').insert(txPayload as any);
```
**问题**: 插入操作没有 `.select()` 调用，无法确认是否成功插入，也无法获取生成的 ID。
**建议**: 添加 `.select()` 并在失败时抛出错误。

---

## 三、中等优先级问题 (Medium)

### 9. csv.ts 顶部有大量未使用的 React 组件导入
**文件**: `frontend/src/utils/csv.ts:1-6`
```typescript
import React, { useState } from 'react';
import { Card, List, Button, Toast, Dialog, Tag } from 'antd-mobile';
import { DownlandOutline, UploadOutline } from 'antd-mobile-icons';
import { useHoldings, useTransactions } from '../hooks/useSync';
import { formatMoney, formatDate } from '../utils';
import type { Holding, Transaction } from '../types';
```
**问题**: 前5行导入全部未使用（React、antd-mobile 组件、图标、hooks），只有 `formatDate` 和类型定义被使用。
**影响**: 增加 bundle size，降低代码可读性。

### 10. `exportHoldingsToCSV` 和 `exportTransactionsToCSV` 的日期格式化错误
**文件**: `frontend/src/utils/csv.ts:106, 123`
```typescript
formatDate(new Date().toISOString())
```
**问题**: `formatDate` 期望 `dateString` 参数，但传入的是 `new Date().toISOString()` 产生的完整 ISO 字符串。`formatDate` 内部会 `new Date(dateString)` 再转本地日期，这在某些时区可能产生意外结果。

### 11. Dashboard 和 Transactions 页面重复调用 processPendingTransactions
**文件**: 
- `frontend/src/pages/Dashboard.tsx:18`
- `frontend/src/pages/Transactions.tsx:298`

**问题**: 两个页面都在 `useEffect([], [])` 中调用 `processPendingTransactions()`。如果用户先访问 Dashboard 再访问 Transactions，会重复处理同一批在途交易。
**影响**: 虽然 Supabase 更新是幂等的（pending → completed），但会产生不必要的 API 调用和 Toast 通知。
**建议**: 提取到全局初始化逻辑或使用 debounce。

### 12. `canDeleteTransaction` 排序逻辑与 `deriveLots` 不一致
**文件**: `frontend/src/services/navUpdateService.ts:258-260`
```typescript
const buyTxs = transactions
  .filter(t => t.type === 'buy' && t.status === 'completed')
  .sort((a, b) => a.price - b.price || a.date.localeCompare(b.date));
```
**问题**: `deriveLots` 按日期排序后在卖出匹配时按成本排序，而 `canDeleteTransaction` 直接按 `price` 排序。虽然最终效果相似，但排序逻辑不一致可能导致边界情况下判断结果不同。

### 13. 所有页面使用 hash 路由但没有回退处理
**文件**: `frontend/src/pages/Layout.tsx:32-56`
**问题**: 当 hash 不匹配任何已知模式时，默认显示 `activeTab?.component`，但如果 `activeKey` 初始值不是有效 tab key，会渲染 undefined。
**建议**: 添加默认回退到 dashboard。

### 14. `TotalAssetsCard` 的 `showProfitLabel` prop 从未使用
**文件**: `frontend/src/components/TotalAssetsCard.tsx:12`
**问题**: 定义了 `showProfitLabel?: boolean` prop 但组件内部从未使用。

### 15. Strategy 页面 `basePrice` 字段无实际用途
**文件**: `frontend/src/pages/Strategy.tsx:448, 483-488`
**问题**: 回测表单中有 `basePrice` 字段，但 `runBacktest` 函数没有使用这个参数。

### 16. 内联样式泛滥
**范围**: 几乎所有页面组件
**问题**: 大量内联 style 对象，没有统一的设计 token 系统。相同样式（如 `fontSize: 13, color: '#999'`）在多处重复。
**建议**: 提取 CSS 变量或 design tokens。

---

## 四、低优先级问题 (Low)

### 17. `searchByCode` 和 `searchByName` 功能重叠
**文件**: `frontend/src/services/fundApi.ts:143-165`
**问题**: 两个函数都调用同一个 `searchFromEastMoney`，只是过滤条件不同。`searchByCode` 的过滤逻辑 `startsWith` 对中文基金名搜索可能不准确。

### 18. `fetchFromEastMoney` 中 dailyChange 计算可能不准确
**文件**: `frontend/src/services/fundApi.ts:47`
```typescript
dailyChange: data.estimateNav - data.nav,
```
**问题**: 使用估算净值减去最新净值作为涨跌额，这不是真实的日涨跌幅。真实日涨跌额应该是 `最新净值 - 上一交易日净值`。

### 19. console.log 散落在生产代码中
**文件**: 多处
- `frontend/src/services/navUpdateService.ts:478, 520, 524, 548`
- `frontend/src/components/FundHistoryCard.tsx:63, 91, 117, 159`

**建议**: 使用统一的日志框架或构建时移除。

### 20. `FundList.tsx` hash 路由缺少 `#` 前缀
**文件**: `frontend/src/pages/FundList.tsx:62`
```typescript
window.location.hash = `fund/${fund.code}`;  // 缺少 # 前缀
```
**问题**: 其他页面使用 `#fund/` 格式，这里也是正确的（因为 `window.location.hash` 赋值时不需要 `#`），但 Layout.tsx 解析时期望 `#fund/`（第31行正则 `/#fund\/(.+)/`），实际 `window.location.hash` 返回的值包含 `#`，所以 `fund/000001` 赋值后 hash 变为 `#fund/000001`，正则匹配正确。此处无 bug，但风格不一致。

---

## 五、架构问题

### 21. 数据访问层不统一
**现状**:
- `useSync.ts` — 从 transactions 派生持仓（新架构）
- `useSupabase.ts` — 直接从 holdings 表读取（旧架构）
- 组件直接调用 `supabase.from()`（如 FundDetail、FavoriteFunds）

**问题**: 三种数据访问方式并存，开发者容易混淆。
**建议**: 统一使用 `useSync.ts` 中的数据访问 hooks。

### 22. `useSupabase.ts` 中的 `useSupabaseHoldings` 和 `useSupabaseTransactions` 已废弃
**文件**: `frontend/src/hooks/useSupabase.ts:76-177`
**问题**: 这两个 hook 直接从 holdings 表读取数据，与 "持仓从交易记录派生" 的架构设计矛盾。目前未被任何组件使用。
**建议**: 删除或标记为 deprecated。

### 23. `db/index.ts` 中的类型定义与实际数据库不匹配
**文件**: `frontend/src/db/index.ts:12-67`
**问题**: 定义了 `FavoriteFund`、`FundCacheItem`、`ScheduledTask`、`FeishuConfig` 等接口，但这些接口与数据库实际表结构不一致（如 `FundCacheItem` 对应 `fund_cache` 表但字段不匹配）。

---

## 六、测试覆盖缺口

### 24. 缺少核心业务逻辑测试
- `deriveLots` — 批次派生（核心逻辑）无测试
- `deriveRealizedLots` — 已实现盈亏派生无测试
- `summarizeHoldings` — 持仓汇总无测试
- `matchSellLots` — 卖出匹配无测试
- `canDeleteTransaction` — 删除验证无测试

### 25. 缺少 UI 集成测试
- 完整的买入 → 持仓 → 卖出流程
- 在途交易创建 → 净值更新 → 自动确认流程

---

## 七、文档问题

### 26. AGENTS.md 与实际代码不一致
- 文档说 "持仓从交易记录派生"，但 `navUpdateService.ts` 中仍有 `removeHoldingWithTransactions` 操作 holdings 表
- `useSupabase.ts` 中的旧 hooks 未被文档说明

### 27. 缺少 Edge Functions API 文档
- `fund-nav`、`fund-search`、`fund-history` 的输入输出格式无文档

---

## 八、废弃代码清单

### 可安全删除的文件/目录:
| 路径 | 原因 |
|------|------|
| `frontend/src/hooks/useSupabase.ts` | `useSupabaseHoldings`/`useSupabaseTransactions` 未被使用；仅 `useAuthStatus`/`signOut`/`verifyPassword`/`setAuthenticated` 被使用 |
| `frontend/src/utils/csv.ts:1-6` | 前6行未使用的导入 |
| `frontend/src/components/TotalAssetsCard.tsx:12` | 未使用的 `showProfitLabel` prop |
| `frontend/src/services/syncService.ts` | 需检查是否被引用 |
| `frontend/src/services/articleService.ts` | 需检查是否被引用 |
| `frontend/src/services/twitterService.ts` | 需检查是否被引用 |
| `frontend/src/types/supabase.ts` | 需检查是否与 `types/database.ts` 重复 |

### 根目录废弃文件（非前端核心）:
| 路径 | 原因 |
|------|------|
| `api/` | Python Flask 后端，已被 Supabase Edge Functions 替代 |
| `backend/` | Python CLI 后端，已被替代 |
| `proxy-server.js` | 旧代理服务，已被 Edge Functions 替代 |
| `proxy-simple.js` | 旧代理服务 |
| `proxy-server/` | 旧代理服务 |
| `main.py` | Python 入口文件 |
| `test-supabase.ts` | 旧测试文件 |
| `start-dev.sh` | 旧开发启动脚本 |
| `hooks/` | 空目录 |
| `stores/` | 空目录 |
| `src/` | Python `__init__.py`，旧后端 |
| `lib/` | 旧后端库 |
| `config/` | 旧配置文件 |
| `data/` | 旧数据文件 |
| `scripts/` | 旧脚本 |

---

## 九、测试验证结果

### 已编写的测试用例
- `frontend/src/__tests__/services/lotDerivation.test.ts` — 18 个测试，全部通过
- 覆盖: `deriveLots`、`deriveRealizedLots`、`summarizeHoldings`、`matchSellLots`

### 测试发现的行为事实
1. **`deriveLots` 过滤已完全卖出的批次**: 当 `remainingShares <= 0` 时批次被过滤，不在返回列表中
2. **`deriveRealizedLots` 只在批次完全卖出时记录**: 部分卖出不产生已实现盈亏记录
3. **卖出超过持仓的边界情况**: `remainingShares` 可为负数，但该批次会被过滤掉（不会出现在持仓列表中）

---

## 十、修复优先级建议

| 优先级 | 问题编号 | 描述 | 预计工作量 |
|--------|---------|------|-----------|
| P0 | 1 | FundDetail 收藏功能修复 | 30min |
| P0 | 2 | confirmDate 数据丢失修复 | 1h |
| P0 | 3 | useStrategies 空壳修复 | 1h |
| P1 | 4 | Holdings 卖出 NAV 验证 | 30min |
| P1 | 6 | removeHoldingWithTransactions 重构 | 2h |
| P1 | 7 | confirm_date 数据库字段添加 | 1h |
| P1 | 8 | addTransactionWithHoldingUpdate 错误处理 | 30min |
| P2 | 11 | processPendingTransactions 去重 | 1h |
| P3 | 16 | 内联样式提取 | 长期 |
| P3 | 21 | 数据访问层统一 | 长期 |

---

## 十一、已完成的清理工作

| 操作 | 文件 | 说明 |
|------|------|------|
| ✅ 删除 | `useSupabase.ts` 中的废弃函数 | 移除 `useSupabaseConfig`、`verifyPassword`、`setAuthenticated`、`useSupabaseHoldings`、`useSupabaseTransactions`、`addHolding`、`addTransaction`、`deleteHolding`、`deleteTransaction`，仅保留 `useAuthStatus` 和 `signOut` |
| ✅ 清理 | `csv.ts` 未使用的导入 | 移除 `React`、`useState`、`Card`、`List`、`Button`、`Dialog`、`Tag`、`DownlandOutline`、`UploadOutline`、`useHoldings`、`useTransactions`、`formatMoney` |
| ✅ 新增 | `lotDerivation.test.ts` | 18 个测试覆盖核心批次派生逻辑 |
