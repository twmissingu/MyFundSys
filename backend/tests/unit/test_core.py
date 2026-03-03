#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
单元测试
Unit Tests
"""

import unittest
import sys
import os
from pathlib import Path
from datetime import datetime, date

# 添加项目路径
PROJECT_ROOT = Path(__file__).parent.parent.parent.absolute()
sys.path.insert(0, str(PROJECT_ROOT))

# 设置测试数据库
os.environ['DATABASE_URL'] = f"sqlite:///{PROJECT_ROOT}/data/test_fund.db"

from src.core.models import FundBasic, TradeRecord, FundType, TradeType, TradeStatus
from src.core.database import db_manager, init_database


class TestModels(unittest.TestCase):
    """测试数据模型"""
    
    def test_fund_basic_creation(self):
        """测试基金基础模型创建"""
        fund = FundBasic(
            fund_code='510300',
            fund_name='沪深300ETF',
            fund_type='index'
        )
        
        self.assertEqual(fund.fund_code, '510300')
        self.assertEqual(fund.fund_name, '沪深300ETF')
        self.assertEqual(fund.fund_type, 'index')
    
    def test_trade_record_creation(self):
        """测试交易记录模型创建"""
        trade = TradeRecord(
            fund_code='510300',
            trade_date=date(2024, 1, 15),
            trade_type='buy',
            shares=1000,
            amount=3500
        )
        
        self.assertEqual(trade.fund_code, '510300')
        self.assertEqual(trade.trade_type, 'buy')
        self.assertEqual(trade.shares, 1000)


class TestDatabase(unittest.TestCase):
    """测试数据库操作"""
    
    @classmethod
    def setUpClass(cls):
        """测试前初始化数据库"""
        init_database()
    
    def test_database_connection(self):
        """测试数据库连接"""
        db_manager.initialize()
        with db_manager.get_session() as session:
            # 简单查询测试连接
            result = session.query(FundBasic).first()
            # 只要能执行查询就说明连接正常
            self.assertTrue(True)
    
    def test_fund_crud(self):
        """测试基金增删改查"""
        db_manager.initialize()
        
        with db_manager.get_session() as session:
            # 创建
            fund = FundBasic(
                fund_code='TEST001',
                fund_name='测试基金',
                fund_type='index',
                is_active=True
            )
            session.add(fund)
            session.commit()
            
            # 读取
            retrieved = session.query(FundBasic).filter_by(fund_code='TEST001').first()
            self.assertIsNotNone(retrieved)
            self.assertEqual(retrieved.fund_name, '测试基金')
            
            # 更新
            retrieved.fund_name = '测试基金改名'
            session.commit()
            updated = session.query(FundBasic).filter_by(fund_code='TEST001').first()
            self.assertEqual(updated.fund_name, '测试基金改名')
            
            # 删除（软删除）
            updated.is_active = False
            session.commit()


class TestTradeManager(unittest.TestCase):
    """测试交易管理"""
    
    @classmethod
    def setUpClass(cls):
        """测试前初始化"""
        init_database()
        
        # 添加测试基金
        db_manager.initialize()
        with db_manager.get_session() as session:
            fund = session.query(FundBasic).filter_by(fund_code='TRADE001').first()
            if not fund:
                fund = FundBasic(
                    fund_code='TRADE001',
                    fund_name='交易测试基金',
                    fund_type='index',
                    is_active=True
                )
                session.add(fund)
                session.commit()
    
    def test_record_buy(self):
        """测试记录买入"""
        db_manager.initialize()
        
        with db_manager.get_session() as session:
            trade = TradeRecord(
                fund_code='TRADE001',
                trade_date=date(2024, 1, 15),
                trade_type='buy',
                shares=1000,
                amount=3500,
                trade_status='confirmed'
            )
            session.add(trade)
            session.commit()
            
            self.assertIsNotNone(trade.id)
            self.assertEqual(trade.fund_code, 'TRADE001')
            self.assertEqual(trade.trade_type, 'buy')
    
    def test_record_sell(self):
        """测试记录卖出"""
        db_manager.initialize()
        
        with db_manager.get_session() as session:
            trade = TradeRecord(
                fund_code='TRADE001',
                trade_date=date(2024, 2, 15),
                trade_type='sell',
                shares=500,
                amount=2000,
                trade_status='confirmed'
            )
            session.add(trade)
            session.commit()
            
            self.assertIsNotNone(trade.id)
            self.assertEqual(trade.trade_type, 'sell')


class TestDataValidation(unittest.TestCase):
    """测试数据验证"""
    
    def test_fund_code_validation(self):
        """测试基金代码验证"""
        # 基金代码应为6位数字
        valid_codes = ['510300', '000001', '159901']
        invalid_codes = ['ABC', '123', '5103001', '']
        
        for code in valid_codes:
            self.assertTrue(len(code) == 6 and code.isdigit(), f"{code} 应为有效代码")
        
        for code in invalid_codes:
            self.assertFalse(len(code) == 6 and code.isdigit(), f"{code} 应为无效代码")
    
    def test_trade_amount_validation(self):
        """测试交易金额验证"""
        # 金额和份额必须为正数
        valid_amounts = [(1000, 3500), (100, 500)]
        invalid_amounts = [(0, 3500), (1000, 0), (-100, 3500)]
        
        for shares, amount in valid_amounts:
            self.assertTrue(shares > 0 and amount > 0)
        
        for shares, amount in invalid_amounts:
            self.assertFalse(shares > 0 and amount > 0)


def run_tests():
    """运行所有测试"""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # 添加测试类
    suite.addTests(loader.loadTestsFromTestCase(TestModels))
    suite.addTests(loader.loadTestsFromTestCase(TestDatabase))
    suite.addTests(loader.loadTestsFromTestCase(TestTradeManager))
    suite.addTests(loader.loadTestsFromTestCase(TestDataValidation))
    
    # 运行测试
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
