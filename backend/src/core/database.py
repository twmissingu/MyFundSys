"""
数据库管理模块
提供数据库连接、会话管理和数据操作功能
"""
import json
import logging
import shutil
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, Type, Dict, Any, Union

from sqlalchemy import create_engine, desc, func, and_, or_
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from .config import DATABASE_URL, BACKUP_CONFIG, DATA_DIR
from .models import (
    Base, FundBasic, FundNAV, FundValuation, 
    TradeRecord, PositionSnapshot, SystemLog,
    init_db, get_session_maker
)

logger = logging.getLogger(__name__)


class DatabaseManager:
    """数据库管理器"""
    
    _instance = None
    
    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self, db_url: str = None):
        if self._initialized:
            return
            
        self.db_url = db_url or DATABASE_URL
        self.engine = None
        self.SessionLocal = None
        self._initialized = True
    
    def initialize(self):
        """初始化数据库连接"""
        if self.engine is None:
            self.engine = create_engine(
                self.db_url,
                echo=False,
                pool_pre_ping=True,  # 自动检测断开的连接
                pool_recycle=3600,   # 1小时后回收连接
            )
            self.SessionLocal = sessionmaker(
                autocommit=False,
                autoflush=False,
                bind=self.engine
            )
            # 创建所有表
            Base.metadata.create_all(bind=self.engine)
            logger.info(f"Database initialized: {self.db_url}")
    
    @contextmanager
    def get_session(self) -> Session:
        """获取数据库会话（上下文管理器）"""
        if self.engine is None:
            self.initialize()
        
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Database session error: {e}")
            raise
        finally:
            session.close()
    
    def get_session_direct(self) -> Session:
        """直接获取数据库会话（需要手动关闭）"""
        if self.engine is None:
            self.initialize()
        return self.SessionLocal()


# 全局数据库管理器实例
db_manager = DatabaseManager()


# ==================== 基金基础信息操作 ====================

class FundBasicDAO:
    """基金基础信息数据访问对象"""
    
    @staticmethod
    def create(session: Session, **kwargs) -> FundBasic:
        """创建基金基础信息"""
        fund = FundBasic(**kwargs)
        session.add(fund)
        try:
            session.commit()
            logger.info(f"Created fund: {fund.fund_code}")
            return fund
        except IntegrityError:
            session.rollback()
            logger.warning(f"Fund already exists: {kwargs.get('fund_code')}")
            return None
    
    @staticmethod
    def get_by_code(session: Session, fund_code: str) -> Optional[FundBasic]:
        """根据基金代码获取基金信息"""
        return session.query(FundBasic).filter(FundBasic.fund_code == fund_code).first()
    
    @staticmethod
    def get_all(session: Session, active_only: bool = True) -> List[FundBasic]:
        """获取所有基金信息"""
        query = session.query(FundBasic)
        if active_only:
            query = query.filter(FundBasic.is_active == True)
        return query.all()
    
    @staticmethod
    def get_monitored(session: Session) -> List[FundBasic]:
        """获取监控中的基金"""
        return session.query(FundBasic).filter(
            and_(FundBasic.is_monitored == True, FundBasic.is_active == True)
        ).all()
    
    @staticmethod
    def update(session: Session, fund_code: str, **kwargs) -> bool:
        """更新基金信息"""
        fund = FundBasicDAO.get_by_code(session, fund_code)
        if fund:
            for key, value in kwargs.items():
                if hasattr(fund, key):
                    setattr(fund, key, value)
            fund.updated_at = datetime.utcnow()
            session.commit()
            logger.info(f"Updated fund: {fund_code}")
            return True
        return False
    
    @staticmethod
    def delete(session: Session, fund_code: str) -> bool:
        """删除基金信息（软删除）"""
        return FundBasicDAO.update(session, fund_code, is_active=False)
    
    @staticmethod
    def bulk_create(session: Session, funds_data: List[Dict]) -> int:
        """批量创建基金信息"""
        count = 0
        for data in funds_data:
            try:
                fund = FundBasic(**data)
                session.add(fund)
                count += 1
            except Exception as e:
                logger.warning(f"Failed to create fund {data.get('fund_code')}: {e}")
        try:
            session.commit()
            logger.info(f"Bulk created {count} funds")
        except IntegrityError:
            session.rollback()
            # 逐个插入
            for data in funds_data:
                FundBasicDAO.create(session, **data)
        return count


# ==================== 基金净值操作 ====================

class FundNAVDAO:
    """基金净值数据访问对象"""
    
    @staticmethod
    def create(session: Session, **kwargs) -> FundNAV:
        """创建净值记录"""
        nav_record = FundNAV(**kwargs)
        session.add(nav_record)
        try:
            session.commit()
            return nav_record
        except IntegrityError:
            session.rollback()
            # 更新已有记录
            existing = session.query(FundNAV).filter(
                and_(
                    FundNAV.fund_code == kwargs.get('fund_code'),
                    FundNAV.nav_date == kwargs.get('nav_date')
                )
            ).first()
            if existing:
                for key, value in kwargs.items():
                    if hasattr(existing, key) and key not in ['id', 'created_at']:
                        setattr(existing, key, value)
                session.commit()
                return existing
            return None
    
    @staticmethod
    def get_by_fund_and_date(session: Session, fund_code: str, nav_date: datetime.date) -> Optional[FundNAV]:
        """获取指定基金某日的净值"""
        return session.query(FundNAV).filter(
            and_(FundNAV.fund_code == fund_code, FundNAV.nav_date == nav_date)
        ).first()
    
    @staticmethod
    def get_latest_nav(session: Session, fund_code: str) -> Optional[FundNAV]:
        """获取基金最新净值"""
        return session.query(FundNAV).filter(
            FundNAV.fund_code == fund_code
        ).order_by(desc(FundNAV.nav_date)).first()
    
    @staticmethod
    def get_nav_history(
        session: Session, 
        fund_code: str, 
        start_date: datetime.date = None,
        end_date: datetime.date = None,
        limit: int = None
    ) -> List[FundNAV]:
        """获取基金净值历史"""
        query = session.query(FundNAV).filter(FundNAV.fund_code == fund_code)
        
        if start_date:
            query = query.filter(FundNAV.nav_date >= start_date)
        if end_date:
            query = query.filter(FundNAV.nav_date <= end_date)
        
        query = query.order_by(desc(FundNAV.nav_date))
        
        if limit:
            query = query.limit(limit)
        
        return query.all()
    
    @staticmethod
    def bulk_create(session: Session, nav_data_list: List[Dict]) -> int:
        """批量创建净值记录"""
        count = 0
        for data in nav_data_list:
            try:
                nav_record = FundNAV(**data)
                session.add(nav_record)
                count += 1
                if count % 100 == 0:
                    session.commit()
            except Exception as e:
                logger.warning(f"Failed to create NAV record: {e}")
        session.commit()
        logger.info(f"Bulk created {count} NAV records")
        return count


# ==================== 基金估值操作 ====================

class FundValuationDAO:
    """基金估值数据访问对象"""
    
    @staticmethod
    def create(session: Session, **kwargs) -> FundValuation:
        """创建估值记录"""
        valuation = FundValuation(**kwargs)
        session.add(valuation)
        session.commit()
        return valuation
    
    @staticmethod
    def get_latest_valuation(session: Session, fund_code: str) -> Optional[FundValuation]:
        """获取基金最新估值"""
        return session.query(FundValuation).filter(
            FundValuation.fund_code == fund_code
        ).order_by(desc(FundValuation.valuation_time)).first()
    
    @staticmethod
    def get_valuation_history(
        session: Session,
        fund_code: str,
        start_time: datetime = None,
        end_time: datetime = None
    ) -> List[FundValuation]:
        """获取估值历史"""
        query = session.query(FundValuation).filter(FundValuation.fund_code == fund_code)
        
        if start_time:
            query = query.filter(FundValuation.valuation_time >= start_time)
        if end_time:
            query = query.filter(FundValuation.valuation_time <= end_time)
        
        return query.order_by(desc(FundValuation.valuation_time)).all()
    
    @staticmethod
    def clean_old_valuations(session: Session, days: int = 7) -> int:
        """清理旧估值数据"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        result = session.query(FundValuation).filter(
            FundValuation.valuation_time < cutoff_date
        ).delete(synchronize_session=False)
        session.commit()
        logger.info(f"Cleaned {result} old valuation records")
        return result


# ==================== 交易记录操作 ====================

class TradeRecordDAO:
    """交易记录数据访问对象"""
    
    @staticmethod
    def create(session: Session, **kwargs) -> TradeRecord:
        """创建交易记录"""
        trade = TradeRecord(**kwargs)
        session.add(trade)
        session.commit()
        logger.info(f"Created trade record: {trade.fund_code} {trade.trade_type}")
        return trade
    
    @staticmethod
    def get_by_id(session: Session, trade_id: int) -> Optional[TradeRecord]:
        """根据ID获取交易记录"""
        return session.query(TradeRecord).filter(TradeRecord.id == trade_id).first()
    
    @staticmethod
    def get_by_fund(session: Session, fund_code: str, limit: int = None) -> List[TradeRecord]:
        """获取基金的交易记录"""
        query = session.query(TradeRecord).filter(
            TradeRecord.fund_code == fund_code
        ).order_by(desc(TradeRecord.trade_date))
        if limit:
            query = query.limit(limit)
        return query.all()
    
    @staticmethod
    def get_pending_trades(session: Session) -> List[TradeRecord]:
        """获取待确认的交易"""
        return session.query(TradeRecord).filter(
            TradeRecord.trade_status == "pending"
        ).all()
    
    @staticmethod
    def update(session: Session, trade_id: int, **kwargs) -> bool:
        """更新交易记录"""
        trade = TradeRecordDAO.get_by_id(session, trade_id)
        if trade:
            for key, value in kwargs.items():
                if hasattr(trade, key):
                    setattr(trade, key, value)
            trade.updated_at = datetime.utcnow()
            session.commit()
            return True
        return False
    
    @staticmethod
    def confirm_trade(
        session: Session, 
        trade_id: int, 
        confirm_date: datetime.date,
        confirm_nav: float,
        confirm_shares: float
    ) -> bool:
        """确认交易"""
        return TradeRecordDAO.update(
            session, trade_id,
            trade_status="confirmed",
            confirm_date=confirm_date,
            confirm_nav=confirm_nav,
            confirm_shares=confirm_shares
        )


# ==================== 持仓快照操作 ====================

class PositionSnapshotDAO:
    """持仓快照数据访问对象"""
    
    @staticmethod
    def create(session: Session, **kwargs) -> PositionSnapshot:
        """创建持仓快照"""
        snapshot = PositionSnapshot(**kwargs)
        session.add(snapshot)
        try:
            session.commit()
            return snapshot
        except IntegrityError:
            session.rollback()
            # 更新已有快照
            existing = session.query(PositionSnapshot).filter(
                and_(
                    PositionSnapshot.fund_code == kwargs.get('fund_code'),
                    PositionSnapshot.snapshot_date == kwargs.get('snapshot_date')
                )
            ).first()
            if existing:
                for key, value in kwargs.items():
                    if hasattr(existing, key) and key not in ['id', 'created_at']:
                        setattr(existing, key, value)
                existing.updated_at = datetime.utcnow()
                session.commit()
                return existing
            return None
    
    @staticmethod
    def get_latest_snapshot(session: Session, fund_code: str) -> Optional[PositionSnapshot]:
        """获取最新持仓快照"""
        return session.query(PositionSnapshot).filter(
            PositionSnapshot.fund_code == fund_code
        ).order_by(desc(PositionSnapshot.snapshot_date)).first()
    
    @staticmethod
    def get_snapshot_history(
        session: Session,
        fund_code: str,
        start_date: datetime.date = None,
        end_date: datetime.date = None
    ) -> List[PositionSnapshot]:
        """获取持仓快照历史"""
        query = session.query(PositionSnapshot).filter(PositionSnapshot.fund_code == fund_code)
        
        if start_date:
            query = query.filter(PositionSnapshot.snapshot_date >= start_date)
        if end_date:
            query = query.filter(PositionSnapshot.snapshot_date <= end_date)
        
        return query.order_by(desc(PositionSnapshot.snapshot_date)).all()


# ==================== 系统日志操作 ====================

class SystemLogDAO:
    """系统日志数据访问对象"""
    
    @staticmethod
    def create(session: Session, level: str, module: str, message: str, extra_data: dict = None) -> SystemLog:
        """创建系统日志"""
        log = SystemLog(
            level=level,
            module=module,
            message=message,
            extra_data=json.dumps(extra_data) if extra_data else None
        )
        session.add(log)
        session.commit()
        return log
    
    @staticmethod
    def get_logs(
        session: Session,
        level: str = None,
        module: str = None,
        start_time: datetime = None,
        end_time: datetime = None,
        limit: int = 100
    ) -> List[SystemLog]:
        """获取日志"""
        query = session.query(SystemLog)
        
        if level:
            query = query.filter(SystemLog.level == level)
        if module:
            query = query.filter(SystemLog.module == module)
        if start_time:
            query = query.filter(SystemLog.created_at >= start_time)
        if end_time:
            query = query.filter(SystemLog.created_at <= end_time)
        
        return query.order_by(desc(SystemLog.created_at)).limit(limit).all()
    
    @staticmethod
    def clean_old_logs(session: Session, days: int = 30) -> int:
        """清理旧日志"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        result = session.query(SystemLog).filter(
            SystemLog.created_at < cutoff_date
        ).delete(synchronize_session=False)
        session.commit()
        logger.info(f"Cleaned {result} old log records")
        return result


# ==================== 数据库备份与恢复 ====================

class DatabaseBackup:
    """数据库备份管理"""
    
    @staticmethod
    def backup() -> Optional[Path]:
        """备份数据库"""
        if not BACKUP_CONFIG["enabled"]:
            return None
        
        backup_dir = Path(BACKUP_CONFIG["backup_dir"])
        backup_dir.mkdir(parents=True, exist_ok=True)
        
        # 生成备份文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = backup_dir / f"fund_system_backup_{timestamp}.db"
        
        # 获取数据库文件路径
        db_path = DATABASE_URL.replace("sqlite:///", "")
        
        try:
            shutil.copy2(db_path, backup_file)
            logger.info(f"Database backed up to: {backup_file}")
            
            # 清理旧备份
            DatabaseBackup._clean_old_backups()
            
            return backup_file
        except Exception as e:
            logger.error(f"Backup failed: {e}")
            return None
    
    @staticmethod
    def _clean_old_backups():
        """清理旧备份文件"""
        backup_dir = Path(BACKUP_CONFIG["backup_dir"])
        if not backup_dir.exists():
            return
        
        backups = sorted(
            backup_dir.glob("fund_system_backup_*.db"),
            key=lambda x: x.stat().st_mtime,
            reverse=True
        )
        
        keep_count = BACKUP_CONFIG.get("keep_count", 4)
        for old_backup in backups[keep_count:]:
            old_backup.unlink()
            logger.info(f"Removed old backup: {old_backup}")
    
    @staticmethod
    def restore(backup_file: Path) -> bool:
        """恢复数据库"""
        if not backup_file.exists():
            logger.error(f"Backup file not found: {backup_file}")
            return False
        
        db_path = DATABASE_URL.replace("sqlite:///", "")
        
        try:
            # 先备份当前数据库
            current_backup = f"{db_path}.before_restore_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            shutil.copy2(db_path, current_backup)
            
            # 恢复备份
            shutil.copy2(backup_file, db_path)
            logger.info(f"Database restored from: {backup_file}")
            return True
        except Exception as e:
            logger.error(f"Restore failed: {e}")
            return False
    
    @staticmethod
    def list_backups() -> List[Path]:
        """列出所有备份"""
        backup_dir = Path(BACKUP_CONFIG["backup_dir"])
        if not backup_dir.exists():
            return []
        
        return sorted(
            backup_dir.glob("fund_system_backup_*.db"),
            key=lambda x: x.stat().st_mtime,
            reverse=True
        )


# ==================== 便捷函数 ====================

def init_database():
    """初始化数据库（便捷函数）"""
    db_manager.initialize()
    logger.info("Database initialized successfully")


def get_db():
    """获取数据库会话生成器（用于依赖注入）"""
    db = db_manager.get_session_direct()
    try:
        yield db
    finally:
        db.close()
