#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试环境初始化脚本
创建独立的测试数据库和模拟数据
"""

import os
import sys
from pathlib import Path
from datetime import datetime, timedelta
import random

# 添加项目路径
PROJECT_ROOT = Path(__file__).parent.parent.absolute()
sys.path.insert(0, str(PROJECT_ROOT))

# 设置测试环境变量
os.environ['FUND_DATABASE_PATH'] = str(PROJECT_ROOT / 'data' / 'fund_test.db')

from src.core.database import db_manager, init_database
from src.core.models import FundBasic, TradeRecord

def init_test_database():
    """初始化测试数据库"""
    test_db_path = PROJECT_ROOT / 'data' / 'fund_test.db'
    if test_db_path.exists():
        test_db_path.unlink()
        print("🗑️  已清理旧测试数据库")
    
    # 重新初始化数据库管理器
    db_manager._initialized = False
    db_manager._instance = None
    
    # 重新导入配置
    from src.core import config
    config.DATABASE_URL = f"sqlite:///{test_db_path}"
    config.DATA_DIR = PROJECT_ROOT / 'data'
    
    db_manager.db_url = config.DATABASE_URL
    db_manager.initialize()
    
    print(f"✅ 测试数据库初始化成功: {test_db_path}")
    return test_db_path

def import_test_funds():
    """导入测试基金数据"""
    import csv
    
    csv_path = PROJECT_ROOT / 'data' / 'fund_list.csv'
    count = 0
    
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        
        with db_manager.get_session() as session:
            for row in reader:
                fund_code = row.get('code', '').strip()
                if not fund_code:
                    continue
                
                fund_name = row.get('name', '').strip()
                if not fund_name:
                    fund_name = f"基金{fund_code}"
                
                fund = FundBasic(
                    fund_code=fund_code,
                    fund_name=fund_name,
                    fund_type=row.get('category', 'other').strip(),
                    is_active=True,
                    is_monitored=True
                )
                session.add(fund)
                count += 1
            
            session.commit()
    
    print(f"✅ 导入 {count} 只测试基金")
    return count

def create_mock_trades():
    """创建模拟交易数据"""
    from datetime import date
    
    # 选择一些热门基金进行模拟交易
    mock_funds = [
        ('510300', '沪深300ETF', 'broad'),
        ('510500', '中证500ETF', 'broad'),
        ('159915', '创业板ETF', 'broad'),
        ('588000', '科创50ETF', 'broad'),
        ('518880', '黄金ETF', 'commodity'),
        ('513100', '纳斯达克100ETF', 'overseas'),
        ('512000', '券商ETF', 'sector'),
        ('512170', '医疗ETF', 'sector'),
        ('512690', '酒ETF', 'sector'),
        ('511010', '国债ETF', 'bond'),
    ]
    
    trades = []
    base_date = date(2024, 1, 1)
    
    with db_manager.get_session() as session:
        for fund_code, fund_name, category in mock_funds:
            # 确保基金存在
            fund = session.query(FundBasic).filter_by(fund_code=fund_code).first()
            if not fund:
                fund = FundBasic(
                    fund_code=fund_code,
                    fund_name=fund_name,
                    fund_type=category,
                    is_active=True,
                    is_monitored=True
                )
                session.add(fund)
        
        session.commit()
        
        # 创建买入交易
        for i, (fund_code, fund_name, category) in enumerate(mock_funds):
            # 每只基金买入2-4次
            num_buys = random.randint(2, 4)
            base_nav = random.uniform(0.8, 2.5)
            
            for j in range(num_buys):
                trade_date = base_date + timedelta(days=i*10 + j*15)
                nav = base_nav * (1 + random.uniform(-0.1, 0.15))
                amount = random.choice([5000, 10000, 15000, 20000])
                shares = amount / nav
                
                trade = TradeRecord(
                    fund_code=fund_code,
                    trade_date=trade_date,
                    trade_type='buy',
                    trade_status='confirmed',
                    amount=amount,
                    shares=shares,
                    nav=nav,
                    fee=amount * 0.0003,  # 0.03% 手续费
                    remark=f'定投买入 #{j+1}'
                )
                session.add(trade)
                trades.append({
                    'fund_code': fund_code,
                    'date': trade_date,
                    'type': 'buy',
                    'amount': amount,
                    'shares': shares
                })
            
            # 部分基金有卖出交易
            if random.random() > 0.5 and num_buys >= 2:
                sell_date = base_date + timedelta(days=i*10 + num_buys*15 + 10)
                sell_nav = base_nav * (1 + random.uniform(0.05, 0.25))
                # 卖出部分份额
                sell_shares = trades[-1]['shares'] * 0.5
                sell_amount = sell_shares * sell_nav
                
                trade = TradeRecord(
                    fund_code=fund_code,
                    trade_date=sell_date,
                    trade_type='sell',
                    trade_status='confirmed',
                    amount=sell_amount,
                    shares=sell_shares,
                    nav=sell_nav,
                    fee=sell_amount * 0.0003,
                    remark='止盈卖出'
                )
                session.add(trade)
                trades.append({
                    'fund_code': fund_code,
                    'date': sell_date,
                    'type': 'sell',
                    'amount': sell_amount,
                    'shares': sell_shares
                })
        
        session.commit()
    
    print(f"✅ 创建 {len(trades)} 笔模拟交易")
    return trades

def show_test_summary():
    """显示测试环境摘要"""
    with db_manager.get_session() as session:
        fund_count = session.query(FundBasic).count()
        trade_count = session.query(TradeRecord).count()
        buy_count = session.query(TradeRecord).filter_by(trade_type='buy').count()
        sell_count = session.query(TradeRecord).filter_by(trade_type='sell').count()
        
        print("\n" + "="*50)
        print("🧪 测试环境初始化完成")
        print("="*50)
        print(f"📊 基金数量: {fund_count}")
        print(f"💰 交易记录: {trade_count}")
        print(f"   - 买入: {buy_count}")
        print(f"   - 卖出: {sell_count}")
        print("="*50)

def main():
    """主函数"""
    print("🚀 初始化测试环境...")
    print("-" * 50)
    
    # 初始化测试数据库
    init_test_database()
    
    # 导入测试基金
    import_test_funds()
    
    # 创建模拟交易
    create_mock_trades()
    
    # 显示摘要
    show_test_summary()
    
    print("\n✅ 测试环境准备就绪！")
    print("📁 测试数据库: data/fund_test.db")

if __name__ == '__main__':
    main()
