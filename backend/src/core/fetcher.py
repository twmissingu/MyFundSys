"""
数据抓取模块
封装东方财富API接口，提供基金数据抓取功能
"""
import json
import logging
import re
import time
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import List, Dict, Optional, Callable
from urllib.parse import urlencode

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .config import EASTMONEY_API, FETCH_CONFIG
from .database import (
    db_manager, FundBasicDAO, FundNAVDAO, FundValuationDAO,
    SystemLogDAO
)

logger = logging.getLogger(__name__)


class RetryableError(Exception):
    """可重试的错误"""
    pass


class APIError(Exception):
    """API错误"""
    pass


class EastMoneyFetcher:
    """东方财富数据抓取器"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(EASTMONEY_API["headers"])
        
        # 配置重试策略
        retry_strategy = Retry(
            total=EASTMONEY_API["max_retries"],
            backoff_factor=EASTMONEY_API["retry_delay"],
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        self.timeout = EASTMONEY_API["timeout"]
        self.request_interval = FETCH_CONFIG["request_interval"]
        self._last_request_time = 0
    
    def _make_request(self, url: str, params: dict = None, method: str = "GET") -> dict:
        """发送HTTP请求（带频率限制）"""
        # 频率限制
        elapsed = time.time() - self._last_request_time
        if elapsed < self.request_interval:
            time.sleep(self.request_interval - elapsed)
        
        try:
            if method.upper() == "GET":
                response = self.session.get(url, params=params, timeout=self.timeout)
            else:
                response = self.session.post(url, data=params, timeout=self.timeout)
            
            self._last_request_time = time.time()
            response.raise_for_status()
            return response
        except requests.exceptions.Timeout:
            raise RetryableError(f"Request timeout: {url}")
        except requests.exceptions.ConnectionError:
            raise RetryableError(f"Connection error: {url}")
        except requests.exceptions.HTTPError as e:
            if e.response.status_code in [429, 500, 502, 503, 504]:
                raise RetryableError(f"HTTP error {e.response.status_code}: {url}")
            raise APIError(f"HTTP error {e.response.status_code}: {url}")
    
    def _parse_jsonp(self, text: str, callback_name: str = None) -> dict:
        """解析JSONP响应"""
        if callback_name:
            pattern = f"{callback_name}\\((.*)\\);?$"
        else:
            pattern = r"[^(]+\\((.*)\\);?$"
        
        match = re.search(pattern, text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError as e:
                raise APIError(f"Failed to parse JSONP: {e}")
        raise APIError(f"Invalid JSONP format: {text[:100]}")
    
    def fetch_fund_list(self) -> List[Dict]:
        """获取基金列表"""
        url = EASTMONEY_API["fund_list_url"]
        
        try:
            response = self._make_request(url)
            # 解析 JavaScript 数据
            text = response.text
            match = re.search(r"var r = (\[.*\]);", text, re.DOTALL)
            if not match:
                raise APIError("Failed to parse fund list")
            
            data = json.loads(match.group(1))
            funds = []
            for item in data:
                funds.append({
                    "fund_code": item[0],
                    "fund_name": item[2],
                    "fund_type": self._normalize_fund_type(item[3]),
                })
            
            logger.info(f"Fetched {len(funds)} funds from list")
            return funds
        except Exception as e:
            logger.error(f"Failed to fetch fund list: {e}")
            raise
    
    def fetch_fund_detail(self, fund_code: str) -> Dict:
        """获取基金详情"""
        url = EASTMONEY_API["base_url"]
        params = {
            "FCODE": fund_code,
            "deviceid": "web",
            "plat": "web",
            "product": "EFund",
            "version": "6.5.12",
        }
        
        try:
            response = self._make_request(url, params)
            data = response.json()
            
            if data.get("ErrCode") != 0:
                raise APIError(f"API error: {data.get('ErrMsg')}")
            
            detail = data.get("Datas", {})
            return {
                "fund_code": fund_code,
                "fund_name": detail.get("SHORTNAME"),
                "fund_type": self._normalize_fund_type(detail.get("FTYPE")),
                "manager": detail.get("MANAGER"),
                "company": detail.get("JJGS"),
                "establish_date": self._parse_date(detail.get("ESTABDATE")),
                "benchmark": detail.get("BENCH"),
                "purchase_rate": self._parse_rate(detail.get("RGFEE")),
                "redemption_rate": self._parse_rate(detail.get("SHFEE")),
                "management_fee": self._parse_rate(detail.get("GLFEE")),
                "custody_fee": self._parse_rate(detail.get("TGFEE")),
            }
        except RetryableError:
            raise
        except Exception as e:
            logger.error(f"Failed to fetch fund detail for {fund_code}: {e}")
            raise APIError(f"Failed to fetch fund detail: {e}")
    
    def fetch_nav_history(
        self, 
        fund_code: str, 
        start_date: date = None,
        end_date: date = None,
        page_size: int = 100
    ) -> List[Dict]:
        """获取基金净值历史"""
        url = EASTMONEY_API["nav_history_url"]
        
        if not end_date:
            end_date = date.today()
        if not start_date:
            start_date = end_date - timedelta(days=365)
        
        all_records = []
        page_index = 1
        
        while True:
            params = {
                "fundCode": fund_code,
                "pageIndex": page_index,
                "pageSize": page_size,
                "startDate": start_date.strftime("%Y-%m-%d"),
                "endDate": end_date.strftime("%Y-%m-%d"),
            }
            
            try:
                response = self._make_request(url, params)
                data = response.json()
                
                if data.get("ErrCode") != 0:
                    raise APIError(f"API error: {data.get('ErrMsg')}")
                
                records = data.get("Data", {}).get("LSJZList", [])
                if not records:
                    break
                
                for record in records:
                    nav_data = {
                        "fund_code": fund_code,
                        "nav_date": self._parse_date(record.get("FSRQ")),
                        "nav": self._parse_decimal(record.get("DWJZ")),
                        "acc_nav": self._parse_decimal(record.get("LJJZ")),
                        "daily_return": self._parse_decimal(record.get("JZZZL")),
                        "subscription_status": record.get("SGZT"),
                        "redemption_status": record.get("SHZT"),
                        "dividend": self._parse_decimal(record.get("FHSP")),
                    }
                    all_records.append(nav_data)
                
                # 检查是否还有更多数据
                total_count = data.get("Data", {}).get("TotalCount", 0)
                if page_index * page_size >= total_count:
                    break
                
                page_index += 1
                
            except RetryableError:
                logger.warning(f"Retryable error on page {page_index}, will retry...")
                time.sleep(EASTMONEY_API["retry_delay"])
                continue
            except Exception as e:
                logger.error(f"Failed to fetch NAV history for {fund_code}: {e}")
                raise
        
        logger.info(f"Fetched {len(all_records)} NAV records for {fund_code}")
        return all_records
    
    def fetch_valuation(self, fund_code: str) -> Optional[Dict]:
        """获取基金实时估值"""
        url = f"{EASTMONEY_API['valuation_url']}/{fund_code}.js"
        
        try:
            response = self._make_request(url)
            data = self._parse_jsonp(response.text, "jsonpgz")
            
            if not data or not data.get("fundcode"):
                return None
            
            return {
                "fund_code": fund_code,
                "valuation_time": self._parse_datetime(data.get("gztime")),
                "estimated_nav": self._parse_decimal(data.get("gsz")),
                "estimated_return": self._parse_decimal(data.get("gszzl")),
                "source": "eastmoney",
            }
        except RetryableError:
            raise
        except Exception as e:
            logger.error(f"Failed to fetch valuation for {fund_code}: {e}")
            return None
    
    def fetch_batch_valuation(self, fund_codes: List[str]) -> List[Dict]:
        """批量获取基金估值"""
        results = []
        for code in fund_codes:
            try:
                valuation = self.fetch_valuation(code)
                if valuation:
                    results.append(valuation)
            except Exception as e:
                logger.warning(f"Failed to fetch valuation for {code}: {e}")
            time.sleep(self.request_interval)
        return results
    
    # ==================== 辅助方法 ====================
    
    @staticmethod
    def _normalize_fund_type(type_str: str) -> str:
        """标准化基金类型"""
        if not type_str:
            return "other"
        
        type_mapping = {
            "股票型": "equity",
            "债券型": "bond",
            "混合型": "hybrid",
            "货币型": "money",
            "货币式": "money",
            "QDII": "qdii",
            "FOF": "fof",
            "指数型": "index",
            "ETF": "etf",
            "ETF联接": "etf",
            "LOF": "lof",
        }
        
        for cn, en in type_mapping.items():
            if cn in type_str:
                return en
        return "other"
    
    @staticmethod
    def _parse_date(date_str: str) -> Optional[date]:
        """解析日期字符串"""
        if not date_str:
            return None
        try:
            return datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            try:
                return datetime.strptime(date_str, "%Y/%m/%d").date()
            except ValueError:
                return None
    
    @staticmethod
    def _parse_datetime(datetime_str: str) -> Optional[datetime]:
        """解析日期时间字符串"""
        if not datetime_str:
            return None
        try:
            return datetime.strptime(datetime_str, "%Y-%m-%d %H:%M")
        except ValueError:
            try:
                return datetime.strptime(datetime_str, "%Y-%m-%d")
            except ValueError:
                return datetime.now()
    
    @staticmethod
    def _parse_decimal(value: str) -> Optional[Decimal]:
        """解析小数"""
        if not value or value == "---" or value == "":
            return None
        try:
            return Decimal(str(value))
        except:
            return None
    
    @staticmethod
    def _parse_rate(rate_str: str) -> Optional[float]:
        """解析费率"""
        if not rate_str:
            return None
        try:
            # 移除百分号并转换
            rate_str = str(rate_str).replace("%", "").strip()
            return float(rate_str)
        except:
            return None


class DataSyncManager:
    """数据同步管理器"""
    
    def __init__(self):
        self.fetcher = EastMoneyFetcher()
        db_manager.initialize()
    
    def sync_fund_list(self) -> int:
        """同步基金列表"""
        try:
            funds = self.fetcher.fetch_fund_list()
            
            with db_manager.get_session() as session:
                count = 0
                for fund_data in funds:
                    existing = FundBasicDAO.get_by_code(session, fund_data["fund_code"])
                    if not existing:
                        FundBasicDAO.create(session, **fund_data)
                        count += 1
            
            logger.info(f"Synced {count} new funds")
            return count
        except Exception as e:
            logger.error(f"Failed to sync fund list: {e}")
            raise
    
    def sync_fund_detail(self, fund_code: str) -> bool:
        """同步单个基金详情"""
        try:
            detail = self.fetcher.fetch_fund_detail(fund_code)
            
            with db_manager.get_session() as session:
                existing = FundBasicDAO.get_by_code(session, fund_code)
                if existing:
                    FundBasicDAO.update(session, fund_code, **detail)
                else:
                    FundBasicDAO.create(session, **detail)
            
            return True
        except Exception as e:
            logger.error(f"Failed to sync fund detail for {fund_code}: {e}")
            return False
    
    def sync_nav_history(
        self, 
        fund_code: str,
        start_date: date = None,
        end_date: date = None
    ) -> int:
        """同步基金净值历史"""
        try:
            nav_records = self.fetcher.fetch_nav_history(fund_code, start_date, end_date)
            
            with db_manager.get_session() as session:
                count = 0
                for nav_data in nav_records:
                    if nav_data["nav_date"] and nav_data["nav"]:
                        result = FundNAVDAO.create(session, **nav_data)
                        if result:
                            count += 1
            
            logger.info(f"Synced {count} NAV records for {fund_code}")
            return count
        except Exception as e:
            logger.error(f"Failed to sync NAV history for {fund_code}: {e}")
            raise
    
    def sync_daily_nav(self, fund_codes: List[str] = None) -> Dict[str, int]:
        """同步每日净值（默认同步所有监控基金）"""
        results = {}
        
        with db_manager.get_session() as session:
            if not fund_codes:
                funds = FundBasicDAO.get_monitored(session)
                fund_codes = [f.fund_code for f in funds]
        
        for code in fund_codes:
            try:
                # 只获取最近1天的数据
                yesterday = date.today() - timedelta(days=1)
                count = self.sync_nav_history(code, yesterday)
                results[code] = count
            except Exception as e:
                logger.error(f"Failed to sync daily NAV for {code}: {e}")
                results[code] = -1
        
        return results
    
    def sync_valuation(self, fund_codes: List[str] = None) -> List[Dict]:
        """同步基金估值"""
        with db_manager.get_session() as session:
            if not fund_codes:
                funds = FundBasicDAO.get_monitored(session)
                fund_codes = [f.fund_code for f in funds]
        
        valuations = self.fetcher.fetch_batch_valuation(fund_codes)
        
        saved_valuations = []
        with db_manager.get_session() as session:
            for val_data in valuations:
                if val_data and val_data.get("estimated_nav"):
                    result = FundValuationDAO.create(session, **val_data)
                    saved_valuations.append(val_data)
        
        logger.info(f"Synced {len(saved_valuations)} valuations")
        return saved_valuations
    
    def full_sync_fund(self, fund_code: str) -> Dict:
        """完整同步单个基金（详情+净值历史）"""
        result = {
            "fund_code": fund_code,
            "detail_synced": False,
            "nav_count": 0,
            "errors": []
        }
        
        # 同步详情
        try:
            result["detail_synced"] = self.sync_fund_detail(fund_code)
        except Exception as e:
            result["errors"].append(f"Detail sync failed: {e}")
        
        # 同步净值历史
        try:
            result["nav_count"] = self.sync_nav_history(fund_code)
        except Exception as e:
            result["errors"].append(f"NAV sync failed: {e}")
        
        return result


# ==================== 便捷函数 ====================

def create_fetcher() -> EastMoneyFetcher:
    """创建数据抓取器实例"""
    return EastMoneyFetcher()


def create_sync_manager() -> DataSyncManager:
    """创建数据同步管理器实例"""
    return DataSyncManager()


def fetch_fund_nav(fund_code: str, days: int = 30) -> List[Dict]:
    """便捷函数：获取基金净值"""
    fetcher = EastMoneyFetcher()
    end_date = date.today()
    start_date = end_date - timedelta(days=days)
    return fetcher.fetch_nav_history(fund_code, start_date, end_date)


def fetch_fund_valuation(fund_code: str) -> Optional[Dict]:
    """便捷函数：获取基金估值"""
    fetcher = EastMoneyFetcher()
    return fetcher.fetch_valuation(fund_code)
