#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
基金管理模块
Fund Management Module
"""

import csv
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

from .database import DatabaseManager, get_connection
from .models import Fund

logger = logging.getLogger('fund_system')


class FundManager:
    """基金管理器"""
    
    def __init__(self):
        self.db = DatabaseManager()
    
    def add_fund(self, code: str, name: str = None, category: str = 'unknown',
                 market: str = '', asset_type: str = '', source: str = 'manual',
                 mentions: int = 0) -> Fund:
        """添加基金"""
        fund = Fund(
            code=code,
            name=name,
            category=category,
            market=market,
            asset_type=asset_type,
            source=source,
            mentions=mentions
        )
        
        sql = '''
            INSERT OR REPLACE INTO funds 
            (code, name, category, market, asset_type, source, mentions, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        '''
        
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, (
                fund.code, fund.name, fund.category, fund.market,
                fund.asset_type, fund.source, fund.mentions,
                datetime.now().isoformat()
            ))
        
        logger.info(f"Added fund: {code} - {name}")
        return fund
    
    def get_fund(self, code: str) -> Optional[Fund]:
        """获取基金信息"""
        sql = 'SELECT * FROM funds WHERE code = ?'
        row = self.db.fetchone(sql, (code,))
        
        if row:
            return Fund(**row)
        return None
    
    def get_all_funds(self, category: str = None, market: str = None) -> List[Fund]:
        """获取所有基金列表"""
        sql = 'SELECT * FROM funds WHERE 1=1'
        params = []
        
        if category:
            sql += ' AND category = ?'
            params.append(category)
        
        if market:
            sql += ' AND market = ?'
            params.append(market)
        
        sql += ' ORDER BY code'
        
        rows = self.db.fetchall(sql, tuple(params))
        return [Fund(**row) for row in rows]
    
    def update_fund(self, code: str, **kwargs) -> bool:
        """更新基金信息"""
        allowed_fields = ['name', 'category', 'market', 'asset_type', 'nav', 'nav_date']
        data = {k: v for k, v in kwargs.items() if k in allowed_fields}
        
        if not data:
            return False
        
        data['updated_at'] = datetime.now().isoformat()
        rowcount = self.db.update('funds', data, 'code = ?', (code,))
        
        if rowcount > 0:
            logger.info(f"Updated fund: {code}")
            return True
        return False
    
    def delete_fund(self, code: str) -> bool:
        """删除基金"""
        rowcount = self.db.delete('funds', 'code = ?', (code,))
        
        if rowcount > 0:
            logger.info(f"Deleted fund: {code}")
            return True
        return False
    
    def search_funds(self, keyword: str) -> List[Fund]:
        """搜索基金"""
        sql = '''
            SELECT * FROM funds 
            WHERE code LIKE ? OR name LIKE ?
            ORDER BY code
        '''
        pattern = f'%{keyword}%'
        rows = self.db.fetchall(sql, (pattern, pattern))
        return [Fund(**row) for row in rows]
    
    def import_from_csv(self, csv_path: str) -> int:
        """从CSV导入基金列表"""
        count = 0
        
        try:
            with open(csv_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                for row in reader:
                    code = row.get('code', '').strip()
                    if not code:
                        continue
                    
                    self.add_fund(
                        code=code,
                        name=row.get('name', '').strip() or None,
                        category=row.get('category', 'unknown').strip(),
                        market=row.get('market', '').strip(),
                        asset_type=row.get('asset_type', '').strip(),
                        source=row.get('source', 'csv').strip(),
                        mentions=int(row.get('mentions', 0) or 0)
                    )
                    count += 1
            
            logger.info(f"Imported {count} funds from {csv_path}")
            return count
            
        except Exception as e:
            logger.error(f"Failed to import from CSV: {e}")
            raise
    
    def get_category_distribution(self) -> Dict[str, int]:
        """获取基金分类分布"""
        sql = '''
            SELECT category, COUNT(*) as count 
            FROM funds 
            GROUP BY category
        '''
        rows = self.db.fetchall(sql)
        return {row['category']: row['count'] for row in rows}
    
    def get_market_distribution(self) -> Dict[str, int]:
        """获取基金市场分布"""
        sql = '''
            SELECT market, COUNT(*) as count 
            FROM funds 
            GROUP BY market
        '''
        rows = self.db.fetchall(sql)
        return {row['market']: row['count'] for row in rows}
    
    def update_nav(self, code: str, nav: float, nav_date: str) -> bool:
        """更新基金净值"""
        return self.update_fund(code, nav=nav, nav_date=nav_date)
