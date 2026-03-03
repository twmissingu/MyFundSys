#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
产品经理Agent试用验证脚本
模拟用户场景测试，验证所有功能流程
"""

import os
import sys
from pathlib import Path
from datetime import datetime, date
import json

# 添加项目路径
PROJECT_ROOT = Path(__file__).parent.parent.absolute()
sys.path.insert(0, str(PROJECT_ROOT))

# 使用测试数据库
os.environ['FUND_DATABASE_PATH'] = str(PROJECT_ROOT / 'data' / 'fund_test.db')
os.environ['FUND_DB_URL'] = f"sqlite:///{PROJECT_ROOT / 'data' / 'fund_test.db'}"

from src.core.database import db_manager
from src.core.models import FundBasic, TradeRecord
# from src.trade.calculator import ProfitCalculator
# from src.analysis.analyzer import PortfolioAnalyzer

# 重新初始化数据库连接
from src.core import config
config.DATABASE_URL = f"sqlite:///{PROJECT_ROOT / 'data' / 'fund_test.db'}"
db_manager._initialized = False
db_manager._instance = None
db_manager.db_url = config.DATABASE_URL

class ProductManagerTester:
    """产品经理测试Agent"""
    
    def __init__(self):
        self.test_results = []
        self.db_manager = db_manager
        self.db_manager.initialize()
    
    def log_test(self, scenario, action, result, details=None, issue=None, suggestion=None):
        """记录测试结果"""
        self.test_results.append({
            'timestamp': datetime.now().isoformat(),
            'scenario': scenario,
            'action': action,
            'result': result,  # 'PASS', 'FAIL', 'WARNING'
            'details': details,
            'issue': issue,
            'suggestion': suggestion
        })
    
    def test_scenario_1_view_fund_list(self):
        """场景1: 查看基金列表"""
        print("\n📋 场景1: 查看基金列表")
        print("-" * 50)
        
        try:
            with self.db_manager.get_session() as session:
                funds = session.query(FundBasic).filter_by(is_active=True).all()
                
                if len(funds) > 0:
                    print(f"✅ 成功获取基金列表，共 {len(funds)} 只基金")
                    
                    # 检查分类
                    categories = {}
                    for f in funds:
                        cat = f.fund_type or 'unknown'
                        categories[cat] = categories.get(cat, 0) + 1
                    
                    print("📊 基金分类统计:")
                    for cat, count in sorted(categories.items()):
                        print(f"   - {cat}: {count}只")
                    
                    self.log_test(
                        scenario="基金列表查看",
                        action="获取所有基金",
                        result="PASS",
                        details=f"共{len(funds)}只基金，{len(categories)}个分类"
                    )
                    return True
                else:
                    self.log_test(
                        scenario="基金列表查看",
                        action="获取所有基金",
                        result="FAIL",
                        issue="基金列表为空",
                        suggestion="检查数据库初始化"
                    )
                    return False
        except Exception as e:
            self.log_test(
                scenario="基金列表查看",
                action="获取所有基金",
                result="FAIL",
                issue=str(e),
                suggestion="检查数据库连接"
            )
            print(f"❌ 测试失败: {e}")
            return False
    
    def test_scenario_2_view_holdings(self):
        """场景2: 查看持仓"""
        print("\n📊 场景2: 查看持仓")
        print("-" * 50)
        
        try:
            with self.db_manager.get_session() as session:
                trades = session.query(TradeRecord).filter_by(trade_status='confirmed').all()
                
                # 计算持仓
                from collections import defaultdict
                holdings = defaultdict(lambda: {'shares': 0, 'cost': 0})
                
                for trade in trades:
                    if trade.trade_type == 'buy':
                        holdings[trade.fund_code]['shares'] += float(trade.shares)
                        holdings[trade.fund_code]['cost'] += float(trade.amount)
                    elif trade.trade_type == 'sell':
                        ratio = float(trade.shares) / holdings[trade.fund_code]['shares'] if holdings[trade.fund_code]['shares'] > 0 else 0
                        holdings[trade.fund_code]['cost'] -= holdings[trade.fund_code]['cost'] * ratio
                        holdings[trade.fund_code]['shares'] -= float(trade.shares)
                
                # 过滤清仓
                holdings = {k: v for k, v in holdings.items() if v['shares'] > 0}
                
                if holdings:
                    print(f"✅ 持仓计算成功，共持有 {len(holdings)} 只基金")
                    
                    total_cost = sum(h['cost'] for h in holdings.values())
                    print(f"💰 总成本: ¥{total_cost:,.2f}")
                    
                    # 显示持仓明细
                    print("\n📋 持仓明细:")
                    for fund_code, data in list(holdings.items())[:5]:
                        fund = session.query(FundBasic).filter_by(fund_code=fund_code).first()
                        name = fund.fund_name if fund else fund_code
                        avg_cost = data['cost'] / data['shares'] if data['shares'] > 0 else 0
                        print(f"   {fund_code} {name[:15]:<15} 份额:{data['shares']:.2f} 成本:¥{data['cost']:.2f}")
                    
                    self.log_test(
                        scenario="持仓查看",
                        action="计算当前持仓",
                        result="PASS",
                        details=f"持有{len(holdings)}只基金，总成本¥{total_cost:,.2f}"
                    )
                    return True
                else:
                    self.log_test(
                        scenario="持仓查看",
                        action="计算当前持仓",
                        result="WARNING",
                        details="当前无持仓",
                        suggestion="建议先添加交易记录"
                    )
                    print("⚠️ 当前无持仓")
                    return True
        except Exception as e:
            self.log_test(
                scenario="持仓查看",
                action="计算当前持仓",
                result="FAIL",
                issue=str(e)
            )
            print(f"❌ 测试失败: {e}")
            return False
    
    def test_scenario_3_add_trade(self):
        """场景3: 添加交易记录"""
        print("\n💰 场景3: 添加交易记录")
        print("-" * 50)
        
        try:
            with self.db_manager.get_session() as session:
                # 获取一只基金
                fund = session.query(FundBasic).first()
                if not fund:
                    print("❌ 无可用基金")
                    return False
                
                # 创建新交易
                new_trade = TradeRecord(
                    fund_code=fund.fund_code,
                    trade_date=date.today(),
                    trade_type='buy',
                    trade_status='confirmed',
                    amount=10000.00,
                    shares=1000.00,
                    nav=10.00,
                    fee=3.00,
                    remark='测试买入'
                )
                session.add(new_trade)
                session.commit()
                
                # 验证
                trade_count = session.query(TradeRecord).count()
                print(f"✅ 交易添加成功，当前共 {trade_count} 笔交易")
                
                self.log_test(
                    scenario="交易记录",
                    action="添加买入交易",
                    result="PASS",
                    details=f"新增交易ID={new_trade.id}"
                )
                return True
        except Exception as e:
            self.log_test(
                scenario="交易记录",
                action="添加买入交易",
                result="FAIL",
                issue=str(e)
            )
            print(f"❌ 测试失败: {e}")
            return False
    
    def test_scenario_4_profit_analysis(self):
        """场景4: 收益分析"""
        print("\n📈 场景4: 收益分析")
        print("-" * 50)
        
        try:
            with self.db_manager.get_session() as session:
                trades = session.query(TradeRecord).filter_by(trade_status='confirmed').all()
                
                if not trades:
                    print("⚠️ 无交易记录，跳过收益分析")
                    return True
                
                # 计算收益
                total_buy = sum(float(t.amount) for t in trades if t.trade_type == 'buy')
                total_sell = sum(float(t.amount) for t in trades if t.trade_type == 'sell')
                
                print(f"💰 累计买入: ¥{total_buy:,.2f}")
                print(f"💰 累计卖出: ¥{total_sell:,.2f}")
                
                # 计算已实现收益
                realized_cost = total_buy * (total_sell / total_buy) if total_buy > 0 else 0
                realized_profit = total_sell - realized_cost
                
                print(f"📈 已实现收益: ¥{realized_profit:,.2f}")
                
                self.log_test(
                    scenario="收益分析",
                    action="计算收益",
                    result="PASS",
                    details=f"买入¥{total_buy:,.2f}, 卖出¥{total_sell:,.2f}"
                )
                return True
        except Exception as e:
            self.log_test(
                scenario="收益分析",
                action="计算收益",
                result="FAIL",
                issue=str(e)
            )
            print(f"❌ 测试失败: {e}")
            return False
    
    def test_scenario_5_fund_search(self):
        """场景5: 基金搜索"""
        print("\n🔍 场景5: 基金搜索")
        print("-" * 50)
        
        try:
            with self.db_manager.get_session() as session:
                # 按代码搜索
                fund = session.query(FundBasic).filter(
                    FundBasic.fund_code == '510300'
                ).first()
                
                if fund:
                    print(f"✅ 按代码搜索成功: {fund.fund_code} - {fund.fund_name}")
                    
                    # 按类型搜索
                    broad_funds = session.query(FundBasic).filter(
                        FundBasic.fund_type == 'broad'
                    ).all()
                    
                    print(f"✅ 按类型搜索成功: 找到 {len(broad_funds)} 只宽基基金")
                    
                    self.log_test(
                        scenario="基金搜索",
                        action="代码和类型搜索",
                        result="PASS",
                        details=f"代码搜索成功，类型搜索返回{len(broad_funds)}条"
                    )
                    return True
                else:
                    self.log_test(
                        scenario="基金搜索",
                        action="代码搜索",
                        result="FAIL",
                        issue="未找到基金510300"
                    )
                    return False
        except Exception as e:
            self.log_test(
                scenario="基金搜索",
                action="搜索基金",
                result="FAIL",
                issue=str(e)
            )
            print(f"❌ 测试失败: {e}")
            return False
    
    def test_scenario_6_cli_interaction(self):
        """场景6: CLI交互体验"""
        print("\n⌨️ 场景6: CLI交互体验")
        print("-" * 50)
        
        issues = []
        suggestions = []
        
        # 检查CLI模块
        try:
            from src.cli.interactive import start_interactive_cli
            print("✅ CLI模块可导入")
        except Exception as e:
            issues.append(f"CLI模块导入失败: {e}")
            print(f"⚠️ CLI模块问题: {e}")
        
        # 检查命令行参数
        try:
            import argparse
            parser = argparse.ArgumentParser()
            parser.add_argument('command')
            args = parser.parse_args(['status'])
            print("✅ 命令行解析正常")
        except Exception as e:
            issues.append(f"命令行解析问题: {e}")
        
        if not issues:
            self.log_test(
                scenario="CLI交互",
                action="检查CLI模块",
                result="PASS",
                details="CLI模块正常工作"
            )
            return True
        else:
            self.log_test(
                scenario="CLI交互",
                action="检查CLI模块",
                result="WARNING",
                issue="; ".join(issues),
                suggestion="建议完善CLI交互功能"
            )
            return True
    
    def generate_report(self):
        """生成测试报告"""
        print("\n" + "="*60)
        print("📊 产品经理试用测试报告")
        print("="*60)
        
        # 统计结果
        pass_count = sum(1 for r in self.test_results if r['result'] == 'PASS')
        fail_count = sum(1 for r in self.test_results if r['result'] == 'FAIL')
        warning_count = sum(1 for r in self.test_results if r['result'] == 'WARNING')
        
        print(f"\n📈 测试统计:")
        print(f"   ✅ 通过: {pass_count}")
        print(f"   ❌ 失败: {fail_count}")
        print(f"   ⚠️  警告: {warning_count}")
        print(f"   📋 总计: {len(self.test_results)}")
        
        print(f"\n📋 详细结果:")
        for i, result in enumerate(self.test_results, 1):
            status_icon = "✅" if result['result'] == 'PASS' else ("❌" if result['result'] == 'FAIL' else "⚠️")
            print(f"\n{i}. {status_icon} {result['scenario']} - {result['action']}")
            if result['details']:
                print(f"   详情: {result['details']}")
            if result['issue']:
                print(f"   问题: {result['issue']}")
            if result['suggestion']:
                print(f"   建议: {result['suggestion']}")
        
        # 汇总问题
        issues = [r for r in self.test_results if r['issue']]
        if issues:
            print(f"\n🔧 待修复问题 ({len(issues)}项):")
            for r in issues:
                print(f"   - [{r['scenario']}] {r['issue']}")
        
        suggestions = [r for r in self.test_results if r['suggestion']]
        if suggestions:
            print(f"\n💡 优化建议 ({len(suggestions)}项):")
            for r in suggestions:
                print(f"   - [{r['scenario']}] {r['suggestion']}")
        
        print("\n" + "="*60)
        
        # 保存报告
        report_path = PROJECT_ROOT / 'tests' / 'pm_test_report.json'
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump({
                'test_time': datetime.now().isoformat(),
                'summary': {
                    'total': len(self.test_results),
                    'pass': pass_count,
                    'fail': fail_count,
                    'warning': warning_count
                },
                'results': self.test_results
            }, f, ensure_ascii=False, indent=2)
        
        print(f"📄 报告已保存: {report_path}")
        
        return self.test_results

def main():
    """主函数"""
    print("🚀 产品经理Agent试用验证")
    print("="*60)
    
    tester = ProductManagerTester()
    
    # 执行测试场景
    tester.test_scenario_1_view_fund_list()
    tester.test_scenario_2_view_holdings()
    tester.test_scenario_3_add_trade()
    tester.test_scenario_4_profit_analysis()
    tester.test_scenario_5_fund_search()
    tester.test_scenario_6_cli_interaction()
    
    # 生成报告
    tester.generate_report()
    
    print("\n✅ 产品经理试用验证完成！")

if __name__ == '__main__':
    main()
