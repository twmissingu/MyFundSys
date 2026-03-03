"""
SQLAlchemy 数据库模型定义
基金系统核心数据模型
"""
from datetime import datetime
from decimal import Decimal
from enum import Enum as PyEnum

from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Date, 
    Numeric, Text, Boolean, ForeignKey, Index, create_engine
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

Base = declarative_base()


class FundType(PyEnum):
    """基金类型枚举"""
    EQUITY = "equity"      # 股票型
    BOND = "bond"          # 债券型
    HYBRID = "hybrid"      # 混合型
    MONEY = "money"        # 货币型
    QDII = "qdii"          # QDII
    FOF = "fof"            # FOF
    INDEX = "index"        # 指数型
    ETF = "etf"            # ETF
    LOF = "lof"            # LOF
    OTHER = "other"        # 其他


class TradeType(PyEnum):
    """交易类型枚举"""
    BUY = "buy"            # 买入
    SELL = "sell"          # 卖出
    DIVIDEND = "dividend"  # 分红
    SPLIT = "split"        # 拆分
    MERGE = "merge"        # 合并


class TradeStatus(PyEnum):
    """交易状态枚举"""
    PENDING = "pending"    # 待确认
    CONFIRMED = "confirmed"  # 已确认
    CANCELLED = "cancelled"  # 已撤销


class FundBasic(Base):
    """基金基础信息表"""
    __tablename__ = "fund_basic"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    fund_code = Column(String(10), unique=True, nullable=False, index=True, comment="基金代码")
    fund_name = Column(String(200), nullable=False, comment="基金名称")
    fund_type = Column(String(20), default="other", comment="基金类型")
    manager = Column(String(100), comment="基金经理")
    company = Column(String(200), comment="基金公司")
    establish_date = Column(Date, comment="成立日期")
    benchmark = Column(String(500), comment="业绩基准")
    investment_strategy = Column(Text, comment="投资策略")
    risk_level = Column(String(20), comment="风险等级")
    
    # 费率信息
    purchase_rate = Column(Float, comment="申购费率")
    redemption_rate = Column(Float, comment="赎回费率")
    management_fee = Column(Float, comment="管理费率")
    custody_fee = Column(Float, comment="托管费率")
    
    # 状态
    is_active = Column(Boolean, default=True, comment="是否活跃")
    is_monitored = Column(Boolean, default=False, comment="是否监控")
    
    # 元数据
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")
    
    # 关联关系
    nav_records = relationship("FundNAV", back_populates="fund", cascade="all, delete-orphan")
    valuation_records = relationship("FundValuation", back_populates="fund", cascade="all, delete-orphan")
    trade_records = relationship("TradeRecord", back_populates="fund", cascade="all, delete-orphan")
    position_snapshots = relationship("PositionSnapshot", back_populates="fund", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index("idx_fund_type", "fund_type"),
        Index("idx_fund_active", "is_active"),
    )
    
    def __repr__(self):
        return f"<FundBasic(code={self.fund_code}, name={self.fund_name})>"


class FundNAV(Base):
    """基金净值表 - 每日净值数据"""
    __tablename__ = "fund_nav"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    fund_code = Column(String(10), ForeignKey("fund_basic.fund_code"), nullable=False, index=True)
    nav_date = Column(Date, nullable=False, index=True, comment="净值日期")
    
    # 净值数据
    nav = Column(Numeric(10, 4), comment="单位净值")
    acc_nav = Column(Numeric(10, 4), comment="累计净值")
    daily_return = Column(Numeric(8, 4), comment="日涨跌幅(%)")
    
    # 额外数据
    subscription_status = Column(String(10), comment="申购状态")
    redemption_status = Column(String(10), comment="赎回状态")
    dividend = Column(Numeric(10, 4), comment="分红金额")
    
    # 元数据
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    
    # 关联关系
    fund = relationship("FundBasic", back_populates="nav_records")
    
    __table_args__ = (
        Index("idx_nav_fund_date", "fund_code", "nav_date", unique=True),
    )
    
    def __repr__(self):
        return f"<FundNAV(code={self.fund_code}, date={self.nav_date}, nav={self.nav})>"


class FundValuation(Base):
    """基金估值表 - 实时估值数据"""
    __tablename__ = "fund_valuation"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    fund_code = Column(String(10), ForeignKey("fund_basic.fund_code"), nullable=False, index=True)
    
    # 估值数据
    valuation_time = Column(DateTime, nullable=False, index=True, comment="估值时间")
    estimated_nav = Column(Numeric(10, 4), comment="估算净值")
    estimated_return = Column(Numeric(8, 4), comment="估算涨跌幅(%)")
    
    # 估值来源
    source = Column(String(50), default="eastmoney", comment="数据来源")
    
    # 元数据
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    
    # 关联关系
    fund = relationship("FundBasic", back_populates="valuation_records")
    
    __table_args__ = (
        Index("idx_valuation_fund_time", "fund_code", "valuation_time"),
    )
    
    def __repr__(self):
        return f"<FundValuation(code={self.fund_code}, time={self.valuation_time}, estimated={self.estimated_nav})>"


class TradeRecord(Base):
    """交易记录表"""
    __tablename__ = "trade_record"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    fund_code = Column(String(10), ForeignKey("fund_basic.fund_code"), nullable=False, index=True)
    
    # 交易信息
    trade_date = Column(Date, nullable=False, index=True, comment="交易日期")
    trade_type = Column(String(20), nullable=False, comment="交易类型")
    trade_status = Column(String(20), default="pending", comment="交易状态")
    
    # 金额和份额
    amount = Column(Numeric(15, 2), comment="交易金额")
    shares = Column(Numeric(12, 4), comment="交易份额")
    nav = Column(Numeric(10, 4), comment="成交净值")
    fee = Column(Numeric(10, 2), default=0, comment="交易费用")
    
    # 确认信息
    confirm_date = Column(Date, comment="确认日期")
    confirm_nav = Column(Numeric(10, 4), comment="确认净值")
    confirm_shares = Column(Numeric(12, 4), comment="确认份额")
    
    # 备注
    remark = Column(Text, comment="备注")
    
    # 元数据
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")
    
    # 关联关系
    fund = relationship("FundBasic", back_populates="trade_records")
    
    __table_args__ = (
        Index("idx_trade_fund_date", "fund_code", "trade_date"),
        Index("idx_trade_status", "trade_status"),
        Index("idx_trade_type", "trade_type"),
    )
    
    def __repr__(self):
        return f"<TradeRecord(code={self.fund_code}, date={self.trade_date}, type={self.trade_type})>"


class PositionSnapshot(Base):
    """持仓快照表"""
    __tablename__ = "position_snapshot"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    fund_code = Column(String(10), ForeignKey("fund_basic.fund_code"), nullable=False, index=True)
    snapshot_date = Column(Date, nullable=False, index=True, comment="快照日期")
    
    # 持仓数据
    total_shares = Column(Numeric(12, 4), default=0, comment="总份额")
    total_cost = Column(Numeric(15, 2), default=0, comment="总成本")
    avg_cost = Column(Numeric(10, 4), comment="平均成本")
    
    # 市值和收益
    market_value = Column(Numeric(15, 2), comment="市值")
    nav = Column(Numeric(10, 4), comment="当日净值")
    daily_profit = Column(Numeric(15, 2), comment="日收益")
    total_profit = Column(Numeric(15, 2), comment="累计收益")
    total_return_rate = Column(Numeric(8, 4), comment="累计收益率(%)")
    
    # 持有天数
    holding_days = Column(Integer, default=0, comment="持有天数")
    
    # 元数据
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")
    
    # 关联关系
    fund = relationship("FundBasic", back_populates="position_snapshots")
    
    __table_args__ = (
        Index("idx_snapshot_fund_date", "fund_code", "snapshot_date", unique=True),
    )
    
    def __repr__(self):
        return f"<PositionSnapshot(code={self.fund_code}, date={self.snapshot_date}, value={self.market_value})>"


class SystemLog(Base):
    """系统日志表"""
    __tablename__ = "system_log"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    level = Column(String(10), nullable=False, index=True, comment="日志级别")
    module = Column(String(50), comment="模块")
    message = Column(Text, nullable=False, comment="日志内容")
    extra_data = Column(Text, comment="额外数据(JSON)")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    
    __table_args__ = (
        Index("idx_log_created", "created_at"),
    )
    
    def __repr__(self):
        return f"<SystemLog(level={self.level}, module={self.module})>"


# 数据库初始化函数
def init_db(engine_url: str):
    """初始化数据库，创建所有表"""
    engine = create_engine(engine_url, echo=False)
    Base.metadata.create_all(engine)
    return engine


def get_session_maker(engine):
    """获取会话工厂"""
    return sessionmaker(bind=engine)
