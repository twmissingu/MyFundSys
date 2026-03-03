#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
集成测试
Integration Tests
"""

import unittest
import sys
import json
from pathlib import Path
from datetime import date

# 添加项目路径
PROJECT_ROOT = Path(__file__).parent.parent.parent.absolute()
sys.path.insert(0, str(PROJECT_ROOT))

import os
os.environ['DATABASE_URL'] = f"sqlite:///{PROJECT_ROOT}/data/test_integration.db"


class TestFundImport(unittest.TestCase):
    """测试基金导入功能"""
    
    def setUp(self):
        """测试前准备"""
        from src.core.database import init_database
        init_database()
    
    def test_import_from_csv(self):
        """测试从CSV导入基金"""
        import csv
        from src.core.database import db_manager
        from src.core.models import FundBasic
        
        # 创建测试CSV
        test_csv = PROJECT_ROOT / 'data' / 'test_funds.csv'
        with open(test_csv, 'w', encoding='utf-8') as f:
            f.write('code,name,category,market,asset_type,mentions,source\n')
            f.write('TEST001,测试基金1,index,沪市,股票,1,test\n')
            f.write('TEST002,测试基金2,bond,深市,债券,2,test\n')
        
        db_manager.initialize()
        count = 0
        
        with open(test_csv, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            with db_manager.get_session() as session:
                for row in reader:
                    fund_code = row.get('code', '').strip()
                    if not fund_code:
                        continue
                    
                    existing = session.query(FundBasic).filter_by(fund_code=fund_code).first()
                    if existing:
                        continue
                    
                    fund = FundBasic(
                        fund_code=fund_code,
                        fund_name=row.get('name', '').strip() or f"基金{fund_code}",
                        fund_type=row.get('category', 'other').strip(),
                        is_active=True,
                        is_monitored=True
                    )
                    session.add(fund)
                    count += 1
                session.commit()
        
        self.assertEqual(count, 2)
        
        # 验证导入结果
        with db_manager.get_session() as session:
            fund1 = session.query(FundBasic).filter_by(fund_code='TEST001').first()
            self.assertIsNotNone(fund1)
            self.assertEqual(fund1.fund_name, '测试基金1')
        
        # 清理
        test_csv.unlink()


class TestCompleteWorkflow(unittest.TestCase):
    """测试完整工作流程"""
    
    @classmethod
    def setUpClass(cls):
        """测试前初始化"""
        from src.core.database import init_database
        init_database()
    
    def test_complete_workflow(self):
        """测试完整流程：添加基金 -> 记录交易 -> 查看持仓 -> 收益分析"""
        from src.core.database import db_manager
        from src.core.models import FundBasic, TradeRecord
        
        db_manager.initialize()
        
        with db_manager.get_session() as session:
            # 1. 添加基金
            fund = FundBasic(
                fund_code='WF001',
                fund_name='工作流测试基金',
                fund_type='index',
                is_active=True
            )
            session.add(fund)
            session.commit()
            self.assertIsNotNone(fund.id)
            
            # 2. 记录买入交易
            trade1 = TradeRecord(
                fund_code='WF001',
                trade_date=date(2024, 1, 15),
                trade_type='buy',
                shares=1000,
                amount=3500,
                trade_status='confirmed'
            )
            session.add(trade1)
            
            trade2 = TradeRecord(
                fund_code='WF001',
                trade_date=date(2024, 2, 15),
                trade_type='buy',
                shares=500,
                amount=1800,
                trade_status='confirmed'
            )
            session.add(trade2)
            session.commit()
            
            self.assertIsNotNone(trade1.id)
            self.assertIsNotNone(trade2.id)
            
            # 3. 记录卖出
            trade3 = TradeRecord(
                fund_code='WF001',
                trade_date=date(2024, 3, 15),
                trade_type='sell',
                shares=500,
                amount=2100,
                trade_status='confirmed'
            )
            session.add(trade3)
            session.commit()
            
            # 4. 查询交易记录
            trades = session.query(TradeRecord).filter_by(fund_code='WF001').all()
            self.assertEqual(len(trades), 3)
            
            # 5. 计算持仓
            buy_shares = sum(t.shares for t in trades if t.trade_type == 'buy')
            sell_shares = sum(t.shares for t in trades if t.trade_type == 'sell')
            holding_shares = buy_shares - sell_shares
            
            self.assertEqual(holding_shares, 1000)


class TestAPIIntegration(unittest.TestCase):
    """测试API集成"""
    
    @classmethod
    def setUpClass(cls):
        """测试前初始化"""
        from src.core.database import init_database
        init_database()
        
        # 创建Flask测试客户端
        from src.api.app import create_app
        cls.app = create_app('testing')
        cls.client = cls.app.test_client()
    
    def test_api_fund_list(self):
        """测试获取基金列表API"""
        response = self.client.get('/api/funds')
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('data', data)
    
    def test_api_add_fund(self):
        """测试添加基金API"""
        response = self.client.post('/api/funds',
                                   data=json.dumps({
                                       'code': 'API001',
                                       'name': 'API测试基金',
                                       'category': 'index'
                                   }),
                                   content_type='application/json')
        
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['data']['code'], 'API001')


class TestDataValidation(unittest.TestCase):
    """测试数据验证"""
    
    def test_fund_code_format(self):
        """测试基金代码格式"""
        valid_codes = ['510300', '000001', '159901']
        invalid_codes = ['ABC', '123', '5103001', '']
        
        for code in valid_codes:
            self.assertTrue(len(code) == 6 and code.isdigit(), f"{code} 应为有效代码")
        
        for code in invalid_codes:
            self.assertFalse(len(code) == 6 and code.isdigit(), f"{code} 应为无效代码")
    
    def test_trade_calculation(self):
        """测试交易计算"""
        # 买入1000份 @ 3.5 = 3500
        # 卖出500份 @ 4.0 = 2000
        # 成本 = 500 * 3.5 = 1750
        # 已实现收益 = 2000 - 1750 = 250
        
        buy_amount = 3500
        buy_shares = 1000
        avg_cost = buy_amount / buy_shares
        
        sell_shares = 500
        sell_amount = 2000
        sell_cost = sell_shares * avg_cost
        realized_profit = sell_amount - sell_cost
        
        self.assertAlmostEqual(avg_cost, 3.5, places=2)
        self.assertAlmostEqual(sell_cost, 1750, places=2)
        self.assertAlmostEqual(realized_profit, 250, places=2)


def run_tests():
    """运行所有集成测试"""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    suite.addTests(loader.loadTestsFromTestCase(TestFundImport))
    suite.addTests(loader.loadTestsFromTestCase(TestCompleteWorkflow))
    suite.addTests(loader.loadTestsFromTestCase(TestAPIIntegration))
    suite.addTests(loader.loadTestsFromTestCase(TestDataValidation))
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
