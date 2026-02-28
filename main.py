"""
MyFundSys - 基金投资管理系统
主入口模块
"""

import argparse
import sys
from pathlib import Path

# 添加 src 到路径
sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.services.database_service import DatabaseService
from src.services.valuation_service import ValuationService
from src.services.trade_service import TradeService
from src.services.holding_service import HoldingService


def init_database():
    """初始化数据库"""
    db = DatabaseService()
    db.init_tables()
    print("✅ 数据库初始化完成")


def show_valuation():
    """显示当前估值"""
    valuation = ValuationService()
    pe = valuation.get_market_pe()
    pb = valuation.get_market_pb()
    percentile = valuation.get_historical_percentile()
    
    print("\n📊 当前市场估值")
    print("-" * 40)
    print(f"全市场PE: {pe:.2f}")
    print(f"全市场PB: {pb:.2f}")
    print(f"历史百分位: {percentile:.1%}")
    
    if percentile < 0.2:
        print("🟢 钻石坑区域 - 建议重仓")
    elif percentile > 0.8:
        print("🔴 死亡之顶 - 建议减仓")
    else:
        print("🟡 合理区间 - 正常配置")


def show_holdings():
    """显示持仓"""
    holding = HoldingService()
    holdings = holding.get_all_holdings()
    
    print("\n💼 当前持仓")
    print("-" * 60)
    print(f"{'基金代码':<10} {'基金名称':<20} {'持仓份额':<12} {'成本':<10}")
    print("-" * 60)
    
    total_value = 0
    for h in holdings:
        value = h['shares'] * h['avg_cost']
        total_value += value
        print(f"{h['fund_code']:<10} {h['fund_name']:<20} {h['shares']:<12.2f} {h['avg_cost']:<10.4f}")
    
    print("-" * 60)
    print(f"总市值: ¥{total_value:,.2f}")


def main():
    parser = argparse.ArgumentParser(description='MyFundSys - 智能基金投资管理系统')
    parser.add_argument('--init', action='store_true', help='初始化数据库')
    parser.add_argument('--valuation', action='store_true', help='显示估值')
    parser.add_argument('--holdings', action='store_true', help='显示持仓')
    parser.add_argument('--sync', action='store_true', help='同步数据到GitHub')
    
    args = parser.parse_args()
    
    if args.init:
        init_database()
    elif args.valuation:
        show_valuation()
    elif args.holdings:
        show_holdings()
    elif args.sync:
        from scripts.sync_to_github import sync_data
        sync_data()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
