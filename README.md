# MyFundSys - 智能基金投资管理系统

[![Deploy to GitHub Pages](https://github.com/twmissingu/MyFundSys/actions/workflows/deploy.yml/badge.svg)](https://github.com/twmissingu/MyFundSys/actions/workflows/deploy.yml)
[![Sync to GitHub](https://github.com/twmissingu/MyFundSys/actions/workflows/sync.yml/badge.svg)](https://github.com/twmissingu/MyFundSys/actions/workflows/sync.yml)

> 基于 E大（ETF拯救世界）投资理念的专业基金投资管理工具

## 🌐 在线访问

**GitHub Pages**: https://twmissingu.github.io/MyFundSys

---

## ✨ 新特性：云同步支持 (v2.1.0)

🎉 **现已支持 Supabase 云同步！**

- ☁️ **跨设备实时同步** - 持仓和交易数据自动同步到所有设备
- 🔐 **安全身份验证** - 邮箱/密码登录，数据隔离保护
- ⚡ **实时更新** - 多设备同时使用时数据实时同步
- 💾 **数据备份** - 云端自动备份，不再担心数据丢失

查看 [Supabase 迁移文档](./SUPABASE_MIGRATION.md) 和 [部署说明](./DEPLOYMENT.md) 了解详情。

---

## 📁 项目结构

```
MyFundSys/
├── frontend/               # React 前端应用
│   ├── src/
│   │   ├── components/    # 公共组件
│   │   ├── pages/         # 页面组件
│   │   ├── hooks/         # 自定义Hooks (含Supabase)
│   │   ├── lib/           # Supabase客户端配置
│   │   ├── db/            # IndexedDB本地存储 (向后兼容)
│   │   ├── services/      # API服务
│   │   └── types/         # 类型定义
│   ├── public/            # 静态资源
│   └── package.json
│
├── supabase/               # Supabase配置
│   └── migrations/        # 数据库迁移脚本
│
├── backend/                # Python 后端服务
│   ├── cli_main.py        # CLI主程序
│   └── src/
│
├── data/                   # 数据文件
├── scripts/                # 工具脚本
└── .github/workflows/      # CI/CD配置
```

---

## 🚀 快速开始

### 前端（React + TypeScript + Supabase）

```bash
cd frontend

# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填入 Supabase 凭证

# 3. 启动开发服务器
npm run dev
```

### Supabase 配置

1. 在 [Supabase](https://supabase.com) 创建项目
2. 执行 `supabase/migrations/001_initial_schema.sql`
3. 执行 `supabase/migrations/002_seed_data.sql`
4. 获取 Project URL 和 Anon Key

详细步骤见 [部署说明](./DEPLOYMENT.md)

### 后端（Python CLI）

```bash
# 安装依赖
pip install -r requirements.txt

# 初始化数据库
cd backend
python cli_main.py init

# 查看持仓
python cli_main.py holding

# 收益分析
python cli_main.py profit
```

---

## 📋 功能特性

### 前端功能
- 📊 **95只ETF基金** - 涵盖A股宽基、行业、港股、美股、商品、债券
- 💼 **持仓跟踪** - 实时计算持仓市值和盈亏
- 📝 **交易记录** - 完整的买入/卖出记录
- ☁️ **云同步** - Supabase实时同步，跨设备访问
- 🔐 **用户认证** - 邮箱/密码登录，数据安全隔离
- 📚 **E大文章库** - 投资理念文章归档，支持搜索
- 🎯 **投资策略** - 估值策略、定投策略、网格策略
- 📊 **策略回测** - 历史数据验证策略效果
- 💾 **数据管理** - 支持导入/导出备份

### 后端功能（CLI + API）
- 📈 **收益分析** - 持仓收益、盈亏比例、收益率计算
- 📄 **报告生成** - 日报、周报、导出CSV/JSON
- ⏰ **定时任务** - 自动净值更新、日报生成
- 💾 **数据备份** - 自动/手动数据库备份
- 🔍 **估值分析** - 全市场PE/PB计算、历史百分位

---

## 🎯 E大投资理念

> "估值不会告诉你明天涨还是跌，但它会告诉你哪里安全，哪里危险。"
> —— ETF拯救世界

### 估值体系
| 指标 | 钻石坑 | 合理 | 死亡之顶 |
|------|--------|------|----------|
| 全市场PE | < 25 | ~40 | > 60 |
| 全市场PB | < 2 | ~3 | > 6 |
| 历史百分位 | 0-20% | 40-60% | 80-100% |

---

## 🏗️ 技术栈

### 前端
- **框架**: React 18 + TypeScript
- **构建**: Vite
- **UI**: Ant Design Mobile
- **后端**: Supabase (PostgreSQL + Realtime)
- **存储**: IndexedDB (本地备用)
- **图表**: Recharts

### 后端
- **框架**: Flask + SQLAlchemy
- **数据库**: SQLite
- **任务调度**: APScheduler
- **CLI**: Click + Rich

---

## 📚 文档

- [Supabase 迁移文档](./SUPABASE_MIGRATION.md) - 详细迁移指南
- [部署说明](./DEPLOYMENT.md) - 生产部署步骤
- [迁移报告](./MIGRATION_REPORT.md) - 技术实现详情

---

## 📄 许可证

MIT License

## 🙏 致谢

- [ETF拯救世界](https://xueqiu.com/4771730473) - 投资理念启发
- [且慢](https://qieman.com/) - 长赢指数投资
- [Supabase](https://supabase.com) - 开源后端服务

---

**免责声明**：本系统仅供学习交流，不构成投资建议。投资有风险，入市需谨慎。
