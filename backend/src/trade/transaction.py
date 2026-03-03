#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
交易管理模块
Transaction Management Module
"""

import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

from .database import DatabaseManager, get_connection
from .models import Trade

logger = logging.getLogger('fund_system')


class TradeManager:
    """交易管理器"""
    
    def __init__(self):
        self.db = DatabaseManager()
    
    def record_buy(self, fund_code: str, date: str, shares: float, 
                   amount: float, remark: str = None) -> Trade:
        """记录买入交易"""
        price = amount / shares if shares > 0 else 0
        
        trade = Trade(
            fund_code=fund_code,
            date=date,
            type='buy',
            shares=shares,
            amount=amount,
            price=price,
            remark=remark
        )
        
        trade.id = self.db.insert('trades', {
            'fund_code': trade.fund_code,
            'date': trade.date,
            'type': trade.type,
            'shares': trade.shares,
            'amount': trade.amount,
            'price': trade.price,
            'remark': trade.remark
        })
        
        logger.info(f"Recorded buy: {fund_code} {shares} shares @ {price:.4f}")
        return trade
    
    def record_sell(self, fund_code: str, date: str, shares: float,
                    amount: float, remark: str = None) -> Trade:
        """记录卖出交易"""
        price = amount / shares if shares > 0 else 0
        
        trade = Trade(
            fund_code=fund_code,
            date=date,
            type='sell',
            shares=shares,
            amount=amount,
            price=price,
            remark=remark
        )
        
        trade.id = self.db.insert('trades', {
            'fund_code': trade.fund_code,
            'date': trade.date,
            'type': trade.type,
            'shares': trade.shares,
            'amount': trade.amount,
            'price': trade.price,
            'remark': trade.remark
        })
        
        logger.info(f"Recorded sell: {fund_code} {shares} shares @ {price:.4f}")
        return trade
    
    def get_trade(self, trade_id: int) -> Optional[Trade]:
        """获取单条交易记录"""
        sql = 'SELECT * FROM trades WHERE id = ?'
        row = self.db.fetchone(sql, (trade_id,))
        
        if row:
            return Trade(**row)
        return None
    
    def get_all_trades(self, fund_code: str = None, trade_type: str = None,
                       start_date: str = None, end_date: str = None) -> List[Trade]:
        """获取交易记录列表"""
        sql = 'SELECT * FROM trades WHERE 1=1'
        params = []
        
        if fund_code:
            sql += ' AND fund_code = ?'
            params.append(fund_code)
        
        if trade_type:
            sql += ' AND type = ?'
            params.append(trade_type)
        
        if start_date:
            sql += ' AND date >= ?'
            params.append(start_date)
        
        if end_date:
            sql += ' AND date <= ?'
            params.append(end_date)
        
        sql += ' ORDER BY date DESC, id DESC'
        
        rows = self.db.fetchall(sql, tuple(params))
        return [Trade(**row) for row in rows]
    
    def get_fund_trades(self, fund_code: str) -> List[Trade]:
        """获取指定基金的交易记录"""
        return self.get_all_trades(fund_code=fund_code)
    
    def delete_trade(self, trade_id: int) -> bool:
        """删除交易记录"""
        rowcount = self.db.delete('trades', 'id = ?', (trade_id,))
        
        if rowcount > 0:
            logger.info(f"Deleted trade: {trade_id}")
            return True
        return False
    
    def get_trade_summary(self, fund_code: str = None) -> Dict[str, Any]:
        """获取交易统计摘要"""
        sql = '''
            SELECT 
                type,
                COUNT(*) as count,
                SUM(shares) as total_shares,
                SUM(amount) as total_amount
            FROM trades
            WHERE 1=1
        '''
        params = []
        
        if fund_code:
            sql += ' AND fund_code = ?'
            params.append(fund_code)
        
        sql += ' GROUP BY type'
        
        rows = self.db.fetchall(sql, tuple(params))
        
        summary = {
            'buy_count': 0,
            'buy_amount': 0.0,
            'sell_count': 0,
            'sell_amount': 0.0
        }
        
        for row in rows:
            if row['type'] == 'buy':
                summary['buy_count'] = row['count']
                summary['buy_amount'] = row['total_amount'] or 0
            elif row['type'] == 'sell':
                summary['sell_count'] = row['count']
                summary['sell_amount'] = row['total_amount'] or 0
        
        return summary
