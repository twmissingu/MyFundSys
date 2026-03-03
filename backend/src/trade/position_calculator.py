#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
持仓计算器模块
负责实时持仓计算、成本核算、收益计算
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from collections import defaultdict

from trade_manager import TradeManager, TradeType, TradeRecord


@dataclass
class Position:
    """
    持仓数据类
    
    Attributes:
        fund_code: 基金代码
        fund_name: 基金名称
        total_shares: 总持仓份额
        available_shares: 可用份额（扣除冻结）
        avg_cost: 平均成本价
        total_cost: 总成本
        current_nav: 最新净值
        market_value: 市值
        unrealized_pnl: 未实现盈亏
        realized_pnl: 已实现盈亏
        total_pnl: 总盈亏
        pnl_rate: 收益率
        buy_count: 买入次数
        sell_count: 卖出次数
        first_buy_date: 首次买入日期
        last_trade_date: 最后交易日期
    """
    fund_code: str
    fund_name: str = ""
    total_shares: float = 0.0
    available_shares: float = 0.0
    avg_cost: float = 0.0
    total_cost: float = 0.0
    current_nav: float = 0.0
    market_value: float = 0.0
    unrealized_pnl: float = 0.0
    realized_pnl: float = 0.0
    total_pnl: float = 0.0
    pnl_rate: float = 0.0
    buy_count: int = 0
    sell_count: int = 0
    first_buy_date: str = ""
    last_trade_date: str = ""
    
    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            'fund_code': self.fund_code,
            'fund_name': self.fund_name,
            'total_shares': round(self.total_shares, 4),
            'available_shares': round(self.available_shares, 4),
            'avg_cost': round(self.avg_cost, 4),
            'total_cost': round(self.total_cost, 2),
            'current_nav': round(self.current_nav, 4),
            'market_value': round(self.market_value, 2),
            'unrealized_pnl': round(self.unrealized_pnl, 2),
            'realized_pnl': round(self.realized_pnl, 2),
            'total_pnl': round(self.total_pnl, 2),
            'pnl_rate': round(self.pnl_rate, 4),
            'buy_count': self.buy_count,
            'sell_count': self.sell_count,
            'first_buy_date': self.first_buy_date,
            'last_trade_date': self.last_trade_date
        }


@dataclass
class PortfolioSummary:
    """
    投资组合摘要
    
    Attributes:
        total_cost: 总投入成本
        total_market_value: 总市值
        total_unrealized_pnl: 总未实现盈亏
        total_realized_pnl: 总已实现盈亏
        total_pnl: 总盈亏
        total_pnl_rate: 总收益率
        position_count: 持仓基金数量
        max_drawdown: 最大回撤
        sharpe_ratio: 夏普比率
    """
    total_cost: float = 0.0
    total_market_value: float = 0.0
    total_unrealized_pnl: float = 0.0
    total_realized_pnl: float = 0.0
    total_pnl: float = 0.0
    total_pnl_rate: float = 0.0
    position_count: int = 0
    max_drawdown: float = 0.0
    sharpe_ratio: float = 0.0
    
    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            'total_cost': round(self.total_cost, 2),
            'total_market_value': round(self.total_market_value, 2),
            'total_unrealized_pnl': round(self.total_unrealized_pnl, 2),
            'total_realized_pnl': round(self.total_realized_pnl, 2),
            'total_pnl': round(self.total_pnl, 2),
            'total_pnl_rate': round(self.total_pnl_rate, 4),
            'position_count': self.position_count,
            'max_drawdown': round(self.max_drawdown, 4),
            'sharpe_ratio': round(self.sharpe_ratio, 4)
        }


class PositionCalculator:
    """
    持仓计算器
    
    负责计算持仓、成本、收益等核心指标
    """
    
    def __init__(self, trade_manager: TradeManager = None):
        """
        初始化持仓计算器
        
        Args:
            trade_manager: 交易管理器实例
        """
        self.trade_manager = trade_manager or TradeManager()
        # 缓存最新净值 {fund_code: nav}
        self._nav_cache: Dict[str, float] = {}
    
    def set_nav(self, fund_code: str, nav: float):
        """
        设置基金最新净值
        
        Args:
            fund_code: 基金代码
            nav: 最新净值
        """
        self._nav_cache[fund_code] = nav
    
    def set_nav_batch(self, nav_dict: Dict[str, float]):
        """
        批量设置基金净值
        
        Args:
            nav_dict: {基金代码: 净值} 字典
        """
        self._nav_cache.update(nav_dict)
    
    def calculate_position(self, fund_code: str, 
                          current_nav: float = None) -> Optional[Position]:
        """
        计算单个基金的持仓
        
        使用加权平均法计算成本价
        
        Args:
            fund_code: 基金代码
            current_nav: 当前净值（可选，默认使用缓存）
            
        Returns:
            Position对象或None（无持仓）
        """
        # 获取该基金的买入和卖出记录
        buy_trades = self.trade_manager.get_buy_trades(fund_code)
        sell_trades = self.trade_manager.get_sell_trades(fund_code)
        
        # 按日期排序
        all_trades = sorted(buy_trades + sell_trades, key=lambda x: x.trade_date)
        
        if not all_trades:
            return None
        
        # 使用FIFO（先进先出）或加权平均法计算持仓
        # 这里使用加权平均法
        total_shares = 0.0
        total_cost = 0.0
        realized_pnl = 0.0
        
        buy_count = 0
        sell_count = 0
        first_buy_date = ""
        last_trade_date = ""
        
        for trade in all_trades:
            if trade.status != 'confirmed':
                continue
                
            if trade.trade_type == TradeType.BUY.value:
                # 买入：增加份额和成本
                shares = trade.shares
                cost = trade.amount - trade.fee  # 实际投入成本
                
                total_shares += shares
                total_cost += cost
                buy_count += 1
                
                if not first_buy_date:
                    first_buy_date = trade.trade_date
                    
            else:  # SELL
                # 卖出：减少份额，计算已实现盈亏
                sell_shares = trade.shares
                sell_amount = trade.amount - trade.fee
                
                if total_shares > 0:
                    # 计算卖出部分的平均成本
                    avg_cost_per_share = total_cost / total_shares if total_shares > 0 else 0
                    sell_cost = sell_shares * avg_cost_per_share
                    
                    # 已实现盈亏 = 卖出金额 - 卖出部分的成本
                    trade_realized_pnl = sell_amount - sell_cost
                    realized_pnl += trade_realized_pnl
                    
                    # 减少持仓
                    total_shares -= sell_shares
                    total_cost -= sell_cost
                
                sell_count += 1
            
            last_trade_date = trade.trade_date
        
        # 如果持仓为0，返回None
        if total_shares <= 0:
            # 返回一个表示已清仓的Position
            position = Position(
                fund_code=fund_code,
                total_shares=0,
                available_shares=0,
                avg_cost=0,
                total_cost=0,
                realized_pnl=realized_pnl,
                total_pnl=realized_pnl,
                buy_count=buy_count,
                sell_count=sell_count,
                first_buy_date=first_buy_date,
                last_trade_date=last_trade_date
            )
            return position
        
        # 计算平均成本
        avg_cost = total_cost / total_shares if total_shares > 0 else 0
        
        # 获取当前净值
        if current_nav is None:
            current_nav = self._nav_cache.get(fund_code, 0)
        
        # 计算市值和盈亏
        market_value = total_shares * current_nav if current_nav > 0 else 0
        unrealized_pnl = market_value - total_cost if current_nav > 0 else 0
        total_pnl = realized_pnl + unrealized_pnl
        pnl_rate = (total_pnl / total_cost) if total_cost > 0 else 0
        
        position = Position(
            fund_code=fund_code,
            total_shares=total_shares,
            available_shares=total_shares,  # 暂时不考虑冻结份额
            avg_cost=avg_cost,
            total_cost=total_cost,
            current_nav=current_nav,
            market_value=market_value,
            unrealized_pnl=unrealized_pnl,
            realized_pnl=realized_pnl,
            total_pnl=total_pnl,
            pnl_rate=pnl_rate,
            buy_count=buy_count,
            sell_count=sell_count,
            first_buy_date=first_buy_date,
            last_trade_date=last_trade_date
        )
        
        return position
    
    def calculate_all_positions(self) -> Dict[str, Position]:
        """
        计算所有持仓
        
        Returns:
            {基金代码: Position} 字典
        """
        positions = {}
        fund_codes = self.trade_manager.get_fund_codes()
        
        for fund_code in fund_codes:
            position = self.calculate_position(fund_code)
            if position:
                positions[fund_code] = position
        
        return positions
    
    def calculate_portfolio_summary(self) -> PortfolioSummary:
        """
        计算投资组合摘要
        
        Returns:
            PortfolioSummary对象
        """
        positions = self.calculate_all_positions()
        
        total_cost = 0.0
        total_market_value = 0.0
        total_unrealized_pnl = 0.0
        total_realized_pnl = 0.0
        
        for position in positions.values():
            total_cost += position.total_cost
            total_market_value += position.market_value
            total_unrealized_pnl += position.unrealized_pnl
            total_realized_pnl += position.realized_pnl
        
        total_pnl = total_unrealized_pnl + total_realized_pnl
        total_pnl_rate = (total_pnl / total_cost) if total_cost > 0 else 0
        
        summary = PortfolioSummary(
            total_cost=total_cost,
            total_market_value=total_market_value,
            total_unrealized_pnl=total_unrealized_pnl,
            total_realized_pnl=total_realized_pnl,
            total_pnl=total_pnl,
            total_pnl_rate=total_pnl_rate,
            position_count=len(positions)
        )
        
        return summary
    
    def get_position_with_trades(self, fund_code: str) -> Tuple[Optional[Position], List[TradeRecord]]:
        """
        获取持仓及对应交易记录
        
        Args:
            fund_code: 基金代码
            
        Returns:
            (Position对象, 交易记录列表)
        """
        position = self.calculate_position(fund_code)
        trades = self.trade_manager.get_trades_by_fund(fund_code)
        return position, trades
    
    def calculate_holding_return(self, fund_code: str) -> Dict:
        """
        计算持仓收益详情
        
        Args:
            fund_code: 基金代码
            
        Returns:
            收益详情字典
        """
        position = self.calculate_position(fund_code)
        if not position:
            return {
                'fund_code': fund_code,
                'has_position': False,
                'message': '无持仓'
            }
        
        return {
            'fund_code': fund_code,
            'has_position': position.total_shares > 0,
            'total_shares': position.total_shares,
            'avg_cost': position.avg_cost,
            'current_nav': position.current_nav,
            'total_cost': position.total_cost,
            'market_value': position.market_value,
            'unrealized_pnl': position.unrealized_pnl,
            'realized_pnl': position.realized_pnl,
            'total_pnl': position.total_pnl,
            'pnl_rate': position.pnl_rate,
            'pnl_rate_pct': f"{position.pnl_rate * 100:.2f}%"
        }
    
    def calculate_xirr(self, fund_code: str = None) -> float:
        """
        计算内部收益率（XIRR）
        
        Args:
            fund_code: 基金代码（None则计算整个组合的XIRR）
            
        Returns:
            XIRR值
        """
        try:
            from scipy.optimize import newton
        except ImportError:
            print("警告: 需要安装 scipy 以计算XIRR")
            return 0.0
        
        # 获取现金流
        cashflows = []
        dates = []
        
        if fund_code:
            trades = self.trade_manager.get_trades_by_fund(fund_code)
            position = self.calculate_position(fund_code)
            # 添加当前市值作为最后一笔现金流
            if position and position.market_value > 0:
                trades = list(trades)
        else:
            trades = self.trade_manager.get_all_trades()
            summary = self.calculate_portfolio_summary()
        
        for trade in trades:
            if trade.status != 'confirmed':
                continue
            
            date = datetime.strptime(trade.trade_date, "%Y-%m-%d")
            
            if trade.trade_type == TradeType.BUY.value:
                # 买入为负现金流
                cashflows.append(-trade.amount)
            else:
                # 卖出为正现金流
                cashflows.append(trade.amount - trade.fee)
            
            dates.append(date)
        
        # 添加当前持仓市值作为最后一笔正现金流
        if fund_code:
            if position and position.market_value > 0:
                cashflows.append(position.market_value)
                dates.append(datetime.now())
        else:
            if summary.total_market_value > 0:
                cashflows.append(summary.total_market_value)
                dates.append(datetime.now())
        
        if len(cashflows) < 2:
            return 0.0
        
        # 计算XIRR
        def xnpv(rate):
            return sum([cf / ((1 + rate) ** ((d - dates[0]).days / 365.0))
                       for cf, d in zip(cashflows, dates)])
        
        try:
            return newton(xnpv, 0.1)
        except:
            return 0.0
    
    def get_asset_allocation(self) -> Dict[str, float]:
        """
        获取资产配置分析
        
        Returns:
            {资产类别: 占比} 字典
        """
        positions = self.calculate_all_positions()
        
        # 按基金分类统计（这里简化处理，实际需要基金分类数据）
        allocation = defaultdict(float)
        total_value = sum(p.market_value for p in positions.values())
        
        if total_value == 0:
            return {}
        
        for fund_code, position in positions.items():
            # 这里可以根据基金代码前缀或其他方式判断资产类别
            # 简化：按代码前缀分类
            if fund_code.startswith(('51', '56', '58')):
                category = '宽基ETF'
            elif fund_code.startswith('15'):
                category = '行业/主题ETF'
            elif fund_code.startswith('16'):
                category = 'LOF/QDII'
            elif fund_code.startswith('11'):
                category = '债券基金'
            else:
                category = '其他'
            
            allocation[category] += position.market_value / total_value
        
        return dict(allocation)
    
    def generate_report(self) -> Dict:
        """
        生成完整的持仓报告
        
        Returns:
            报告字典
        """
        positions = self.calculate_all_positions()
        summary = self.calculate_portfolio_summary()
        
        # 按盈亏排序
        sorted_positions = sorted(
            positions.values(),
            key=lambda x: x.total_pnl,
            reverse=True
        )
        
        return {
            'generated_at': datetime.now().isoformat(),
            'summary': summary.to_dict(),
            'positions': [p.to_dict() for p in sorted_positions],
            'asset_allocation': self.get_asset_allocation(),
            'top_gainers': [p.to_dict() for p in sorted_positions[:5] if p.total_pnl > 0],
            'top_losers': [p.to_dict() for p in sorted_positions[-5:] if p.total_pnl < 0]
        }


# 全局持仓计算器实例
position_calculator = PositionCalculator()


if __name__ == "__main__":
    # 测试代码
    print("=" * 60)
    print("持仓计算器模块测试")
    print("=" * 60)
    
    # 创建测试数据
    import tempfile
    from pathlib import Path
    
    with tempfile.TemporaryDirectory() as tmpdir:
        # 创建交易管理器
        trade_mgr = TradeManager(tmpdir)
        
        # 添加测试交易记录
        print("\n1. 添加测试交易记录")
        
        # 买入510300
        # 金额 = 份额 * 净值 + 手续费
        trade_mgr.add_trade(
            trade_date="2024-01-15",
            fund_code="510300",
            trade_type="buy",
            amount=round(96.15 * 103.90 + 10.0, 2),
            shares=96.15,
            nav=103.90,
            fee=10.0
        )
        
        trade_mgr.add_trade(
            trade_date="2024-02-15",
            fund_code="510300",
            trade_type="buy",
            amount=round(48.5 * 102.06 + 5.0, 2),
            shares=48.5,
            nav=102.06,
            fee=5.0
        )
        
        # 买入512000
        trade_mgr.add_trade(
            trade_date="2024-01-20",
            fund_code="512000",
            trade_type="buy",
            amount=round(123.45 * 64.80 + 8.0, 2),
            shares=123.45,
            nav=64.80,
            fee=8.0
        )
        
        # 部分卖出510300
        # 卖出金额 = 份额 * 净值 - 手续费
        trade_mgr.add_trade(
            trade_date="2024-03-15",
            fund_code="510300",
            trade_type="sell",
            amount=round(70.0 * 107.14 - 7.5, 2),
            shares=70.0,
            nav=107.14,
            fee=7.5
        )
        
        # 创建持仓计算器
        calc = PositionCalculator(trade_mgr)
        
        # 设置最新净值
        calc.set_nav("510300", 108.50)
        calc.set_nav("512000", 66.20)
        
        # 计算持仓
        print("\n2. 计算单个基金持仓")
        position = calc.calculate_position("510300")
        if position:
            print(f"   基金: {position.fund_code}")
            print(f"   持仓份额: {position.total_shares}")
            print(f"   平均成本: {position.avg_cost}")
            print(f"   最新净值: {position.current_nav}")
            print(f"   市值: {position.market_value}")
            print(f"   未实现盈亏: {position.unrealized_pnl}")
            print(f"   已实现盈亏: {position.realized_pnl}")
            print(f"   总盈亏: {position.total_pnl}")
            print(f"   收益率: {position.pnl_rate * 100:.2f}%")
        
        # 计算所有持仓
        print("\n3. 计算所有持仓")
        all_positions = calc.calculate_all_positions()
        for code, pos in all_positions.items():
            print(f"   {code}: 份额={pos.total_shares:.2f}, 市值={pos.market_value:.2f}, 盈亏={pos.total_pnl:.2f}")
        
        # 投资组合摘要
        print("\n4. 投资组合摘要")
        summary = calc.calculate_portfolio_summary()
        print(f"   总成本: {summary.total_cost}")
        print(f"   总市值: {summary.total_market_value}")
        print(f"   总未实现盈亏: {summary.total_unrealized_pnl}")
        print(f"   总已实现盈亏: {summary.total_realized_pnl}")
        print(f"   总盈亏: {summary.total_pnl}")
        print(f"   总收益率: {summary.total_pnl_rate * 100:.2f}%")
        print(f"   持仓数量: {summary.position_count}")
        
        # 生成报告
        print("\n5. 生成完整报告")
        report = calc.generate_report()
        print(f"   报告生成时间: {report['generated_at']}")
        print(f"   持仓基金数: {len(report['positions'])}")
        
        print("\n" + "=" * 60)
        print("测试完成！")
        print("=" * 60)
