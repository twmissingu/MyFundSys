# 基金系统 - 数据模型设计文档

## 1. 概述

本文档定义基金系统的数据模型，包括基金基础信息、交易记录、持仓快照和估值数据四个核心实体。

---

## 2. ER图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              基金系统数据模型 ER图                                │
└─────────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────┐         ┌──────────────────┐
    │   fund_basic     │         │  fund_valuation  │
    │   (基金基础信息)  │◄────────│   (估值数据)      │
    └────────┬─────────┘   1:N   └──────────────────┘
             │
             │ 1:N
             ▼
    ┌──────────────────┐         ┌──────────────────┐
    │  trade_record    │         │ position_snapshot│
    │   (交易记录)      │         │   (持仓快照)      │
    └──────────────────┘         └──────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────┐
│                              实体关系详细说明                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

fund_basic (1) ────────────────────────► (N) trade_record
    一只基金可以有多次交易记录

fund_basic (1) ────────────────────────► (N) position_snapshot
    一只基金可以有多个日期的持仓快照

fund_basic (1) ────────────────────────► (N) fund_valuation
    一只基金可以有多个日期的估值数据
```

---

## 3. 实体定义

### 3.1 fund_basic - 基金基础信息

存储基金的基本属性信息。

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| fund_code | VARCHAR(10) | PK | 基金代码，主键 |
| fund_name | VARCHAR(100) | Y | 基金名称 |
| fund_type | VARCHAR(20) | Y | 基金类型：股票型/债券型/混合型/指数型/QDII/商品型/货币型 |
| market_type | VARCHAR(20) | Y | 市场类型：A股/港股/美股/债券/商品/海外/混合 |
| sector | VARCHAR(50) | N | 行业分类：科技/消费/医药/金融/能源/制造/综合等 |
| benchmark | VARCHAR(100) | N | 业绩比较基准 |
| manager | VARCHAR(50) | N | 基金经理 |
| company | VARCHAR(50) | N | 基金公司 |
| establish_date | DATE | N | 成立日期 |
| fee_rate | DECIMAL(5,4) | N | 管理费率 |
| created_at | TIMESTAMP | Y | 创建时间 |
| updated_at | TIMESTAMP | Y | 更新时间 |

**索引：**
- PRIMARY KEY (fund_code)
- INDEX idx_fund_type (fund_type)
- INDEX idx_market_type (market_type)
- INDEX idx_sector (sector)

---

### 3.2 trade_record - 交易记录

记录每次基金交易的详细信息。

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | BIGINT | PK | 自增主键 |
| trade_date | DATE | Y | 交易日期 |
| fund_code | VARCHAR(10) | FK | 基金代码，外键关联fund_basic |
| trade_type | TINYINT | Y | 交易类型：1=买入, 2=卖出 |
| amount | DECIMAL(18,4) | Y | 交易金额（元） |
| shares | DECIMAL(18,4) | Y | 交易份额 |
| nav | DECIMAL(10,6) | Y | 交易净值 |
| fee | DECIMAL(18,4) | Y | 手续费 |
| platform | VARCHAR(20) | N | 交易平台：支付宝/天天基金/银行/券商等 |
| remark | VARCHAR(200) | N | 备注 |
| created_at | TIMESTAMP | Y | 创建时间 |

**索引：**
- PRIMARY KEY (id)
- INDEX idx_fund_code (fund_code)
- INDEX idx_trade_date (trade_date)
- INDEX idx_fund_date (fund_code, trade_date)
- FOREIGN KEY (fund_code) REFERENCES fund_basic(fund_code)

---

### 3.3 position_snapshot - 持仓快照

记录每日持仓状态，用于收益计算和历史回溯。

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | BIGINT | PK | 自增主键 |
| snapshot_date | DATE | Y | 快照日期 |
| fund_code | VARCHAR(10) | FK | 基金代码，外键关联fund_basic |
| holding_shares | DECIMAL(18,4) | Y | 持仓份额 |
| cost_basis | DECIMAL(18,4) | Y | 持仓成本（元） |
| market_value | DECIMAL(18,4) | Y | 市值（元） |
| total_return | DECIMAL(18,4) | Y | 累计收益（元） |
| return_rate | DECIMAL(10,4) | Y | 收益率（%） |
| avg_cost | DECIMAL(10,6) | Y | 平均成本净值 |
| current_nav | DECIMAL(10,6) | Y | 当前净值 |
| created_at | TIMESTAMP | Y | 创建时间 |

**索引：**
- PRIMARY KEY (id)
- UNIQUE KEY uk_fund_date (fund_code, snapshot_date)
- INDEX idx_snapshot_date (snapshot_date)
- FOREIGN KEY (fund_code) REFERENCES fund_basic(fund_code)

---

### 3.4 fund_valuation - 估值数据

存储基金的估值指标，用于投资决策参考。

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | BIGINT | PK | 自增主键 |
| valuation_date | DATE | Y | 估值日期 |
| fund_code | VARCHAR(10) | FK | 基金代码，外键关联fund_basic |
| pe | DECIMAL(10,4) | N | 市盈率PE |
| pb | DECIMAL(10,4) | N | 市净率PB |
| pe_percentile | DECIMAL(5,4) | N | PE百分位（0-1） |
| pb_percentile | DECIMAL(5,4) | N | PB百分位（0-1） |
| roe | DECIMAL(5,4) | N | 净资产收益率 |
| dividend_yield | DECIMAL(5,4) | N | 股息率 |
| valuation_level | TINYINT | N | 估值等级：1=低估, 2=合理, 3=高估 |
| data_source | VARCHAR(20) | N | 数据来源：理杏仁/乌龟量化/蛋卷等 |
| created_at | TIMESTAMP | Y | 创建时间 |

**索引：**
- PRIMARY KEY (id)
- UNIQUE KEY uk_fund_date (fund_code, valuation_date)
- INDEX idx_valuation_date (valuation_date)
- INDEX idx_valuation_level (valuation_level)
- FOREIGN KEY (fund_code) REFERENCES fund_basic(fund_code)

---

## 4. 数据字典

### 4.1 枚举值定义

#### fund_type (基金类型)
| 值 | 说明 |
|----|------|
| stock | 股票型 |
| bond | 债券型 |
| hybrid | 混合型 |
| index | 指数型 |
| qdii | QDII |
| commodity | 商品型 |
| money | 货币型 |

#### market_type (市场类型)
| 值 | 说明 |
|----|------|
| a_share | A股 |
| hk_stock | 港股 |
| us_stock | 美股 |
| bond | 债券 |
| commodity | 商品 |
| overseas | 海外 |
| mixed | 混合 |

#### trade_type (交易类型)
| 值 | 说明 |
|----|------|
| 1 | 买入 |
| 2 | 卖出 |

#### valuation_level (估值等级)
| 值 | 说明 | PE百分位参考 |
|----|------|-------------|
| 1 | 低估 | < 30% |
| 2 | 合理 | 30% - 70% |
| 3 | 高估 | > 70% |

#### sector (行业分类)
| 值 | 说明 |
|----|------|
| technology | 科技/互联网 |
| consumer | 消费 |
| healthcare | 医药/医疗 |
| finance | 金融/银行/保险 |
| energy | 能源/原材料 |
| manufacturing | 制造/工业 |
| reits | REITs/房地产 |
| comprehensive | 综合/宽基 |

---

## 5. SQL建表语句

```sql
-- 基金基础信息表
CREATE TABLE fund_basic (
    fund_code VARCHAR(10) PRIMARY KEY COMMENT '基金代码',
    fund_name VARCHAR(100) NOT NULL COMMENT '基金名称',
    fund_type VARCHAR(20) NOT NULL COMMENT '基金类型',
    market_type VARCHAR(20) NOT NULL COMMENT '市场类型',
    sector VARCHAR(50) COMMENT '行业分类',
    benchmark VARCHAR(100) COMMENT '业绩比较基准',
    manager VARCHAR(50) COMMENT '基金经理',
    company VARCHAR(50) COMMENT '基金公司',
    establish_date DATE COMMENT '成立日期',
    fee_rate DECIMAL(5,4) COMMENT '管理费率',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_fund_type (fund_type),
    INDEX idx_market_type (market_type),
    INDEX idx_sector (sector)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='基金基础信息表';

-- 交易记录表
CREATE TABLE trade_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    trade_date DATE NOT NULL COMMENT '交易日期',
    fund_code VARCHAR(10) NOT NULL COMMENT '基金代码',
    trade_type TINYINT NOT NULL COMMENT '交易类型：1=买入, 2=卖出',
    amount DECIMAL(18,4) NOT NULL COMMENT '交易金额（元）',
    shares DECIMAL(18,4) NOT NULL COMMENT '交易份额',
    nav DECIMAL(10,6) NOT NULL COMMENT '交易净值',
    fee DECIMAL(18,4) NOT NULL COMMENT '手续费',
    platform VARCHAR(20) COMMENT '交易平台',
    remark VARCHAR(200) COMMENT '备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_fund_code (fund_code),
    INDEX idx_trade_date (trade_date),
    INDEX idx_fund_date (fund_code, trade_date),
    FOREIGN KEY (fund_code) REFERENCES fund_basic(fund_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='交易记录表';

-- 持仓快照表
CREATE TABLE position_snapshot (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    snapshot_date DATE NOT NULL COMMENT '快照日期',
    fund_code VARCHAR(10) NOT NULL COMMENT '基金代码',
    holding_shares DECIMAL(18,4) NOT NULL COMMENT '持仓份额',
    cost_basis DECIMAL(18,4) NOT NULL COMMENT '持仓成本（元）',
    market_value DECIMAL(18,4) NOT NULL COMMENT '市值（元）',
    total_return DECIMAL(18,4) NOT NULL COMMENT '累计收益（元）',
    return_rate DECIMAL(10,4) NOT NULL COMMENT '收益率（%）',
    avg_cost DECIMAL(10,6) NOT NULL COMMENT '平均成本净值',
    current_nav DECIMAL(10,6) NOT NULL COMMENT '当前净值',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    UNIQUE KEY uk_fund_date (fund_code, snapshot_date),
    INDEX idx_snapshot_date (snapshot_date),
    FOREIGN KEY (fund_code) REFERENCES fund_basic(fund_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='持仓快照表';

-- 估值数据表
CREATE TABLE fund_valuation (
    id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
    valuation_date DATE NOT NULL COMMENT '估值日期',
    fund_code VARCHAR(10) NOT NULL COMMENT '基金代码',
    pe DECIMAL(10,4) COMMENT '市盈率PE',
    pb DECIMAL(10,4) COMMENT '市净率PB',
    pe_percentile DECIMAL(5,4) COMMENT 'PE百分位（0-1）',
    pb_percentile DECIMAL(5,4) COMMENT 'PB百分位（0-1）',
    roe DECIMAL(5,4) COMMENT '净资产收益率',
    dividend_yield DECIMAL(5,4) COMMENT '股息率',
    valuation_level TINYINT COMMENT '估值等级：1=低估, 2=合理, 3=高估',
    data_source VARCHAR(20) COMMENT '数据来源',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    UNIQUE KEY uk_fund_date (fund_code, valuation_date),
    INDEX idx_valuation_date (valuation_date),
    INDEX idx_valuation_level (valuation_level),
    FOREIGN KEY (fund_code) REFERENCES fund_basic(fund_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='估值数据表';
```

---

## 6. 数据流说明

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               数据流向图                                          │
└─────────────────────────────────────────────────────────────────────────────────┘

外部数据源
    │
    ├──► 基金基本信息 ──► fund_basic (手动维护/导入)
    │
    ├──► 估值数据 ──────► fund_valuation (定时爬取/手动导入)
    │
    └──► 净值数据 ──────► 用于计算持仓快照

用户操作
    │
    ├──► 买入/卖出 ─────► trade_record (手动录入)
    │
    └──► 查询分析 ──────► 基于各表聚合计算

定时任务
    │
    └──► 每日收盘后 ────► 生成 position_snapshot (自动计算)
```

---

## 7. 版本记录

| 版本 | 日期 | 修改内容 | 作者 |
|------|------|----------|------|
| v1.0 | 2026-02-27 | 初始版本 | data-agent |
