#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
基金系统 - 模块集成测试脚本
Phase 2.5: 模块集成测试

测试内容：
1. 模块集成测试 - 数据库模块 ↔ 交易模块 ↔ 分析模块 ↔ 报告模块 ↔ 飞书推送
2. 功能测试 - 基金添加/删除、买入/卖出记录、持仓计算、估值温度计算、投资建议生成、报告生成与推送
3. 数据流测试 - 净值数据抓取 → 存储 → 分析 → 报告
4. 边界测试 - 空持仓、单只基金满仓、多市场混合持仓、历史数据缺失
"""

import unittest
import sys
import json
import os
import tempfile
import shutil
from pathlib import Path
from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import List, Dict, Any
import random

# 添加项目路径
PROJECT_ROOT = Path(__file__).parent.parent.absolute()
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / 'src'))

# 导入测试模块
from src.core.database import DatabaseManager, FundBasicDAO, FundNAVDAO, TradeRecordDAO, PositionSnapshotDAO
from src.core.models import FundBasic, FundNAV, TradeRecord, PositionSnapshot, init_db
from src.analysis.analyzer import AssetAnalyzer, FundPosition, AssetAllocation, create_position
from src.analysis.valuation import ValuationAnalyzer, ValuationMetrics, ValuationLevel
from src.analysis.advisor import InvestmentAdvisor, InvestmentAdvice, SignalType
from src.analysis.reporter import ReportGenerator, DailyReport


# ==================== 测试数据 ====================

# E大基金列表中的测试基金（5-10只，覆盖不同市场）
TEST_FUNDS = [
    {'code': '510300', 'name': '华泰柏瑞沪深300ETF', 'category': 'broad', 'market': 'A股', 'fund_type': 'index'},
    {'code': '510500', 'name': '南方中证500ETF', 'category': 'broad', 'market': 'A股', 'fund_type': 'index'},
    {'code': '159915', 'name': '易方达创业板ETF', 'category': 'broad', 'market': 'A股', 'fund_type': 'index'},
    {'code': '513100', 'name': '国泰纳斯达克100ETF', 'category': 'overseas', 'market': '美股', 'fund_type': 'qdii'},
    {'code': '159920', 'name': '华夏恒生ETF', 'category': 'overseas', 'market': '港股', 'fund_type': 'qdii'},
    {'code': '518880', 'name': '华安黄金ETF', 'category': 'commodity', 'market': '商品', 'fund_type': 'etf'},
    {'code': '512010', 'name': '易方达沪深300医药ETF', 'category': 'sector', 'market': 'A股', 'fund_type': 'index'},
    {'code': '512660', 'name': '军工ETF', 'category': 'sector', 'market': 'A股', 'fund_type': 'index'},
]

# 模拟3-6个月交易记录
def generate_mock_trades(fund_code: str, start_date: date, months: int = 6) -> List[Dict]:
    """生成模拟交易记录"""
    trades = []
    current_date = start_date
    end_date = start_date + timedelta(days=30*months)
    
    # 初始买入
    trades.append({
        'fund_code': fund_code,
        'trade_date': current_date,
        'trade_type': 'buy',
        'amount': Decimal(str(random.randint(10000, 50000))),
        'shares': Decimal(str(random.randint(1000, 5000))),
        'nav': Decimal(str(round(random.uniform(1.0, 3.0), 4))),
        'trade_status': 'confirmed'
    })
    
    # 后续定期买入或卖出
    current_date += timedelta(days=random.randint(15, 30))
    while current_date < end_date:
        if random.random() > 0.3:  # 70%概率买入
            trades.append({
                'fund_code': fund_code,
                'trade_date': current_date,
                'trade_type': 'buy',
                'amount': Decimal(str(random.randint(5000, 30000))),
                'shares': Decimal(str(random.randint(500, 3000))),
                'nav': Decimal(str(round(random.uniform(0.9, 3.2), 4))),
                'trade_status': 'confirmed'
            })
        else:  # 30%概率卖出
            trades.append({
                'fund_code': fund_code,
                'trade_date': current_date,
                'trade_type': 'sell',
                'amount': Decimal(str(random.randint(3000, 20000))),
                'shares': Decimal(str(random.randint(300, 2000))),
                'nav': Decimal(str(round(random.uniform(1.0, 3.5), 4))),
                'trade_status': 'confirmed'
            })
        current_date += timedelta(days=random.randint(15, 45))
    
    return trades

# 模拟每日净值数据
def generate_mock_nav_data(fund_code: str, start_date: date, days: int = 180) -> List[Dict]:
    """生成模拟净值数据"""
    nav_data = []
    base_nav = round(random.uniform(1.0, 3.0), 4)
    current_nav = base_nav
    
    for i in range(days):
        nav_date = start_date + timedelta(days=i)
        # 模拟净值波动 (-3% 到 +3%)
        change = random.uniform(-0.03, 0.03)
        current_nav = current_nav * (1 + change)
        
        nav_data.append({
            'fund_code': fund_code,
            'nav_date': nav_date,
            'nav': Decimal(str(round(current_nav, 4))),
            'acc_nav': Decimal(str(round(current_nav * random.uniform(1.0, 1.5), 4))),
            'daily_return': Decimal(str(round(change * 100, 4)))
        })
    
    return nav_data

# 模拟估值数据
def generate_mock_valuation_data(fund_code: str, fund_name: str, days: int = 180) -> Dict:
    """生成模拟估值数据"""
    base_pe = random.uniform(10, 40)
    base_pb = random.uniform(1.0, 5.0)
    
    pe_history = []
    pb_history = []
    
    for i in range(days):
        date_point = datetime.now() - timedelta(days=days-i)
        pe = base_pe * (1 + random.uniform(-0.2, 0.2))
        pb = base_pb * (1 + random.uniform(-0.2, 0.2))
        pe_history.append((date_point, Decimal(str(round(pe, 2)))))
        pb_history.append((date_point, Decimal(str(round(pb, 2)))))
    
    current_pe = pe_history[-1][1] if pe_history else Decimal('15')
    current_pb = pb_history[-1][1] if pb_history else Decimal('1.5')
    
    return {
        'code': fund_code,
        'name': fund_name,
        'current_pe': current_pe,
        'current_pb': current_pb,
        'pe_history': pe_history,
        'pb_history': pb_history
    }


# ==================== 集成测试类 ====================

class TestDatabaseIntegration(unittest.TestCase):
    """测试数据库模块集成"""
    
    @classmethod
    def setUpClass(cls):
        """测试前初始化"""
        cls.test_dir = tempfile.mkdtemp()
        cls.db_path = Path(cls.test_dir) / 'test_integration.db'
        cls.db_url = f"sqlite:///{cls.db_path}"
        
        # 初始化数据库
        cls.engine = init_db(cls.db_url)
        cls.db_manager = DatabaseManager(cls.db_url)
        cls.db_manager.initialize()
    
    @classmethod
    def tearDownClass(cls):
        """测试后清理"""
        shutil.rmtree(cls.test_dir, ignore_errors=True)
    
    def test_01_database_connection(self):
        """测试数据库连接"""
        from sqlalchemy import text
        with self.db_manager.get_session() as session:
            self.assertIsNotNone(session)
            result = session.execute(text("SELECT 1")).scalar()
            self.assertEqual(result, 1)
        print("✓ 数据库连接测试通过")
    
    def test_02_fund_basic_crud(self):
        """测试基金基础信息CRUD"""
        import uuid
        unique_code = f"TEST{uuid.uuid4().hex[:6].upper()}"
        
        with self.db_manager.get_session() as session:
            # 创建
            fund = FundBasicDAO.create(session, 
                fund_code=unique_code,
                fund_name='测试基金1',
                fund_type='index',
                is_active=True,
                is_monitored=True
            )
            self.assertIsNotNone(fund)
            
            # 读取
            retrieved = FundBasicDAO.get_by_code(session, unique_code)
            self.assertIsNotNone(retrieved)
            self.assertEqual(retrieved.fund_name, '测试基金1')
            
            # 更新
            result = FundBasicDAO.update(session, unique_code, fund_name='测试基金1-更新')
            self.assertTrue(result)
            updated = FundBasicDAO.get_by_code(session, unique_code)
            self.assertEqual(updated.fund_name, '测试基金1-更新')
            
            # 删除（软删除）
            result = FundBasicDAO.delete(session, unique_code)
            self.assertTrue(result)
            deleted = FundBasicDAO.get_by_code(session, unique_code)
            self.assertFalse(deleted.is_active)
        print("✓ 基金基础信息CRUD测试通过")
    
    def test_03_fund_nav_crud(self):
        """测试基金净值数据CRUD"""
        import uuid
        unique_code = f"NAV{uuid.uuid4().hex[:6].upper()}"
        
        with self.db_manager.get_session() as session:
            # 先创建基金
            FundBasicDAO.create(session, 
                fund_code=unique_code,
                fund_name='净值测试基金',
                fund_type='index'
            )
            
            # 创建净值记录
            nav_date = date(2024, 1, 15)
            nav = FundNAVDAO.create(session,
                fund_code=unique_code,
                nav_date=nav_date,
                nav=Decimal('1.5234'),
                acc_nav=Decimal('2.1234'),
                daily_return=Decimal('1.25')
            )
            self.assertIsNotNone(nav)
            
            # 读取
            retrieved = FundNAVDAO.get_by_fund_and_date(session, unique_code, nav_date)
            self.assertIsNotNone(retrieved)
            self.assertEqual(float(retrieved.nav), 1.5234)
            
            # 获取最新净值
            latest = FundNAVDAO.get_latest_nav(session, unique_code)
            self.assertIsNotNone(latest)
        print("✓ 基金净值数据CRUD测试通过")
    
    def test_04_trade_record_crud(self):
        """测试交易记录CRUD"""
        import uuid
        unique_code = f"TRADE{uuid.uuid4().hex[:6].upper()}"
        
        with self.db_manager.get_session() as session:
            # 先创建基金
            FundBasicDAO.create(session, 
                fund_code=unique_code,
                fund_name='交易测试基金',
                fund_type='index'
            )
            
            # 创建交易记录
            trade = TradeRecordDAO.create(session,
                fund_code=unique_code,
                trade_date=date(2024, 1, 15),
                trade_type='buy',
                amount=Decimal('10000'),
                shares=Decimal('1000'),
                nav=Decimal('10.0'),
                trade_status='confirmed'
            )
            self.assertIsNotNone(trade)
            self.assertIsNotNone(trade.id)
            
            # 读取
            retrieved = TradeRecordDAO.get_by_id(session, trade.id)
            self.assertIsNotNone(retrieved)
            self.assertEqual(retrieved.trade_type, 'buy')
            
            # 获取基金交易列表
            trades = TradeRecordDAO.get_by_fund(session, unique_code)
            self.assertGreaterEqual(len(trades), 1)
        print("✓ 交易记录CRUD测试通过")
    
    def test_05_position_snapshot_crud(self):
        """测试持仓快照CRUD"""
        import uuid
        unique_code = f"POS{uuid.uuid4().hex[:6].upper()}"
        
        with self.db_manager.get_session() as session:
            # 先创建基金
            FundBasicDAO.create(session, 
                fund_code=unique_code,
                fund_name='持仓测试基金',
                fund_type='index'
            )
            
            # 创建持仓快照
            snapshot = PositionSnapshotDAO.create(session,
                fund_code=unique_code,
                snapshot_date=date(2024, 1, 15),
                total_shares=Decimal('1000'),
                total_cost=Decimal('10000'),
                avg_cost=Decimal('10.0'),
                market_value=Decimal('10500'),
                nav=Decimal('10.5'),
                total_profit=Decimal('500'),
                total_return_rate=Decimal('5.0')
            )
            self.assertIsNotNone(snapshot)
            
            # 读取最新快照
            latest = PositionSnapshotDAO.get_latest_snapshot(session, unique_code)
            self.assertIsNotNone(latest)
            self.assertEqual(float(latest.total_profit), 500.0)
        print("✓ 持仓快照CRUD测试通过")


class TestTradeAnalysisIntegration(unittest.TestCase):
    """测试交易模块 ↔ 分析模块集成"""
    
    @classmethod
    def setUpClass(cls):
        """测试前初始化"""
        cls.test_dir = tempfile.mkdtemp()
        cls.db_path = Path(cls.test_dir) / 'test_trade_analysis.db'
        cls.db_url = f"sqlite:///{cls.db_path}"
        
        cls.engine = init_db(cls.db_url)
        cls.db_manager = DatabaseManager(cls.db_url)
        cls.db_manager.initialize()
        
        # 初始化测试数据
        cls._init_test_data()
    
    @classmethod
    def tearDownClass(cls):
        """测试后清理"""
        shutil.rmtree(cls.test_dir, ignore_errors=True)
    
    @classmethod
    def _init_test_data(cls):
        """初始化测试数据"""
        start_date = date(2024, 1, 1)
        
        with cls.db_manager.get_session() as session:
            for fund in TEST_FUNDS[:5]:  # 使用5只基金
                # 创建基金
                FundBasicDAO.create(session,
                    fund_code=fund['code'],
                    fund_name=fund['name'],
                    fund_type=fund['fund_type'],
                    is_active=True,
                    is_monitored=True
                )
                
                # 创建交易记录
                trades = generate_mock_trades(fund['code'], start_date, months=4)
                for trade_data in trades:
                    TradeRecordDAO.create(session, **trade_data)
                
                # 创建净值数据
                nav_data = generate_mock_nav_data(fund['code'], start_date, days=120)
                for nav in nav_data:
                    FundNAVDAO.create(session, **nav)
    
    def test_01_calculate_position_from_trades(self):
        """测试从交易记录计算持仓"""
        with self.db_manager.get_session() as session:
            fund_code = TEST_FUNDS[0]['code']
            
            # 获取所有交易
            trades = TradeRecordDAO.get_by_fund(session, fund_code)
            self.assertGreater(len(trades), 0)
            
            # 计算持仓
            total_shares = Decimal('0')
            total_cost = Decimal('0')
            
            for trade in trades:
                if trade.trade_type == 'buy':
                    total_shares += trade.shares
                    total_cost += trade.amount
                elif trade.trade_type == 'sell':
                    total_shares -= trade.shares
                    total_cost -= trade.amount
            
            self.assertGreater(total_shares, 0)
            
            # 获取最新净值
            latest_nav = FundNAVDAO.get_latest_nav(session, fund_code)
            self.assertIsNotNone(latest_nav)
            
            # 计算市值
            market_value = total_shares * latest_nav.nav
            self.assertGreater(market_value, 0)
            
            print(f"  基金 {fund_code}: 份额={total_shares}, 市值={market_value:.2f}")
        print("✓ 从交易记录计算持仓测试通过")
    
    def test_02_asset_analyzer_with_positions(self):
        """测试资产分析器与持仓数据集成"""
        analyzer = AssetAnalyzer()
        
        with self.db_manager.get_session() as session:
            for fund in TEST_FUNDS[:3]:
                # 获取交易记录计算持仓
                trades = TradeRecordDAO.get_by_fund(session, fund['code'])
                total_shares = Decimal('0')
                total_cost = Decimal('0')
                
                for trade in trades:
                    if trade.trade_type == 'buy':
                        total_shares += trade.shares
                        total_cost += trade.amount
                    elif trade.trade_type == 'sell':
                        total_shares -= trade.shares
                        total_cost -= trade.amount
                
                if total_shares > 0:
                    latest_nav = FundNAVDAO.get_latest_nav(session, fund['code'])
                    cost_price = total_cost / total_shares if total_shares > 0 else Decimal('0')
                    
                    position = create_position(
                        code=fund['code'],
                        name=fund['name'],
                        shares=float(total_shares),
                        nav=float(latest_nav.nav) if latest_nav else 1.0,
                        cost_price=float(cost_price),
                        category=fund['category'],
                        market=fund['market']
                    )
                    analyzer.add_position(position)
        
        # 分析资产配置
        allocation = analyzer.analyze_allocation()
        self.assertGreater(allocation.total_assets, 0)
        self.assertIn('A股', allocation.market_distribution)
        
        print(f"  总资产: {allocation.total_assets:.2f}")
        print(f"  市场分布: {dict(allocation.market_distribution)}")
        print("✓ 资产分析器与持仓数据集成测试通过")
    
    def test_03_position_snapshot_creation(self):
        """测试持仓快照创建"""
        with self.db_manager.get_session() as session:
            for fund in TEST_FUNDS[:3]:
                trades = TradeRecordDAO.get_by_fund(session, fund['code'])
                total_shares = Decimal('0')
                total_cost = Decimal('0')
                
                for trade in trades:
                    if trade.trade_type == 'buy':
                        total_shares += trade.shares
                        total_cost += trade.amount
                    elif trade.trade_type == 'sell':
                        total_shares -= trade.shares
                        total_cost -= trade.amount
                
                if total_shares > 0:
                    latest_nav = FundNAVDAO.get_latest_nav(session, fund['code'])
                    market_value = total_shares * latest_nav.nav
                    avg_cost = total_cost / total_shares
                    total_profit = market_value - total_cost
                    return_rate = (total_profit / total_cost * 100) if total_cost > 0 else Decimal('0')
                    
                    snapshot = PositionSnapshotDAO.create(session,
                        fund_code=fund['code'],
                        snapshot_date=date.today(),
                        total_shares=total_shares,
                        total_cost=total_cost,
                        avg_cost=avg_cost,
                        market_value=market_value,
                        nav=latest_nav.nav,
                        total_profit=total_profit,
                        total_return_rate=return_rate
                    )
                    self.assertIsNotNone(snapshot)
        
        print("✓ 持仓快照创建测试通过")


class TestValuationAnalysisIntegration(unittest.TestCase):
    """测试估值模块 ↔ 分析模块集成"""
    
    def test_01_valuation_temperature_calculation(self):
        """测试估值温度计算"""
        analyzer = ValuationAnalyzer()
        
        # 使用测试基金生成估值数据
        for fund in TEST_FUNDS[:5]:
            data = generate_mock_valuation_data(fund['code'], fund['name'], days=180)
            metrics = analyzer.analyze_valuation(**data)
            
            self.assertIsNotNone(metrics)
            self.assertIsNotNone(metrics.valuation_temp)
            self.assertIsNotNone(metrics.level)
            self.assertIn(metrics.level_name, ['极度低估', '非常低估', '低估', '合理估值', '高估', '非常高估', '极度高估'])
            
            print(f"  {fund['name']}: 温度={metrics.valuation_temp}℃, 等级={metrics.level_name}")
        
        print("✓ 估值温度计算测试通过")
    
    def test_02_market_temperature_calculation(self):
        """测试市场整体温度计算"""
        analyzer = ValuationAnalyzer()
        
        # 批量分析
        data_list = [generate_mock_valuation_data(f['code'], f['name'], days=180) for f in TEST_FUNDS[:5]]
        analyzer.batch_analyze(data_list)
        
        # 获取市场温度
        temp_data = analyzer.get_market_temperature()
        self.assertIsNotNone(temp_data['average_temp'])
        self.assertIn('status', temp_data)
        
        print(f"  市场平均温度: {temp_data['average_temp']}℃")
        print(f"  市场状态: {temp_data['status']}")
        print("✓ 市场整体温度计算测试通过")
    
    def test_03_undervalued_overvalued_detection(self):
        """测试低估/高估检测"""
        analyzer = ValuationAnalyzer()
        
        # 批量分析
        data_list = [generate_mock_valuation_data(f['code'], f['name'], days=180) for f in TEST_FUNDS]
        analyzer.batch_analyze(data_list)
        
        # 获取低估资产
        undervalued = analyzer.get_undervalued(temp_threshold=Decimal('30'))
        # 获取高估资产
        overvalued = analyzer.get_overvalued(temp_threshold=Decimal('70'))
        
        print(f"  低估资产数量: {len(undervalued)}")
        print(f"  高估资产数量: {len(overvalued)}")
        print("✓ 低估/高估检测测试通过")


class TestAdvisorIntegration(unittest.TestCase):
    """测试投资建议模块集成"""
    
    def test_01_position_advice_generation(self):
        """测试仓位建议生成"""
        advisor = InvestmentAdvisor(total_capital=Decimal('100000'))
        analyzer = ValuationAnalyzer()
        
        # 生成估值数据
        data = generate_mock_valuation_data('510300', '沪深300ETF', days=180)
        metrics = analyzer.analyze_valuation(**data)
        
        # 获取仓位建议
        position_advice = advisor.get_position_advice(metrics, current_position=Decimal('30'))
        
        self.assertIsNotNone(position_advice)
        self.assertIsNotNone(position_advice.target_position)
        self.assertIsNotNone(position_advice.action)
        
        print(f"  当前仓位: {position_advice.current_position}%")
        print(f"  建议仓位: {position_advice.target_position}%")
        print(f"  操作建议: {position_advice.action}")
        print("✓ 仓位建议生成测试通过")
    
    def test_02_trade_signal_generation(self):
        """测试买卖信号生成"""
        advisor = InvestmentAdvisor()
        analyzer = ValuationAnalyzer()
        
        test_cases = [
            ('极度低估', Decimal('5'), Decimal('20')),
            ('低估', Decimal('25'), Decimal('30')),
            ('合理', Decimal('50'), Decimal('50')),
            ('高估', Decimal('75'), Decimal('30')),
            ('极度高估', Decimal('95'), Decimal('10')),
        ]
        
        for case_name, temp, current_pos in test_cases:
            # 创建模拟估值数据
            pe_history = [(datetime.now() - timedelta(days=i), Decimal('15')) for i in range(100, 0, -1)]
            pb_history = [(datetime.now() - timedelta(days=i), Decimal('1.5')) for i in range(100, 0, -1)]
            
            metrics = ValuationMetrics(
                code='TEST',
                name='测试',
                valuation_temp=temp,
                level=analyzer.get_valuation_level(temp)[0],
                level_name=analyzer.get_valuation_level(temp)[1],
                pe_history=pe_history,
                pb_history=pb_history
            )
            
            signal, reason = advisor.get_trade_signal(metrics, current_pos)
            
            self.assertIsNotNone(signal)
            self.assertIsNotNone(reason)
            
            print(f"  {case_name}({temp}℃): {signal.value} - {reason}")
        
        print("✓ 买卖信号生成测试通过")
    
    def test_03_investment_advice_generation(self):
        """测试综合投资建议生成"""
        advisor = InvestmentAdvisor(total_capital=Decimal('100000'))
        analyzer = ValuationAnalyzer()
        
        # 批量生成估值数据
        valuations = []
        for fund in TEST_FUNDS[:5]:
            data = generate_mock_valuation_data(fund['code'], fund['name'], days=180)
            metrics = analyzer.analyze_valuation(**data)
            valuations.append(metrics)
        
        # 批量生成建议
        advices = advisor.batch_advice(valuations)
        
        self.assertEqual(len(advices), 5)
        
        for advice in advices:
            self.assertIsNotNone(advice.signal)
            self.assertIsNotNone(advice.target_position)
            print(f"  {advice.name}: {advice.signal.value} (目标仓位{advice.target_position}%)")
        
        print("✓ 综合投资建议生成测试通过")
    
    def test_04_portfolio_advice(self):
        """测试组合建议"""
        advisor = InvestmentAdvisor(total_capital=Decimal('100000'))
        analyzer = ValuationAnalyzer()
        
        # 批量生成估值数据
        valuations = []
        for fund in TEST_FUNDS[:5]:
            data = generate_mock_valuation_data(fund['code'], fund['name'], days=180)
            metrics = analyzer.analyze_valuation(**data)
            valuations.append(metrics)
        
        # 获取组合建议
        portfolio_advice = advisor.get_portfolio_advice(valuations)
        
        self.assertIn('buy_signals', portfolio_advice)
        self.assertIn('sell_signals', portfolio_advice)
        self.assertIn('average_valuation_temp', portfolio_advice)
        
        print(f"  买入信号: {portfolio_advice['buy_signals']}个")
        print(f"  卖出信号: {portfolio_advice['sell_signals']}个")
        print(f"  平均估值温度: {portfolio_advice['average_valuation_temp']}℃")
        print("✓ 组合建议测试通过")


class TestReportGenerationIntegration(unittest.TestCase):
    """测试报告模块集成"""
    
    def test_01_text_report_generation(self):
        """测试文本报告生成"""
        # 创建分析器
        asset_analyzer = AssetAnalyzer()
        valuation_analyzer = ValuationAnalyzer()
        advisor = InvestmentAdvisor()
        
        # 添加持仓
        for fund in TEST_FUNDS[:5]:
            position = create_position(
                code=fund['code'],
                name=fund['name'],
                shares=random.randint(1000, 5000),
                nav=round(random.uniform(1.0, 3.0), 4),
                cost_price=round(random.uniform(0.9, 2.8), 4),
                category=fund['category'],
                market=fund['market']
            )
            asset_analyzer.add_position(position)
            
            # 添加估值数据
            data = generate_mock_valuation_data(fund['code'], fund['name'], days=180)
            valuation_analyzer.analyze_valuation(**data)
        
        # 创建报告生成器
        generator = ReportGenerator(asset_analyzer, valuation_analyzer, advisor)
        
        # 生成文本报告
        report = generator.generate_daily_report()
        text_report = generator.generate_text_report(report)
        
        self.assertIn('每日持仓报告', text_report)
        self.assertIn('资产概况', text_report)
        self.assertIn('市场分布', text_report)
        
        print("  文本报告生成成功")
        print("✓ 文本报告生成测试通过")
    
    def test_02_markdown_report_generation(self):
        """测试Markdown报告生成"""
        asset_analyzer = AssetAnalyzer()
        valuation_analyzer = ValuationAnalyzer()
        advisor = InvestmentAdvisor()
        
        for fund in TEST_FUNDS[:5]:
            position = create_position(
                code=fund['code'],
                name=fund['name'],
                shares=random.randint(1000, 5000),
                nav=round(random.uniform(1.0, 3.0), 4),
                cost_price=round(random.uniform(0.9, 2.8), 4),
                category=fund['category'],
                market=fund['market']
            )
            asset_analyzer.add_position(position)
            
            data = generate_mock_valuation_data(fund['code'], fund['name'], days=180)
            valuation_analyzer.analyze_valuation(**data)
        
        generator = ReportGenerator(asset_analyzer, valuation_analyzer, advisor)
        
        md_report = generator.generate_markdown_report()
        
        self.assertIn('# 每日持仓报告', md_report)
        self.assertIn('## 📊 资产概况', md_report)
        self.assertIn('## 🌡️ 估值温度', md_report)
        
        print("  Markdown报告生成成功")
        print("✓ Markdown报告生成测试通过")
    
    def test_03_json_report_generation(self):
        """测试JSON报告生成"""
        asset_analyzer = AssetAnalyzer()
        valuation_analyzer = ValuationAnalyzer()
        advisor = InvestmentAdvisor()
        
        for fund in TEST_FUNDS[:5]:
            position = create_position(
                code=fund['code'],
                name=fund['name'],
                shares=random.randint(1000, 5000),
                nav=round(random.uniform(1.0, 3.0), 4),
                cost_price=round(random.uniform(0.9, 2.8), 4),
                category=fund['category'],
                market=fund['market']
            )
            asset_analyzer.add_position(position)
            
            data = generate_mock_valuation_data(fund['code'], fund['name'], days=180)
            valuation_analyzer.analyze_valuation(**data)
        
        generator = ReportGenerator(asset_analyzer, valuation_analyzer, advisor)
        
        json_report = generator.generate_json_report()
        report_data = json.loads(json_report)
        
        self.assertIn('summary', report_data)
        self.assertIn('positions', report_data)
        self.assertIn('valuations', report_data)
        
        print("  JSON报告生成成功")
        print("✓ JSON报告生成测试通过")
    
    def test_04_summary_generation(self):
        """测试投资建议摘要生成"""
        asset_analyzer = AssetAnalyzer()
        valuation_analyzer = ValuationAnalyzer()
        advisor = InvestmentAdvisor()
        
        for fund in TEST_FUNDS[:5]:
            position = create_position(
                code=fund['code'],
                name=fund['name'],
                shares=random.randint(1000, 5000),
                nav=round(random.uniform(1.0, 3.0), 4),
                cost_price=round(random.uniform(0.9, 2.8), 4),
                category=fund['category'],
                market=fund['market']
            )
            asset_analyzer.add_position(position)
            
            data = generate_mock_valuation_data(fund['code'], fund['name'], days=180)
            valuation_analyzer.analyze_valuation(**data)
        
        generator = ReportGenerator(asset_analyzer, valuation_analyzer, advisor)
        
        summary = generator.generate_summary()
        
        self.assertIn('投资日报', summary)
        self.assertIn('总资产', summary)
        
        print("  摘要内容预览:")
        print(f"  {summary[:200]}...")
        print("✓ 投资建议摘要生成测试通过")


class TestBoundaryConditions(unittest.TestCase):
    """测试边界条件"""
    
    def test_01_empty_portfolio(self):
        """测试空持仓情况"""
        analyzer = AssetAnalyzer()
        
        # 不添加任何持仓
        allocation = analyzer.analyze_allocation()
        
        self.assertEqual(allocation.total_assets, Decimal('0'))
        self.assertEqual(allocation.total_cost, Decimal('0'))
        
        print("✓ 空持仓情况测试通过")
    
    def test_02_single_fund_full_position(self):
        """测试单只基金满仓"""
        analyzer = AssetAnalyzer()
        
        # 只添加一只基金，模拟满仓
        position = create_position(
            code='510300',
            name='沪深300ETF',
            shares=10000,
            nav=2.5,
            cost_price=2.0,
            category='broad',
            market='A股'
        )
        analyzer.add_position(position)
        
        allocation = analyzer.analyze_allocation()
        
        self.assertEqual(allocation.total_assets, position.market_value)
        self.assertEqual(allocation.market_distribution.get('A股', Decimal('0')), Decimal('100'))
        
        print(f"  单基金满仓: 总资产={allocation.total_assets}")
        print("✓ 单只基金满仓测试通过")
    
    def test_03_multi_market_mixed_portfolio(self):
        """测试多市场混合持仓"""
        analyzer = AssetAnalyzer()
        
        # 添加不同市场的基金
        positions = [
            create_position('510300', '沪深300ETF', 1000, 2.5, 2.0, 'broad', 'A股'),
            create_position('513100', '纳指ETF', 500, 3.0, 2.5, 'overseas', '美股'),
            create_position('159920', '恒生ETF', 800, 1.8, 1.5, 'overseas', '港股'),
            create_position('518880', '黄金ETF', 300, 3.5, 3.0, 'commodity', '商品'),
        ]
        
        for pos in positions:
            analyzer.add_position(pos)
        
        allocation = analyzer.analyze_allocation()
        
        self.assertGreater(len(allocation.market_distribution), 1)
        self.assertIn('A股', allocation.market_distribution)
        self.assertIn('美股', allocation.market_distribution)
        self.assertIn('港股', allocation.market_distribution)
        self.assertIn('商品', allocation.market_distribution)
        
        print(f"  市场分布: {dict(allocation.market_distribution)}")
        print("✓ 多市场混合持仓测试通过")
    
    def test_04_missing_history_data(self):
        """测试历史数据缺失"""
        analyzer = ValuationAnalyzer()
        
        # 创建只有少量历史数据的估值
        metrics = analyzer.analyze_valuation(
            code='TEST001',
            name='测试基金',
            current_pe=Decimal('15'),
            current_pb=Decimal('1.5'),
            pe_history=[(datetime.now(), Decimal('15'))],  # 只有一条历史数据
            pb_history=[(datetime.now(), Decimal('1.5'))]
        )
        
        # 应该能正常计算，但百分位可能为0
        self.assertIsNotNone(metrics)
        
        print("✓ 历史数据缺失测试通过")
    
    def test_05_zero_shares_position(self):
        """测试零份额持仓"""
        analyzer = AssetAnalyzer()
        
        # 添加零份额持仓
        position = create_position(
            code='510300',
            name='沪深300ETF',
            shares=0,
            nav=2.5,
            cost_price=2.0,
            category='broad',
            market='A股'
        )
        analyzer.add_position(position)
        
        allocation = analyzer.analyze_allocation()
        
        # 零份额应该不影响总资产
        self.assertEqual(allocation.total_assets, Decimal('0'))
        
        print("✓ 零份额持仓测试通过")


class TestDataFlowIntegration(unittest.TestCase):
    """测试数据流集成"""
    
    @classmethod
    def setUpClass(cls):
        """测试前初始化"""
        cls.test_dir = tempfile.mkdtemp()
        cls.db_path = Path(cls.test_dir) / 'test_dataflow.db'
        cls.db_url = f"sqlite:///{cls.db_path}"
        
        cls.engine = init_db(cls.db_url)
        cls.db_manager = DatabaseManager(cls.db_url)
        cls.db_manager.initialize()
    
    @classmethod
    def tearDownClass(cls):
        """测试后清理"""
        shutil.rmtree(cls.test_dir, ignore_errors=True)
    
    def test_01_nav_data_flow(self):
        """测试净值数据流：抓取 → 存储 → 分析 → 报告"""
        fund_code = '510300'
        fund_name = '沪深300ETF'
        
        with self.db_manager.get_session() as session:
            # 1. 创建基金
            FundBasicDAO.create(session,
                fund_code=fund_code,
                fund_name=fund_name,
                fund_type='index'
            )
            
            # 2. 存储净值数据（模拟抓取后存储）
            nav_data = generate_mock_nav_data(fund_code, date(2024, 1, 1), days=90)
            for nav in nav_data:
                FundNAVDAO.create(session, **nav)
            
            # 3. 读取并分析
            history = FundNAVDAO.get_nav_history(session, fund_code, limit=30)
            self.assertEqual(len(history), 30)
            
            # 4. 计算收益率
            latest = history[0]
            oldest = history[-1]
            return_rate = (latest.nav - oldest.nav) / oldest.nav * 100
            
            print(f"  净值数据流: {len(history)}条记录, 区间收益率{return_rate:.2f}%")
        
        print("✓ 净值数据流测试通过")
    
    def test_02_trade_to_profit_flow(self):
        """测试交易到收益数据流：交易记录 → 持仓更新 → 收益计算"""
        fund_code = '510500'
        
        with self.db_manager.get_session() as session:
            # 1. 创建基金
            FundBasicDAO.create(session,
                fund_code=fund_code,
                fund_name='中证500ETF',
                fund_type='index'
            )
            
            # 2. 创建交易记录
            trades_data = [
                {'trade_date': date(2024, 1, 15), 'trade_type': 'buy', 'amount': Decimal('10000'), 'shares': Decimal('1000'), 'nav': Decimal('10.0')},
                {'trade_date': date(2024, 2, 15), 'trade_type': 'buy', 'amount': Decimal('5000'), 'shares': Decimal('500'), 'nav': Decimal('10.0')},
                {'trade_date': date(2024, 3, 15), 'trade_type': 'sell', 'amount': Decimal('6000'), 'shares': Decimal('500'), 'nav': Decimal('12.0')},
            ]
            
            for trade_data in trades_data:
                TradeRecordDAO.create(session, fund_code=fund_code, trade_status='confirmed', **trade_data)
            
            # 3. 计算持仓
            trades = TradeRecordDAO.get_by_fund(session, fund_code)
            total_shares = Decimal('0')
            total_cost = Decimal('0')
            realized_profit = Decimal('0')
            
            for trade in trades:
                if trade.trade_type == 'buy':
                    total_shares += trade.shares
                    total_cost += trade.amount
                elif trade.trade_type == 'sell':
                    # 简化计算：卖出收益 = 卖出金额 - 成本比例
                    cost_basis = total_cost / total_shares * trade.shares if total_shares > 0 else Decimal('0')
                    realized_profit += trade.amount - cost_basis
                    total_shares -= trade.shares
                    total_cost -= cost_basis
            
            # 4. 计算当前收益（假设当前净值12.5）
            current_nav = Decimal('12.5')
            market_value = total_shares * current_nav
            unrealized_profit = market_value - total_cost
            
            print(f"  持仓: {total_shares}份, 市值: {market_value:.2f}")
            print(f"  已实现收益: {realized_profit:.2f}, 未实现收益: {unrealized_profit:.2f}")
        
        print("✓ 交易到收益数据流测试通过")
    
    def test_03_valuation_to_advice_flow(self):
        """测试估值到建议数据流：估值数据 → 温度计算 → 投资建议"""
        advisor = InvestmentAdvisor()
        analyzer = ValuationAnalyzer()
        
        # 1. 生成估值数据
        data = generate_mock_valuation_data('510300', '沪深300ETF', days=180)
        
        # 2. 计算估值温度
        metrics = analyzer.analyze_valuation(**data)
        
        # 3. 生成投资建议
        advice = advisor.generate_advice(metrics)
        
        self.assertIsNotNone(advice.valuation_temp)
        self.assertIsNotNone(advice.signal)
        self.assertIsNotNone(advice.target_position)
        
        print(f"  估值温度: {advice.valuation_temp}℃ → 信号: {advice.signal.value}")
        print("✓ 估值到建议数据流测试通过")


class TestFeishuIntegration(unittest.TestCase):
    """测试飞书推送集成"""
    
    def test_01_report_format_for_feishu(self):
        """测试飞书推送格式的报告"""
        asset_analyzer = AssetAnalyzer()
        valuation_analyzer = ValuationAnalyzer()
        advisor = InvestmentAdvisor()
        
        # 添加测试持仓和估值
        for fund in TEST_FUNDS[:5]:
            position = create_position(
                code=fund['code'],
                name=fund['name'],
                shares=random.randint(1000, 5000),
                nav=round(random.uniform(1.0, 3.0), 4),
                cost_price=round(random.uniform(0.9, 2.8), 4),
                category=fund['category'],
                market=fund['market']
            )
            asset_analyzer.add_position(position)
            
            data = generate_mock_valuation_data(fund['code'], fund['name'], days=180)
            valuation_analyzer.analyze_valuation(**data)
        
        generator = ReportGenerator(asset_analyzer, valuation_analyzer, advisor)
        
        # 生成适合飞书推送的摘要
        summary = generator.generate_summary()
        
        # 验证摘要格式
        self.assertIn('投资日报', summary)
        self.assertLess(len(summary), 2000)  # 飞书消息有长度限制
        
        print("  飞书推送格式报告预览:")
        print(summary)
        print("✓ 飞书推送格式测试通过")
    
    def test_02_markdown_for_feishu(self):
        """测试飞书兼容的Markdown格式"""
        asset_analyzer = AssetAnalyzer()
        valuation_analyzer = ValuationAnalyzer()
        advisor = InvestmentAdvisor()
        
        for fund in TEST_FUNDS[:3]:
            position = create_position(
                code=fund['code'],
                name=fund['name'],
                shares=random.randint(1000, 5000),
                nav=round(random.uniform(1.0, 3.0), 4),
                cost_price=round(random.uniform(0.9, 2.8), 4),
                category=fund['category'],
                market=fund['market']
            )
            asset_analyzer.add_position(position)
            
            data = generate_mock_valuation_data(fund['code'], fund['name'], days=180)
            valuation_analyzer.analyze_valuation(**data)
        
        generator = ReportGenerator(asset_analyzer, valuation_analyzer, advisor)
        
        md_report = generator.generate_markdown_report()
        
        # 飞书支持的Markdown子集检查
        self.assertIn('#', md_report)  # 标题
        self.assertIn('|', md_report)  # 表格
        
        print("  Markdown报告格式检查通过")
        print("✓ 飞书Markdown格式测试通过")


# ==================== 测试运行器 ====================

def run_integration_tests():
    """运行所有集成测试"""
    print("\n" + "=" * 70)
    print("基金系统 - Phase 2.5 模块集成测试")
    print("=" * 70)
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"测试基金数量: {len(TEST_FUNDS)}只")
    print("-" * 70)
    
    # 创建测试套件
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # 添加测试类
    suite.addTests(loader.loadTestsFromTestCase(TestDatabaseIntegration))
    suite.addTests(loader.loadTestsFromTestCase(TestTradeAnalysisIntegration))
    suite.addTests(loader.loadTestsFromTestCase(TestValuationAnalysisIntegration))
    suite.addTests(loader.loadTestsFromTestCase(TestAdvisorIntegration))
    suite.addTests(loader.loadTestsFromTestCase(TestReportGenerationIntegration))
    suite.addTests(loader.loadTestsFromTestCase(TestBoundaryConditions))
    suite.addTests(loader.loadTestsFromTestCase(TestDataFlowIntegration))
    suite.addTests(loader.loadTestsFromTestCase(TestFeishuIntegration))
    
    # 运行测试
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # 输出摘要
    print("\n" + "=" * 70)
    print("测试摘要")
    print("=" * 70)
    print(f"测试总数: {result.testsRun}")
    print(f"通过: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"失败: {len(result.failures)}")
    print(f"错误: {len(result.errors)}")
    
    if result.failures:
        print("\n失败的测试:")
        for test, traceback in result.failures:
            print(f"  - {test}")
    
    if result.errors:
        print("\n错误的测试:")
        for test, traceback in result.errors:
            print(f"  - {test}")
    
    print("=" * 70)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_integration_tests()
    sys.exit(0 if success else 1)
