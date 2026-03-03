"""
基金系统配置文件
"""
import os
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent.parent

# 数据目录
DATA_DIR = PROJECT_ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

# 数据库配置
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'fund_system.db'}")

# 东方财富API配置
EASTMONEY_API = {
    "base_url": "https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo",
    "fund_list_url": "http://fund.eastmoney.com/js/fundcode_search.js",
    "nav_history_url": "https://api.fund.eastmoney.com/f10/lsjz",
    "valuation_url": "https://fundgz.1234567.com.cn/js/",
    "headers": {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://fund.eastmoney.com/",
    },
    "timeout": 30,
    "max_retries": 3,
    "retry_delay": 2,  # 秒
}

# 数据抓取配置
FETCH_CONFIG = {
    # 净值抓取时间 (每天15:00后)
    "nav_fetch_time": {"hour": 15, "minute": 30},
    # 估值抓取间隔 (分钟)
    "valuation_interval": 5,
    # 交易时间
    "trade_start_time": "09:30",
    "trade_end_time": "15:00",
    # 最大并发请求数
    "max_concurrent": 5,
    # 请求间隔 (秒)
    "request_interval": 0.5,
}

# 日志配置
LOG_CONFIG = {
    "level": os.getenv("LOG_LEVEL", "INFO"),
    "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    "file": DATA_DIR / "logs" / "fund_system.log",
}

# 备份配置
BACKUP_CONFIG = {
    "enabled": True,
    "interval_days": 7,
    "keep_count": 4,
    "backup_dir": DATA_DIR / "backups",
}

# 基金类型映射
FUND_TYPE_MAP = {
    "股票型": "equity",
    "债券型": "bond",
    "混合型": "hybrid",
    "货币型": "money",
    "QDII": "qdii",
    "FOF": "fof",
    "指数型": "index",
    "ETF": "etf",
    "LOF": "lof",
}

# 交易类型映射
TRADE_TYPE_MAP = {
    "buy": "买入",
    "sell": "卖出",
    "dividend": "分红",
    "split": "拆分",
    "merge": "合并",
}
