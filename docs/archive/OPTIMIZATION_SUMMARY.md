# MyFundSys 优化总结 - 方案B

## ✅ 已完成的优化

### 1. 离线优先架构 (Offline-First)

**核心特性：**
- 所有读写操作先在 **IndexedDB** 本地完成
- 网络可用时自动同步到 **Supabase** 云端
- 离线时可正常使用，恢复网络后自动同步

**文件变更：**
- `frontend/src/services/syncService.ts` (新增) - 核心同步服务
- `frontend/src/hooks/useSync.ts` (新增) - 同步相关 Hooks
- `frontend/src/db/index.ts` - 增加 syncQueue 表结构

**使用方式：**
```typescript
// 自动处理同步
const { holdings, addHolding } = useHoldings();
await addHolding(newHolding); // 自动同步到云端

// 手动触发同步
const { triggerSync, triggerFullSync } = useSyncStatus();
await triggerSync(); // 增量同步
await triggerFullSync(); // 全量同步
```

---

### 2. 网络状态检测

**特性：**
- 实时监测网络连接状态
- 离线/在线状态可视化
- 恢复网络后自动同步

**状态显示：**
- 顶部状态栏显示在线/离线状态
- 显示上次同步时间
- 显示待同步数据数量

---

### 3. 定时任务预留接口

**文件：** `frontend/src/services/schedulerService.ts`

**预设任务：**
| 任务名 | 类型 | 默认调度 | 说明 |
|--------|------|----------|------|
| 自动抓取净值 | fetch_nav | 工作日 18:00 | 抓取基金最新净值 |
| 生成日报 | generate_report | 工作日 19:00 | 生成投资日报 |
| 飞书推送 | feishu_notify | 工作日 19:00 | 推送日报到飞书 |

**重要提示：**
> 浏览器环境无法真正运行定时任务，此功能需要后端支持。
> 当前版本可以：
> - 配置任务开关
> - 手动触发执行（测试用）
> - 查看执行历史

**后端实现参考（Python）：**
```python
# 使用 APScheduler 实现定时任务
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()
scheduler.add_job(fetch_nav, 'cron', hour=18, minute=0, day_of_week='mon-fri')
scheduler.add_job(generate_daily_report, 'cron', hour=19, minute=0, day_of_week='mon-fri')
scheduler.start()
```

---

### 4. 飞书推送功能

**文件：** `frontend/src/services/feishuService.ts`

**功能：**
- 配置飞书机器人 Webhook
- 支持签名验证（安全）
- 多种消息模板：
  - 纯文本消息
  - 富文本消息
  - 交互式卡片（投资日报）

**使用方式：**

1. **在飞书群中添加机器人：**
   - 群设置 → 群机器人 → 添加自定义机器人
   - 复制 Webhook URL

2. **在系统设置中配置：**
   - 进入"设置" → "飞书推送"
   - 粘贴 Webhook URL
   - 选择要接收的通知类型

3. **手动发送消息：**
```typescript
import { sendTransactionNotification, sendDailySummary } from './services/feishuService';

// 交易提醒
await sendTransactionNotification('buy', '沪深300ETF', 10000);

// 日报推送
await sendDailySummary({
  date: '2024-01-01',
  totalAssets: 100000,
  dailyProfit: 1000,
  dailyProfitRate: 0.01,
  holdingsCount: 5,
  topHoldings: [{ name: '沪深300ETF', profitRate: 0.02 }],
  marketSentiment: '中性',
});
```

---

### 5. 设置页面更新

**新增功能：**
- 数据同步状态卡片
  - 在线/离线状态
  - 上次同步时间
  - 待同步数据数量
  - 手动同步按钮

- 定时任务管理
  - 任务开关
  - 下次执行时间
  - 手动执行按钮
  - 执行历史

- 飞书推送配置
  - Webhook 设置
  - 签名密钥
  - 通知类型选择
  - 连接测试

---

## 📁 新增/修改的文件清单

### 新增文件
```
frontend/src/services/
├── syncService.ts      # 数据同步服务
├── schedulerService.ts # 定时任务服务
└── feishuService.ts    # 飞书推送服务

frontend/src/hooks/
└── useSync.ts          # 同步相关 Hooks
```

### 修改文件
```
frontend/src/
├── db/index.ts         # 增加 syncQueue、scheduledTasks、feishuConfig 表
├── pages/
│   ├── Layout.tsx      # 更新状态栏，使用 useSyncStatus
│   ├── Settings.tsx    # 新增同步、任务、飞书配置
│   ├── Holdings.tsx    # 导入改为 useSync
│   ├── Transactions.tsx # 导入改为 useSync
│   ├── FundList.tsx    # 导入改为 useSync
│   ├── FundDetail.tsx  # 导入改为 useSync
│   ├── Dashboard.tsx   # 导入改为 useSync
│   └── Strategy.tsx    # 导入改为 useSync
└── hooks/
    └── useSupabase.ts  # 保留但不推荐使用
```

---

## 🚀 部署步骤

### 1. 配置 Supabase（数据同步）

**数据库迁移：**
```sql
-- 执行 003_remove_auth_simplified.sql
-- 移除 user_id 字段，允许公开访问
```

**前端环境变量：**
```bash
cd frontend
cp .env.example .env
# 编辑 .env 填入 Supabase 凭证
```

### 2. 配置飞书推送（可选）

1. 创建飞书群
2. 添加自定义机器人
3. 复制 Webhook URL
4. 在系统设置中配置

### 3. 部署后端定时任务（可选）

如果需要真正的定时任务，需要部署后端服务：

**方案A：Python + APScheduler**
```python
# backend/scheduler.py
from apscheduler.schedulers.background import BackgroundScheduler
import requests

def fetch_nav():
    """抓取基金净值"""
    # 调用天天基金/雪球 API
    pass

def generate_report():
    """生成日报"""
    pass

def send_feishu():
    """发送飞书推送"""
    pass

scheduler = BackgroundScheduler()
scheduler.add_job(fetch_nav, 'cron', hour=18, minute=0)
scheduler.add_job(generate_report, 'cron', hour=19, minute=0)
scheduler.add_job(send_feishu, 'cron', hour=19, minute=0)
scheduler.start()
```

**方案B：使用云函数**
- Vercel Cron Jobs
- AWS Lambda + EventBridge
- 阿里云函数计算

---

## 📱 多端同步说明

### 首次使用新设备
1. 输入密码登录（使用你在环境变量中设置的密码）
2. 系统自动从云端拉取数据
3. 离线时自动使用本地数据

### 数据冲突处理
当前策略：**最后写入者胜出**
- 云端数据为最新
- 本地修改优先上传到云端
- 建议不要同时在多个设备上编辑

### 数据安全
- 本地数据保存在浏览器 IndexedDB
- 云端数据保存在 Supabase
- 定期导出备份（设置 → 导出数据）

---

## 🔮 后续优化建议

### 高优先级
1. **自动净值更新** - 接入天天基金/雪球 API
2. **真实定时任务** - 部署后端服务
3. **数据冲突提示** - 当检测到冲突时提醒用户

### 中优先级
1. **PWA 支持** - 可添加到主屏幕，离线使用
2. **图表优化** - 真实历史收益曲线
3. **批量导入** - 支持从 Excel 导入交易记录

### 低优先级
1. **多语言支持**
2. **暗黑模式**
3. **指纹/面容识别登录**

---

## ❓ 常见问题

### Q: 离线时添加的数据会丢失吗？
A: 不会。数据会先保存在本地 IndexedDB，恢复网络后自动同步到云端。

### Q: 可以在多台设备上同时使用吗？
A: 可以。但建议不要同时编辑，以免产生数据冲突。

### Q: 定时任务为什么不自动执行？
A: 浏览器环境无法运行定时任务。需要部署后端服务，或使用系统自带的提醒功能手动触发。

### Q: 飞书推送为什么收不到？
A: 请检查：
1. Webhook URL 是否正确
2. 是否启用了推送
3. 通知类型是否勾选
4. 点击"测试连接"查看错误信息

---

## 📞 技术支持

如有问题，请检查：
1. 浏览器控制台错误信息
2. Supabase 连接状态
3. 网络连接状态
4. 数据同步状态

**版本:** v2.2.0  
**更新日期:** 2024-03-08
