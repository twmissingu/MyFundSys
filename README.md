# MyFundSys - 智能基金投资管理系统

[![Deploy to GitHub Pages](https://github.com/twmissingu/MyFundSys/actions/workflows/deploy.yml/badge.svg)](https://github.com/twmissingu/MyFundSys/actions/workflows/deploy.yml)
[![Sync to GitHub](https://github.com/twmissingu/MyFundSys/actions/workflows/sync.yml/badge.svg)](https://github.com/twmissingu/MyFundSys/actions/workflows/sync.yml)

> 基于 E大（ETF拯救世界）投资理念的专业基金投资管理工具

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
│   │   ├── db/            # IndexedDB数据库
│   │   ├── services/      # API服务
│   │   └── types/         # 类型定义
│   ├── public/            # 静态资源
│   └── package.json
│
├── backend/                # Python 后端服务
│   ├── cli_main.py        # CLI主程序（来自fund-system）
│   ├── src/
│   │   ├── core/          # 核心模块（数据库、模型、配置）
│   │   ├── trade/         # 交易模块（买入/卖出/计算）
│   │   ├── analysis/      # 分析模块（收益/估值/报告）
│   │   ├── cli/           # 交互式CLI
│   │   ├── tasks/         # 定时任务调度
│   │   └── utils/         # 工具函数
│   └── tests/             # 测试用例
│
├── api/                    # API接口模块
├── data/                   # 数据文件
│   ├── articles/          # E大文章
│   └── fund_list.csv      # 基金列表
├── scripts/                # 工具脚本
└── .github/workflows/      # CI/CD配置
```

---

## 🚀 快速开始

### 前端（React + TypeScript）

```bash
cd frontend
npm install
npm run dev      # 开发模式
npm run build    # 构建生产版本
```

### 后端（Python CLI）

```bash
# 安装依赖
pip install -r requirements.txt

# 初始化数据库
cd backend
python cli_main.py init

# 导入基金数据
python cli_main.py import-funds ../data/fund_list.csv

# 查看持仓
python cli_main.py holding

# 收益分析
python cli_main.py profit

# 启动API服务
python cli_main.py server --host 0.0.0.0 --port 5000
```

---

## 📋 功能特性

### 前端功能
- 📊 **95只ETF基金** - 涵盖A股宽基、行业、港股、美股、商品、债券
- 💼 **持仓跟踪** - 实时计算持仓市值和盈亏
- 📝 **交易记录** - 完整的买入/卖出记录
- 📚 **E大文章库** - 投资理念文章归档，支持搜索
- 🎯 **投资策略** - 估值策略、定投策略、网格策略
- 📊 **策略回测** - 历史数据验证策略效果
- 💾 **本地存储** - IndexedDB本地存储，支持导入/导出

### 后端功能（CLI + API）
- 📈 **收益分析** - 持仓收益、盈亏比例、收益率计算
- 📄 **报告生成** - 日报、周报、导出CSV/JSON
- ⏰ **定时任务** - 自动净值更新、日报生成
- 💾 **数据备份** - 自动/手动数据库备份
- 🔍 **估值分析** - 全市场PE/PB计算、历史百分位
- 🔄 **数据同步** - 自动同步到GitHub

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

## 🔧 CLI 命令参考

```bash
# 系统管理
python cli_main.py init                    # 初始化数据库
python cli_main.py status                  # 查看系统状态

# 基金管理
python cli_main.py fund list               # 列出所有基金
python cli_main.py fund search <关键词>     # 搜索基金
python cli_main.py import-funds <文件>      # 导入基金列表

# 交易管理
python cli_main.py trade buy               # 记录买入
python cli_main.py trade sell              # 记录卖出
python cli_main.py trade list              # 查看交易记录

# 持仓与收益
python cli_main.py holding                 # 查看当前持仓
python cli_main.py profit                  # 收益分析
python cli_main.py profit --fund <代码>     # 单只基金收益

# 报告与导出
python cli_main.py report daily            # 生成日报
python cli_main.py report weekly           # 生成周报
python cli_main.py export --format csv     # 导出CSV
python cli_main.py export --format json    # 导出JSON

# 数据同步
python cli_main.py sync                    # 手动同步到GitHub
python cli_main.py backup                  # 备份数据库

# 服务启动
python cli_main.py server                  # 启动API服务
python cli_main.py scheduler               # 启动定时任务
python cli_main.py cli                     # 交互式命令行
```

---

## 🏗️ 技术栈

### 前端
- **框架**: React 18 + TypeScript
- **构建**: Vite
- **UI**: Ant Design Mobile
- **存储**: IndexedDB (Dexie.js)
- **图表**: Recharts

### 后端
- **框架**: Flask + SQLAlchemy
- **数据库**: SQLite
- **任务调度**: APScheduler
- **CLI**: Click + Rich
- **测试**: Pytest

---

## 📈 开发计划

- [x] 前端基础框架
- [x] 95只基金数据
- [x] 持仓管理
- [x] 交易记录
- [x] E大文章库
- [x] 投资策略 + 回测
- [x] Python CLI 后端（已合并fund-system）
- [x] 收益分析模块
- [x] 报告生成
- [x] 定时任务
- [ ] 实时净值API对接
- [ ] 前端与后端API联调
- [ ] 定投计划提醒

---

## 📄 许可证

MIT License

## 🙏 致谢

- [ETF拯救世界](https://xueqiu.com/4771730473) - 投资理念启发
- [且慢](https://qieman.com/) - 长赢指数投资

---

**免责声明**：本系统仅供学习交流，不构成投资建议。投资有风险，入市需谨慎。
