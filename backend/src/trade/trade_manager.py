#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
交易管理核心模块
负责交易记录的增删改查、数据验证和持久化
"""

import json
import os
from datetime import datetime, date
from typing import List, Dict, Optional, Union
from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path


class TradeType(Enum):
    """交易类型"""
    BUY = "buy"      # 买入
    SELL = "sell"    # 卖出


class TradeStatus(Enum):
    """交易状态"""
    PENDING = "pending"    # 待确认
    CONFIRMED = "confirmed"  # 已确认
    CANCELLED = "cancelled"  # 已取消


@dataclass
class TradeRecord:
    """
    交易记录数据类
    
    Attributes:
        id: 交易记录唯一ID
        trade_date: 交易日期
        fund_code: 基金代码
        trade_type: 交易类型 (buy/sell)
        amount: 交易金额（元）
        shares: 交易份额
        nav: 单位净值
        fee: 手续费
        status: 交易状态
        created_at: 创建时间
        updated_at: 更新时间
        remark: 备注
    """
    id: str
    trade_date: str  # YYYY-MM-DD
    fund_code: str
    trade_type: str  # 'buy' or 'sell'
    amount: float    # 交易金额（元）
    shares: float    # 交易份额
    nav: float       # 单位净值
    fee: float       # 手续费
    status: str = "confirmed"  # pending, confirmed, cancelled
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    remark: str = ""
    
    def to_dict(self) -> Dict:
        """转换为字典"""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'TradeRecord':
        """从字典创建"""
        return cls(**data)
    
    def calculate_actual_amount(self) -> float:
        """计算实际金额（扣除手续费）"""
        if self.trade_type == TradeType.BUY.value:
            return self.amount - self.fee
        else:
            return self.amount - self.fee
    
    def validate(self) -> tuple[bool, str]:
        """
        验证交易记录合法性
        
        Returns:
            (是否合法, 错误信息)
        """
        # 验证日期格式
        try:
            datetime.strptime(self.trade_date, "%Y-%m-%d")
        except ValueError:
            return False, f"交易日期格式错误: {self.trade_date}，应为 YYYY-MM-DD"
        
        # 验证基金代码（6位数字）
        if not self.fund_code or len(self.fund_code) != 6 or not self.fund_code.isdigit():
            return False, f"基金代码格式错误: {self.fund_code}，应为6位数字"
        
        # 验证交易类型
        if self.trade_type not in [t.value for t in TradeType]:
            return False, f"交易类型错误: {self.trade_type}，应为 buy 或 sell"
        
        # 验证金额为正数
        if self.amount <= 0:
            return False, f"交易金额必须大于0: {self.amount}"
        
        # 验证份额为正数
        if self.shares <= 0:
            return False, f"交易份额必须大于0: {self.shares}"
        
        # 验证净值为正数
        if self.nav <= 0:
            return False, f"单位净值必须大于0: {self.nav}"
        
        # 验证手续费非负
        if self.fee < 0:
            return False, f"手续费不能为负数: {self.fee}"
        
        # 验证买入时金额 ≈ 份额 × 净值 + 手续费
        if self.trade_type == TradeType.BUY.value:
            expected_amount = self.shares * self.nav + self.fee
            if abs(expected_amount - self.amount) > 0.01:
                return False, f"买入金额不匹配: 金额{self.amount} ≠ 份额×净值+手续费{expected_amount}"
        
        # 验证卖出时金额 ≈ 份额 × 净值 - 手续费
        if self.trade_type == TradeType.SELL.value:
            expected_amount = self.shares * self.nav - self.fee
            if abs(expected_amount - self.amount) > 0.01:
                return False, f"卖出金额不匹配: 金额{self.amount} ≠ 份额×净值-手续费{expected_amount}"
        
        return True, ""


class TradeManager:
    """
    交易管理器
    
    负责管理所有交易记录的增删改查操作
    """
    
    def __init__(self, data_dir: str = None):
        """
        初始化交易管理器
        
        Args:
            data_dir: 数据存储目录，默认为项目数据目录
        """
        if data_dir is None:
            # 默认使用项目数据目录
            base_dir = Path(__file__).parent.parent.parent
            data_dir = base_dir / "data" / "trades"
        
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        self.trades_file = self.data_dir / "trades.json"
        self._trades: Dict[str, TradeRecord] = {}
        self._load_trades()
    
    def _load_trades(self):
        """从文件加载交易记录"""
        if self.trades_file.exists():
            try:
                with open(self.trades_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for item in data:
                        trade = TradeRecord.from_dict(item)
                        self._trades[trade.id] = trade
                print(f"已加载 {len(self._trades)} 条交易记录")
            except Exception as e:
                print(f"加载交易记录失败: {e}")
                self._trades = {}
    
    def _save_trades(self):
        """保存交易记录到文件"""
        try:
            data = [trade.to_dict() for trade in self._trades.values()]
            with open(self.trades_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"保存交易记录失败: {e}")
            return False
    
    def _generate_id(self) -> str:
        """生成唯一交易ID"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        import random
        random_suffix = random.randint(1000, 9999)
        return f"TR{timestamp}{random_suffix}"
    
    def add_trade(self, 
                  trade_date: str,
                  fund_code: str,
                  trade_type: str,
                  amount: float,
                  shares: float,
                  nav: float,
                  fee: float = 0.0,
                  remark: str = "",
                  auto_save: bool = True) -> tuple[bool, Union[TradeRecord, str]]:
        """
        添加交易记录
        
        Args:
            trade_date: 交易日期 (YYYY-MM-DD)
            fund_code: 基金代码
            trade_type: 交易类型 (buy/sell)
            amount: 交易金额
            shares: 交易份额
            nav: 单位净值
            fee: 手续费
            remark: 备注
            auto_save: 是否自动保存
            
        Returns:
            (是否成功, TradeRecord对象或错误信息)
        """
        # 标准化基金代码
        fund_code = fund_code.strip()
        
        # 标准化交易类型
        trade_type = trade_type.lower().strip()
        
        # 创建交易记录
        trade = TradeRecord(
            id=self._generate_id(),
            trade_date=trade_date,
            fund_code=fund_code,
            trade_type=trade_type,
            amount=float(amount),
            shares=float(shares),
            nav=float(nav),
            fee=float(fee),
            remark=remark
        )
        
        # 验证数据
        is_valid, error_msg = trade.validate()
        if not is_valid:
            return False, error_msg
        
        # 保存到内存
        self._trades[trade.id] = trade
        
        # 自动保存到文件
        if auto_save:
            if not self._save_trades():
                return False, "保存到文件失败"
        
        return True, trade
    
    def update_trade(self, 
                     trade_id: str,
                     **kwargs) -> tuple[bool, Union[TradeRecord, str]]:
        """
        更新交易记录
        
        Args:
            trade_id: 交易ID
            **kwargs: 要更新的字段
            
        Returns:
            (是否成功, TradeRecord对象或错误信息)
        """
        if trade_id not in self._trades:
            return False, f"交易记录不存在: {trade_id}"
        
        trade = self._trades[trade_id]
        
        # 可更新的字段
        updatable_fields = ['trade_date', 'fund_code', 'trade_type', 
                           'amount', 'shares', 'nav', 'fee', 'remark', 'status']
        
        # 更新字段
        for key, value in kwargs.items():
            if key in updatable_fields:
                setattr(trade, key, value)
        
        # 更新时间戳
        trade.updated_at = datetime.now().isoformat()
        
        # 重新验证
        is_valid, error_msg = trade.validate()
        if not is_valid:
            return False, error_msg
        
        # 保存
        if not self._save_trades():
            return False, "保存到文件失败"
        
        return True, trade
    
    def delete_trade(self, trade_id: str) -> tuple[bool, str]:
        """
        删除交易记录
        
        Args:
            trade_id: 交易ID
            
        Returns:
            (是否成功, 信息)
        """
        if trade_id not in self._trades:
            return False, f"交易记录不存在: {trade_id}"
        
        del self._trades[trade_id]
        
        if not self._save_trades():
            return False, "保存到文件失败"
        
        return True, "删除成功"
    
    def get_trade(self, trade_id: str) -> Optional[TradeRecord]:
        """
        获取单条交易记录
        
        Args:
            trade_id: 交易ID
            
        Returns:
            TradeRecord对象或None
        """
        return self._trades.get(trade_id)
    
    def get_all_trades(self, 
                       fund_code: str = None,
                       trade_type: str = None,
                       start_date: str = None,
                       end_date: str = None,
                       status: str = None) -> List[TradeRecord]:
        """
        查询交易记录
        
        Args:
            fund_code: 按基金代码筛选
            trade_type: 按交易类型筛选 (buy/sell)
            start_date: 开始日期 (YYYY-MM-DD)
            end_date: 结束日期 (YYYY-MM-DD)
            status: 按状态筛选
            
        Returns:
            符合条件的交易记录列表
        """
        results = list(self._trades.values())
        
        if fund_code:
            results = [t for t in results if t.fund_code == fund_code]
        
        if trade_type:
            results = [t for t in results if t.trade_type == trade_type]
        
        if start_date:
            results = [t for t in results if t.trade_date >= start_date]
        
        if end_date:
            results = [t for t in results if t.trade_date <= end_date]
        
        if status:
            results = [t for t in results if t.status == status]
        
        # 按交易日期排序
        results.sort(key=lambda x: x.trade_date)
        
        return results
    
    def get_trades_by_fund(self, fund_code: str) -> List[TradeRecord]:
        """
        获取指定基金的所有交易记录
        
        Args:
            fund_code: 基金代码
            
        Returns:
            交易记录列表
        """
        return self.get_all_trades(fund_code=fund_code)
    
    def get_buy_trades(self, fund_code: str = None) -> List[TradeRecord]:
        """
        获取买入记录
        
        Args:
            fund_code: 基金代码（可选）
            
        Returns:
            买入交易记录列表
        """
        return self.get_all_trades(fund_code=fund_code, trade_type=TradeType.BUY.value)
    
    def get_sell_trades(self, fund_code: str = None) -> List[TradeRecord]:
        """
        获取卖出记录
        
        Args:
            fund_code: 基金代码（可选）
            
        Returns:
            卖出交易记录列表
        """
        return self.get_all_trades(fund_code=fund_code, trade_type=TradeType.SELL.value)
    
    def get_fund_codes(self) -> List[str]:
        """
        获取所有交易过的基金代码列表
        
        Returns:
            基金代码列表
        """
        codes = set(trade.fund_code for trade in self._trades.values())
        return sorted(list(codes))
    
    def get_trade_summary(self) -> Dict:
        """
        获取交易统计摘要
        
        Returns:
            统计信息字典
        """
        total_trades = len(self._trades)
        buy_trades = len([t for t in self._trades.values() if t.trade_type == TradeType.BUY.value])
        sell_trades = len([t for t in self._trades.values() if t.trade_type == TradeType.SELL.value])
        
        total_buy_amount = sum(t.amount for t in self._trades.values() if t.trade_type == TradeType.BUY.value)
        total_sell_amount = sum(t.amount for t in self._trades.values() if t.trade_type == TradeType.SELL.value)
        
        total_fee = sum(t.fee for t in self._trades.values())
        
        return {
            "total_trades": total_trades,
            "buy_trades": buy_trades,
            "sell_trades": sell_trades,
            "total_buy_amount": round(total_buy_amount, 2),
            "total_sell_amount": round(total_sell_amount, 2),
            "total_fee": round(total_fee, 2),
            "fund_count": len(self.get_fund_codes())
        }
    
    def export_to_csv(self, filepath: str) -> bool:
        """
        导出交易记录到CSV
        
        Args:
            filepath: CSV文件路径
            
        Returns:
            是否成功
        """
        import csv
        
        try:
            trades = self.get_all_trades()
            with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f)
                writer.writerow(['交易ID', '交易日期', '基金代码', '交易类型', 
                                '交易金额', '交易份额', '单位净值', '手续费', 
                                '状态', '备注', '创建时间'])
                for t in trades:
                    writer.writerow([
                        t.id, t.trade_date, t.fund_code, 
                        '买入' if t.trade_type == 'buy' else '卖出',
                        t.amount, t.shares, t.nav, t.fee,
                        t.status, t.remark, t.created_at
                    ])
            return True
        except Exception as e:
            print(f"导出CSV失败: {e}")
            return False
    
    def import_from_csv(self, filepath: str) -> tuple[int, int, List[str]]:
        """
        从CSV导入交易记录
        
        Args:
            filepath: CSV文件路径
            
        Returns:
            (成功数量, 失败数量, 错误信息列表)
        """
        import csv
        
        success_count = 0
        fail_count = 0
        errors = []
        
        try:
            with open(filepath, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        # 映射CSV字段
                        trade_type = row.get('交易类型', '').strip()
                        if trade_type == '买入':
                            trade_type = 'buy'
                        elif trade_type == '卖出':
                            trade_type = 'sell'
                        
                        success, result = self.add_trade(
                            trade_date=row.get('交易日期', '').strip(),
                            fund_code=row.get('基金代码', '').strip(),
                            trade_type=trade_type,
                            amount=float(row.get('交易金额', 0)),
                            shares=float(row.get('交易份额', 0)),
                            nav=float(row.get('单位净值', 0)),
                            fee=float(row.get('手续费', 0)),
                            remark=row.get('备注', ''),
                            auto_save=False  # 批量导入时最后统一保存
                        )
                        
                        if success:
                            success_count += 1
                        else:
                            fail_count += 1
                            errors.append(f"行 {success_count + fail_count}: {result}")
                    except Exception as e:
                        fail_count += 1
                        errors.append(f"行 {success_count + fail_count}: {str(e)}")
                
                # 统一保存
                self._save_trades()
                
        except Exception as e:
            errors.append(f"读取文件失败: {e}")
        
        return success_count, fail_count, errors


# 全局交易管理器实例
trade_manager = TradeManager()


if __name__ == "__main__":
    # 测试代码
    print("=" * 60)
    print("交易管理模块测试")
    print("=" * 60)
    
    # 创建新的管理器实例（使用临时目录）
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        manager = TradeManager(tmpdir)
        
        # 添加买入记录
        print("\n1. 添加买入记录")
        shares = 96.15
        nav = 103.90
        fee = 10.0
        amount = shares * nav + fee  # 买入金额 = 份额 * 净值 + 手续费
        success, result = manager.add_trade(
            trade_date="2024-01-15",
            fund_code="510300",
            trade_type="buy",
            amount=round(amount, 2),
            shares=shares,
            nav=nav,
            fee=fee,
            remark="首次建仓"
        )
        if success:
            print(f"   ✓ 买入记录添加成功: {result.id}")
        else:
            print(f"   ✗ 失败: {result}")
        
        # 添加卖出记录
        print("\n2. 添加卖出记录")
        shares = 47.0
        nav = 106.38
        fee = 5.0
        amount = shares * nav - fee  # 卖出金额 = 份额 * 净值 - 手续费
        success, result = manager.add_trade(
            trade_date="2024-02-20",
            fund_code="510300",
            trade_type="sell",
            amount=round(amount, 2),
            shares=shares,
            nav=nav,
            fee=fee,
            remark="部分止盈"
        )
        if success:
            print(f"   ✓ 卖出记录添加成功: {result.id}")
        else:
            print(f"   ✗ 失败: {result}")
        
        # 查询所有记录
        print("\n3. 查询所有交易记录")
        trades = manager.get_all_trades()
        for t in trades:
            print(f"   {t.trade_date} {t.fund_code} {'买入' if t.trade_type == 'buy' else '卖出'} {t.amount}元")
        
        # 获取统计摘要
        print("\n4. 交易统计摘要")
        summary = manager.get_trade_summary()
        for key, value in summary.items():
            print(f"   {key}: {value}")
        
        print("\n" + "=" * 60)
        print("测试完成！")
        print("=" * 60)
