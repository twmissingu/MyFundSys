# MyFundSys - 智能基金投资管理系统

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 基于 E大（ETF拯救世界）投资理念的专业基金投资管理工具

## 📋 项目简介

MyFundSys 是一个面向长期投资者的基金管理系统，深度融合 "ETF拯救世界"（E大）的投资哲学，提供：

- 📊 **估值分析** - 全市场估值监控与钻石坑/死亡之顶识别
- 💼 **持仓管理** - 多账户持仓跟踪与动态平衡
- 📝 **交易记录** - 完整的买入/卖出记录与成本分析
- 📚 **知识库** - E大文章归档与投资策略检索
- 🤖 **智能提醒** - 关键节点自动通知

## 🏗️ 项目结构

```
MyFundSys/
├── src/                    # 源代码
│   ├── models/            # 数据模型
│   ├── services/          # 业务服务
│   ├── utils/             # 工具函数
│   └── api/               # API接口
├── data/                   # 数据目录
│   ├── trades/            # 交易记录
│   ├── holdings/          # 持仓数据
│   └── articles/          # E大文章归档
│       ├── chinaetfs/     # 公众号文章
│       ├── qieman/        # 且慢组合
│       └── xueqiu/        # 雪球动态
├── config/                 # 配置文件
├── docs/                   # 文档
├── tests/                  # 测试用例
├── scripts/                # 工具脚本
└── .github/workflows/      # CI/CD工作流
```

## 🚀 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 初始化数据库

```bash
python main.py --init
```

### 启动系统

```bash
python main.py
```

## 📖 核心功能

### 1. 估值体系

基于 E大估值框架，监控以下指标：

| 指标 | 钻石坑 | 合理 | 死亡之顶 |
|------|--------|------|----------|
| 全市场PE | < 25 | ~40 | > 60 |
| 全市场PB | < 2 | ~3 | > 6 |
| 历史百分位 | 0-20% | 40-60% | 80-100% |

### 2. 仓位管理

动态平衡原则：
```
目标仓位 = 100% - 当前估值百分位
```

### 3. 文章归档

自动同步 E大各平台内容：
- 雪球：ETF拯救世界
- 微博：ETF拯救世界 / 二级市场捡辣鸡冠军
- 且慢：长赢指数投资
- 公众号：chinaetfs

## 🔧 配置说明

编辑 `config/config.yaml`：

```yaml
database:
  path: data/fund_system.db

sync:
  github_repo: tw-openclaw/MyFundSys
  auto_sync: true
  sync_interval: 3600  # 秒

notifications:
  diamond_pit_alert: true
  death_top_alert: true
```

## 📝 使用指南

### 记录交易

```python
from src.services.trade_service import TradeService

trade_service = TradeService()
trade_service.record_buy(
    fund_code="510300",
    fund_name="沪深300ETF",
    amount=10000,
    price=3.85,
    date="2026-02-28"
)
```

### 查询持仓

```python
from src.services.holding_service import HoldingService

holding_service = HoldingService()
holdings = holding_service.get_all_holdings()
```

### 估值分析

```python
from src.services.valuation_service import ValuationService

valuation = ValuationService()
market_pe = valuation.get_market_pe()
percentile = valuation.get_historical_percentile()
```

## 🔄 数据同步

系统支持自动同步到 GitHub：

```bash
# 手动触发同步
python scripts/sync_to_github.py

# 查看同步状态
python scripts/sync_status.py
```

## 🧪 测试

```bash
# 运行所有测试
pytest tests/

# 运行特定模块测试
pytest tests/test_valuation.py
```

## 📈 开发计划

- [x] 基础数据模型
- [x] 交易记录管理
- [x] 持仓跟踪
- [x] E大文章归档
- [ ] 估值自动计算
- [ ] 智能提醒系统
- [ ] Web 可视化界面
- [ ] 移动端适配

## 🤝 协作 Agent

| Agent | 职责 | 协作方式 |
|-------|------|----------|
| fund-agent | 基金投资核心 | 主控 |
| research-agent | 市场研究 | 提供研报数据 |
| data-agent | 数据分析 | 估值计算支持 |
| github-agent | 代码维护 | 定时同步 |

## 📜 投资理念

> "估值不会告诉你明天涨还是跌，但它会告诉你哪里安全，哪里危险。"
> —— ETF拯救世界

核心原则：
1. **概率思维** - 追求长期胜率，而非单次正确
2. **估值为锚** - 低估值买入，高估值卖出
3. **仓位管理** - 活着最重要，永远不满仓
4. **资产配置** - 分散投资，降低相关性
5. **逆向投资** - 别人恐惧我贪婪，别人贪婪我恐惧

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

## 🙏 致谢

- [ETF拯救世界](https://xueqiu.com/4771730473) - 投资理念启发
- [且慢](https://qieman.com/) - 长赢指数投资

---

**免责声明**：本系统仅供学习交流，不构成投资建议。投资有风险，入市需谨慎。
