# MyFundSys 开发文档

## 架构设计

### 数据流

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  数据采集器  │────▶│  数据服务   │────▶│   数据库    │
│ Collectors  │     │  Services   │     │  SQLite     │
└─────────────┘     └─────────────┘     └─────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │  GitHub同步 │
                     │    Sync     │
                     └─────────────┘
```

### 模块说明

#### models/
数据模型定义
- `fund.py` - 基金基础信息
- `trade.py` - 交易记录
- `holding.py` - 持仓数据
- `valuation.py` - 估值数据

#### services/
业务服务层
- `database_service.py` - 数据库操作
- `trade_service.py` - 交易管理
- `holding_service.py` - 持仓管理
- `valuation_service.py` - 估值计算
- `sync_service.py` - 数据同步

#### utils/
工具函数
- `date_utils.py` - 日期处理
- `calc_utils.py` - 计算工具
- `file_utils.py` - 文件操作

## API 设计

### 交易接口

```python
POST /api/trades
{
    "fund_code": "510300",
    "fund_name": "沪深300ETF",
    "type": "buy",
    "amount": 10000,
    "price": 3.85,
    "date": "2026-02-28",
    "account": "main"
}
```

### 持仓查询

```python
GET /api/holdings
Response:
{
    "holdings": [
        {
            "fund_code": "510300",
            "fund_name": "沪深300ETF",
            "shares": 1000,
            "avg_cost": 3.85,
            "current_value": 3850
        }
    ],
    "total_value": 3850
}
```

### 估值查询

```python
GET /api/valuation
Response:
{
    "market_pe": 38.5,
    "market_pb": 3.2,
    "percentile": 0.45,
    "status": "reasonable"
}
```

## 数据模型

### 基金表 (funds)

| 字段 | 类型 | 说明 |
|------|------|------|
| code | TEXT PK | 基金代码 |
| name | TEXT | 基金名称 |
| category | TEXT | 分类 |
| benchmark | TEXT | 业绩基准 |

### 交易表 (trades)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增ID |
| fund_code | TEXT FK | 基金代码 |
| type | TEXT | buy/sell |
| amount | REAL | 金额 |
| price | REAL | 价格 |
| shares | REAL | 份额 |
| date | DATE | 交易日期 |
| account | TEXT | 账户 |

### 持仓表 (holdings)

| 字段 | 类型 | 说明 |
|------|------|------|
| fund_code | TEXT PK | 基金代码 |
| shares | REAL | 持有份额 |
| avg_cost | REAL | 平均成本 |
| account | TEXT | 账户 |

## 定时任务

| 任务 | 频率 | 说明 |
|------|------|------|
| 数据同步 | 每小时 | 同步到GitHub |
| 估值更新 | 每天 | 更新市场估值 |
| 文章采集 | 每6小时 | 采集E大文章 |
| 数据备份 | 每天 | 本地备份 |

## 扩展指南

### 添加新的数据源

1. 在 `src/collectors/` 创建采集器
2. 实现 `collect()` 方法
3. 在配置中启用

### 添加新的指标

1. 在 `src/models/` 定义模型
2. 在 `src/services/` 实现计算
3. 更新 API 接口

## 测试策略

```bash
# 单元测试
pytest tests/unit/

# 集成测试
pytest tests/integration/

# 覆盖率
pytest --cov=src tests/
```
