# MyFundSys - 基金投资管理系统

> 基于 E大（ETF拯救世界）投资理念的个人基金投资管理工具

## 🌐 在线访问

**GitHub Pages**: https://twmissingu.github.io/MyFundSys

---

## 📁 项目结构

```
MyFundSys/
├── frontend/               # React 前端应用
│   ├── src/
│   │   ├── components/    # 公共组件
│   │   ├── pages/         # 页面组件
│   │   ├── hooks/         # 自定义Hooks
│   │   ├── lib/           # Supabase客户端配置
│   │   ├── db/            # 类型定义 + Supabase操作
│   │   ├── services/      # API服务
│   │   └── types/         # 类型定义
│   ├── public/            # 静态资源
│   └── package.json
│
├── supabase/               # Supabase配置
│   ├── migrations/        # 数据库迁移脚本
│   └── functions/         # Edge Functions (Deno)
│
├── data/                   # 数据文件
└── docs/                   # 项目文档
```

---

## 🚀 快速开始

### 前端开发

```bash
cd frontend

# 1. 安装依赖
npm install

# 2. 配置环境变量（本地测试）
# 创建 frontend/.env.local，填入测试 Supabase 密钥

# 3. 启动开发服务器
npm run dev
```

### 环境变量

```
frontend/.env          → 生产 Supabase (提交到 Git)
frontend/.env.local    → 测试 Supabase (不提交，本地优先使用)
```

Vite 自动优先读取 `.env.local`，本地开发连接测试环境，部署时自动使用生产配置。

---

## 📋 功能特性

### 核心功能
- 💼 **批次持仓管理** - 每笔买入独立追踪，精确计算盈亏
- 📝 **交易记录** - 完整的买入/卖出记录，支持在途交易
- 🎯 **落袋为安** - 已实现盈亏追踪，胜率统计
- ☁️ **云端存储** - Supabase 存储，支持多设备访问
- 📊 **市场估值** - 全市场PE/PB，颜色分级显示
- 💾 **数据管理** - 导入/导出备份，CSV导出

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
- **框架**: React 18 + TypeScript
- **构建**: Vite
- **UI**: Ant Design Mobile
- **后端**: Supabase (PostgreSQL + Edge Functions)
- **图表**: Recharts

### Edge Functions (Deno)
- **fund-nav** - 基金净值查询
- **fund-search** - 基金搜索（支持后端收费基金映射）
- **fund-history** - 历史净值查询（支持精确日期）

---

## 📚 文档

### 核心文档
- [需求规格书](./docs/archive/SRS.md) - 完整功能需求
- [Session总结](./docs/SESSION_SUMMARY_20260406.md) - 本次改动总结

### 开发文档
- [开发指南](./docs/development/DEVELOPMENT_GUIDE.md) - 开发规范
- [本地测试指南](./docs/development/LOCAL_TEST_GUIDE.md) - 本地环境配置

### 归档文档
- [架构文档](./docs/archive/ARCHITECTURE.md) - 系统设计（已过时）
- [迁移报告](./docs/archive/MIGRATION_REPORT.md) - 历史迁移记录
- [项目总结](./docs/archive/PROJECT_SUMMARY.md) - 历史开发历程

---

## 📄 许可证

MIT License

## 🙏 致谢

- [ETF拯救世界](https://xueqiu.com/4771730473) - 投资理念启发
- [Supabase](https://supabase.com) - 开源后端服务

---

**免责声明**：本系统仅供个人投资管理使用，不构成投资建议。投资有风险，入市需谨慎。
