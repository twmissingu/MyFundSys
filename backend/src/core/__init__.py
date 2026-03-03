"""
基金系统核心数据层 - 初始化模块
"""
from .config import DATABASE_URL, EASTMONEY_API, FETCH_CONFIG, BACKUP_CONFIG
from .models import (
    Base, FundBasic, FundNAV, FundValuation, 
    TradeRecord, PositionSnapshot, SystemLog,
    FundType, TradeType, TradeStatus,
    init_db, get_session_maker
)
from .database import (
    DatabaseManager, db_manager,
    FundBasicDAO, FundNAVDAO, FundValuationDAO,
    TradeRecordDAO, PositionSnapshotDAO, SystemLogDAO,
    DatabaseBackup, init_database, get_db
)
from .fetcher import (
    EastMoneyFetcher, DataSyncManager,
    RetryableError, APIError,
    create_fetcher, create_sync_manager,
    fetch_fund_nav, fetch_fund_valuation
)

__all__ = [
    # 配置
    "DATABASE_URL",
    "EASTMONEY_API", 
    "FETCH_CONFIG",
    "BACKUP_CONFIG",
    # 模型
    "Base",
    "FundBasic",
    "FundNAV", 
    "FundValuation",
    "TradeRecord",
    "PositionSnapshot",
    "SystemLog",
    "FundType",
    "TradeType", 
    "TradeStatus",
    # 数据库
    "DatabaseManager",
    "db_manager",
    "FundBasicDAO",
    "FundNAVDAO",
    "FundValuationDAO",
    "TradeRecordDAO",
    "PositionSnapshotDAO",
    "SystemLogDAO",
    "DatabaseBackup",
    "init_database",
    "get_db",
    # 数据抓取
    "EastMoneyFetcher",
    "DataSyncManager",
    "RetryableError",
    "APIError",
    "create_fetcher",
    "create_sync_manager",
    "fetch_fund_nav",
    "fetch_fund_valuation",
]

__version__ = "0.1.0"
