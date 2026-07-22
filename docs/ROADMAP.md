# ROADMAP.md — 项目路线图

## 已完成（v2.8.0）

- [x] 核心持仓管理（批次派生、卖出匹配、已实现盈亏）
- [x] 基金搜索与自选（东方财富 API 代理）
- [x] 网格策略系统（创建、执行、取消、清算、梯形图）
- [x] 交易记录管理（买入/卖出/在途，筛选/搜索/删除）
- [x] 仪表板（总资产、估值信号、操作卡片）
- [x] 数据导出/导入（CSV、JSON 备份）
- [x] 文章库（E大文章阅读）
- [x] Supabase 集成（Edge Functions 代理东方财富 API）
- [x] 测试套件（531 测试全绿）
- [x] CI/CD（GitHub Actions 自动部署）
- [x] 简单密码认证

## 第二轮对抗性打磨完成（2026-07-05）

- [x] Round 1：修复 C1 CRITICAL——网格卖出对在途买入匹配错误（服务层阻断卖出未确认买入）+ L1（Infinity 份额）
- [x] Round 2：移除遗留 holding 变异函数（updateLocalHoldingAfterTransaction/reverseTransactionOnHolding）+ Tweet 死类型
- [x] Round 3：移除 Reports 伪造收益曲线（Math.random 假数据）
- [x] Round 4：移除 5 个同义反复测试 + useSync 核心纯函数（mapTransaction/enrichHoldingsWithNav）补真实测试
- [x] Round 5：修复 H2 Failure B——留利润底仓未计入已投入（capitalDeployed/baseShares 条件）
- [x] Round 6：修复 H5——超卖静默丢失（getFundAvailableShares 纯函数 + Transactions.tsx 守卫）
- [x] Round 7：安全 + 静默失败补审（429 配额中断，已亲自核实标记疑点无 HIGH）
- [x] Round 8：修复 M4——加载失败静默显示空数据（useHoldings/useTransactions error 状态 + UI 重试）
- [x] Round 9：useRiskMetrics 死字段清理（移除 4 未用返回 + 重复 fetch + 消解 H1）
- [x] 各维度诚实评分 ≥7/10，无 CRITICAL/HIGH 剩余

## 第三轮补全审计完成（2026-07-06）

第二轮"收敛"被证伪——安全/静默失败全量审计（第二轮被 429 中断）发现 4 CRITICAL + 7 HIGH + 11 MEDIUM 静默失败（系统性：Supabase 调用未检查 error 字段）。本轮修复：

- [x] CRITICAL：syncGridOnTransactionDelete / cancelGridExecution fail-open 安全检查→fail-closed（防数据损坏）
- [x] CRITICAL：exportDatabase 静默空备份 / importDatabase FK 清理未检查 error（防数据丢失/损坏）
- [x] HIGH：pending 卖出绕过 H5（processPendingTransactions 确认时补超卖校验）
- [x] HIGH：GridDetail.handleExecute 无 catch（C1 抛错成未处理 rejection）→加 catch + Toast
- [x] HIGH：useGrid NAV 失败兜底 bottom_price→错误买入信号，改 NaN
- [x] HIGH：alertService.resolveAlert 未检查 error + FundDetail.toggleFavorite 未检查 error
- [x] MEDIUM：alertService.createAlert fallback 空 catch→console.warn
- [x] HIGH #8：fetchAlerts/fetchUnresolvedAlertCount 返回 []/0 掩盖错误→改抛出
- [x] HIGH #9：syncService 死代码→移除（syncService.ts + 测试）
- [x] MEDIUM ×11：fundApi fetchFundHistory/searchFunds 返回 []→抛出；FundDetail.loadFundInfo/批次加载未检查 error；Transactions 自动收藏未检查 error；FavoriteFunds.handleRemove 未检查 error + loadHistoryData 空 catch；Holdings 批次视图 NAV→cost 兜底；多处空 catch→console.warn
- [x] 安全：importDatabase 破坏性无确认→加 Dialog.confirm

## 后续迭代

- [x] 测试缺口补齐：cancelGridExecution 状态变更（H-1）、executeGrid remaining_shares 部分卖出（H-2）、M4 useHoldings/useTransactions hook 本体（H-4）、processPendingTransactions 网格回填（H-6）、C1 加固守卫（H-3）、fetchAlerts/fetchFundHistory/searchFunds 错误抛出——已补测试
- [ ] 测试缺口 H-5：H5 Transactions.tsx UI 守卫需组件测试（服务层守卫已测，UI 守卫为 defense-in-depth）——defer
- [ ] H2 Failure A：deriveGridStatuses 同层二次买入（buy→sell→re-buy）不可见——需把 `.find()` 改为聚合多 execution
- [ ] backtest.ts：未接入 UI 的半成品愿景功能（VISION 核心价值"回测"）——补 UI 或移除待业务确认
- [ ] CSV 公式注入缓解加固：导出对 `=`/`@`/`+` 开头单元格改为前缀 `'`（当前仅引号包裹，不足以阻 Excel 公式执行）——LOW
- [ ] Edge Function pageIndex/pageSize 数值校验——LOW
- [ ] 全局状态管理 / 页面间数据同步
- [ ] 大数据量分页
- [ ] 离线模式
- [ ] 组件级测试覆盖（pages/components）
- [ ] 正式 CHANGELOG
- [ ] *WithHoldingUpdate 函数名纠正（已不更新 holdings 表，名实不符）——涉及多调用方，谨慎重命名
- [ ] 安全/静默失败全量重审（配额恢复后补做完整对抗审计）

## 当前状态

v2.8.0，第二轮对抗性打磨收敛。7 维度均 ≥7，531 测试全绿，构建通过。核心业务逻辑（lot 派生、卖出匹配、在途处理、网格执行）经对抗审查修复了 1 个 CRITICAL + 2 个 HIGH 真实缺陷。剩余项均为 LOW/MEDIUM 或需业务决策。
