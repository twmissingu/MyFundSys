#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
持仓与收益计算模块
Holding and Profit Calculator Module
"""

import logging
from typing import List, Dict, Any, Optional
from collections import deque

from ..core.database import DatabaseManager
from ..core.models import Holding
from .transaction import TradeManager

logger = logging.getLogger('fund_system')


class HoldingCalculator:
    """持仓计算器"""
    
    def __init__(self):
        self.db = DatabaseManager()
        self.trade_manager = TradeManager()
    
    def calculate_holding(self, fund_code: str, current_nav: float = None) -> Optional[Holding]:
        """计算指定基金的持仓（FIFO成本法）"""
        trades = self.trade_manager.get_fund_trades(fund_code)
        
        if not trades:
            return None
        
        # 按日期排序
        trades.sort(key=lambda x: (x.date, x.id))
        
        # FIFO队列
        buy_queue = deque()  # (shares, cost_per_share)
        total_sell_amount = 0.0
        total_sell_cost = 0.0
        
        for trade in trades:
            if trade.type == 'buy':
                cost_per_share = trade.amount / trade.shares if trade.shares > 0 else 0
                buy_queue.append({
                    'shares': trade.shares,
                    'cost': cost_per_share
                })
            elif trade.type == 'sell':
                sell_shares = trade.shares
                sell_amount = trade.amount
                sell_cost = 0.0
                
                while sell_shares > 0 and buy_queue:
                    lot = buy_queue[0]
                    if lot['shares'] <= sell_shares:
                        sell_cost += lot['shares'] * lot['cost']
                        sell_shares -= lot['shares']
                        buy_queue.popleft()
                    else:
                        sell_cost += sell_shares * lot['cost']
                        lot['shares'] -= sell_shares
                        sell_shares = 0
                
                total_sell_amount += sell_amount
                total_sell_cost += sell_cost
        
        # 计算当前持仓
        remaining_shares = sum(lot['shares'] for lot in buy_queue)
        remaining_cost = sum(lot['shares'] * lot['cost'] for lot in buy_queue)
        avg_cost = remaining_cost / remaining_shares if remaining_shares > 0 else 0
        
        # 获取基金名称
        fund_sql = 'SELECT name FROM funds WHERE code = ?'
        fund_row = self.db.fetchone(fund_sql, (fund_code,))
        fund_name = fund_row['name'] if fund_row else None
        
        # 如果未提供当前净值，使用数据库中的值
        if current_nav is None:
            nav_sql = 'SELECT nav FROM funds WHERE code = ?'
            nav_row = self.db.fetchone(nav_sql, (fund_code,))
            current_nav = nav_row['nav'] if nav_row and nav_row['nav'] else avg_cost
        
        market_value = remaining_shares * current_nav
        unrealized_profit = market_value - remaining_cost
        unrealized_profit_pct = (unrealized_profit / remaining_cost * 100) if remaining_cost > 0 else 0
        
        return Holding(
            fund_code=fund_code,
            fund_name=fund_name,
            shares=remaining_shares,
            avg_cost=avg_cost,
            current_nav=current_nav,
            market_value=market_value,
            unrealized_profit=unrealized_profit,
            unrealized_profit_pct=unrealized_profit_pct
        )
    
    def get_all_holdings(self) -> List[Holding]:
        """获取所有持仓"""
        # 获取有交易记录的所有基金
        sql = 'SELECT DISTINCT fund_code FROM trades ORDER BY fund_code'
        rows = self.db.fetchall(sql)
        
        holdings = []
        for row in rows:
            holding = self.calculate_holding(row['fund_code'])
            if holding and holding.shares > 0:
                holdings.append(holding)
        
        return holdings
    
    def get_holding_summary(self) -> Dict[str, Any]:
        """获取持仓汇总"""
        holdings = self.get_all_holdings()
        
        total_value = sum(h.market_value for h in holdings)
        total_cost = sum(h.shares * h.avg_cost for h in holdings)
        total_profit = total_value - total_cost
        total_profit_pct = (total_profit / total_cost * 100) if total_cost > 0 else 0
        
        return {
            'holding_count': len(holdings),
            'total_value': total_value,
            'total_cost': total_cost,
            'total_profit': total_profit,
            'total_profit_pct': total_profit_pct
        }


class ProfitCalculator:
    """收益计算器"""
    
    def __init__(self):
        self.db = DatabaseManager()
        self.trade_manager = TradeManager()
    
    def calculate_realized_profit(self, fund_code: str) -> float:
        """计算已实现收益（基于FIFO）"""
        trades = self.trade_manager.get_fund_trades(fund_code)
        trades.sort(key=lambda x: (x.date, x.id))
        
        buy_queue = deque()
        total_realized_profit = 0.0
        
        for trade in trades:
            if trade.type == 'buy':
                cost_per_share = trade.amount / trade.shares if trade.shares > 0 else 0
                buy_queue.append({
                    'shares': trade.shares,
                    'cost': cost_per_share
                })
            elif trade.type == 'sell':
                sell_shares = trade.shares
                sell_amount = trade.amount
                sell_cost = 0.0
                
                while sell_shares > 0 and buy_queue:
                    lot = buy_queue[0]
                    if lot['shares'] <= sell_shares:
                        sell_cost += lot['shares'] * lot['cost']
                        sell_shares -= lot['shares']
                        buy_queue.popleft()
                    else:
                        sell_cost += sell_shares * lot['cost']
                        lot['shares'] -= sell_shares
                        sell_shares = 0
                
                total_realized_profit += (sell_amount - sell_cost)
        
        return total_realized_profit
    
    def calculate_all_profits(self) -> Dict[str, Any]:
        """计算所有收益"""
        holding_calc = HoldingCalculator()
        holdings = holding_calc.get_all_holdings()
        
        # 未实现收益
        total_unrealized = sum(h.unrealized_profit for h in holdings)
        
        # 已实现收益
        realized_by_fund = {}
        for h in holdings:
            realized_by_fund[h.fund_code] = self.calculate_realized_profit(h.fund_code)
        total_realized = sum(realized_by_fund.values())
        
        # 总资产和成本
        total_value = sum(h.market_value for h in holdings)
        total_cost = total_value - total_unrealized
        
        return {
            'realized_profit': total_realized,
            'unrealized_profit': total_unrealized,
            'total_profit': total_realized + total_unrealized,
            'total_value': total_value,
            'total_cost': total_cost,
            'total_return_pct': ((total_realized + total_unrealized) / total_cost * 100) if total_cost > 0 else 0,
            'realized_by_fund': realized_by_fund
        }
