# MyFundSys 项目简介

## 📊 项目概述

**MyFundSys** 是基于 **E大（ETF拯救世界）投资理念**的专业基金投资管理工具，帮助用户跟踪持仓、分析收益、学习投资理念。

**在线访问**: https://twmissingu.github.io/MyFundSys

---

## 🎯 核心功能

### 💼 投资管理
- **95只ETF基金** - 涵盖A股宽基、行业、港股、美股、商品、债券
- **持仓跟踪** - 实时计算持仓市值和盈亏
- **交易记录** - 完整的买入/卖出记录管理

### ☁️ 云同步 (v2.1.0新特性)
- **跨设备实时同步** - 持仓和交易数据自动同步
- **安全身份验证** - 邮箱/密码登录，数据隔离
- **云端自动备份** - 不再担心数据丢失

### 📚 E大投资理念
- **E大文章库** - 962条投资理念文章归档
- **估值策略** - 基于PE/PB的估值体系
- **策略回测** - 历史数据验证策略效果

---

## 🏗️ 技术架构

### 前端 (React + TypeScript)
```
frontend/
├── React 18 + TypeScript
├── Vite 构建工具
├── Ant Design Mobile UI
├── Supabase 后端服务
├── IndexedDB 本地存储
└── Recharts 图表库
```

### 后端 (Python CLI)
```
backend/
├── Flask + SQLAlchemy
├── SQLite 数据库
├── APScheduler 定时任务
└── Click + Rich CLI框架
```

---

## 📁 项目结构

```
MyFundSys/
├── frontend/          # React前端应用
├── backend/           # Python后端服务
├── supabase/          # Supabase配置和迁移
├── data/              # 数据文件
├── scripts/           # 工具脚本
└── .github/workflows/ # CI/CD配置
```

---

## 🚀 最新更新 (2026-03-13)

| 提交 | 说明 |
|------|------|
| 96cb5af | fix: GitHub Pages 环境历史净值 API 支持 |
| 33c58df | fix: GitHub Pages 环境基金搜索支持 |
| b92a37a | chore: 添加搜索调试日志 |
| 211af0a | fix: 修复 Vercel API 路由配置 |
| 542a93c | fix: 生产环境基金搜索支持 |

---

## 🎯 E大估值体系

| 指标 | 钻石坑 | 合理 | 死亡之顶 |
|------|--------|------|----------|
| 全市场PE | < 25 | ~40 | > 60 |
| 全市场PB | < 2 | ~3 | > 6 |
| 历史百分位 | 0-20% | 40-60% | 80-100% |

> "估值不会告诉你明天涨还是跌，但它会告诉你哪里安全，哪里危险。" —— ETF拯救世界

---

## 📊 项目状态

- **版本**: v2.1.0
- **状态**: 运营中
- **部署**: GitHub Pages + Supabase
- **CI/CD**: GitHub Actions

---

## 💡 与Liars Game的协同

两个项目可以共享：
- DevOps Agent的CI/CD经验
- GitHub Agent的版本管理
- 前端技术栈（React + TypeScript）

---

*项目简介生成时间: 2026-03-13*
*生成人: 灵犀*
