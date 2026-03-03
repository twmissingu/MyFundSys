#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
交互式CLI - 简化版
兼容现有数据库架构
"""

import cmd
import sys
from datetime import datetime, date

from ..core.database import db_manager
from ..core.models import FundBasic, TradeRecord


class FundSystemCLI(cmd.Cmd):
    """基金系统交互式命令行"""
    
    intro = '''
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║           基金资产管理系统 - 交互式命令行                     ║
║           Fund Asset Management System CLI                   ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

输入 help 查看可用命令，输入 quit 退出。
'''
    prompt = '(fund-system) >>> '
    
    def __init__(self):
        super().__init__()
        db_manager.initialize()
    
    # ========== 基础命令 ==========
    
    def do_quit(self, arg):
        """退出系统"""
        print("\n感谢使用，再见！")
        return True
    
    def do_exit(self, arg):
        """退出系统"""
        return self.do_quit(arg)
    
    def do_clear(self, arg):
        """清屏"""
        print('\n' * 50)
    
    def do_status(self, arg):
        """查看系统状态"""
        with db_manager.get_session() as session:
            fund_count = session.query(FundBasic).count()
            trade_count = session.query(TradeRecord).count()
            
            print("\n📊 系统状态:")
            print("-" * 40)
            print(f"基金数量: {fund_count}")
            print(f"交易记录: {trade_count}")
            print("-" * 40)
    
    # ========== 基金管理命令 ==========
    
    def do_fund_list(self, arg):
        """列出所有基金: fund_list [category]"""
        with db_manager.get_session() as session:
            query = session.query(FundBasic).filter_by(is_active=True)
            
            if arg.strip():
                query = query.filter_by(fund_type=arg.strip())
            
            funds = query.all()
            
            print("\n📋 基金列表:")
            print("-" * 80)
            print(f"{'代码':<10} {'名称':<25} {'类型':<10} {'监控':<6}")
            print("-" * 80)
            
            for fund in funds[:50]:
                name = fund.fund_name[:23] + '..' if fund.fund_name and len(fund.fund_name) > 25 else (fund.fund_name or 'N/A')
                monitored = '✓' if fund.is_monitored else '✗'
                print(f"{fund.fund_code:<10} {name:<25} {fund.fund_type or 'unknown':<10} {monitored:<6}")
            
            print("-" * 80)
            if len(funds) > 50:
                print(f"... 还有 {len(funds) - 50} 只基金")
            print(f"共 {len(funds)} 只基金")
    
    def do_fund_add(self, arg):
        """添加基金: fund_add <code> <name> [category]"""
        args = arg.split()
        if len(args) < 2:
            print("❌ 用法: fund_add <code> <name> [category]")
            return
        
        code, name = args[0], args[1]
        category = args[2] if len(args) > 2 else 'unknown'
        
        with db_manager.get_session() as session:
            fund = FundBasic(
                fund_code=code,
                fund_name=name,
                fund_type=category,
                is_active=True,
                is_monitored=True
            )
            session.add(fund)
            session.commit()
            print(f"✅ 添加成功: {fund.fund_code} - {fund.fund_name}")
    
    def do_fund_search(self, arg):
        """搜索基金: fund_search <keyword>"""
        if not arg:
            print("❌ 请输入搜索关键词")
            return
        
        keyword = arg.strip()
        
        with db_manager.get_session() as session:
            from sqlalchemy import or_
            funds = session.query(FundBasic).filter(
                or_(
                    FundBasic.fund_code.like(f'%{keyword}%'),
                    FundBasic.fund_name.like(f'%{keyword}%')
                )
            ).all()
            
            print(f"\n🔍 搜索结果 '{keyword}':")
            print("-" * 80)
            for fund in funds:
                print(f"{fund.fund_code} - {fund.fund_name} ({fund.fund_type})")
            print("-" * 80)
            print(f"找到 {len(funds)} 只基金")
    
    # ========== 交易管理命令 ==========
    
    def do_trade_list(self, arg):
        """查看交易记录: trade_list [fund_code]"""
        with db_manager.get_session() as session:
            query = session.query(TradeRecord).order_by(TradeRecord.trade_date.desc())
            
            if arg.strip():
                query = query.filter_by(fund_code=arg.strip())
            
            trades = query.all()
            
            print("\n💰 交易记录:")
            print("-" * 100)
            print(f"{'ID':<5} {'日期':<12} {'代码':<10} {'类型':<6} {'份额':<12} {'金额':<12}")
            print("-" * 100)
            
            for trade in trades[:30]:
                type_str = '买入' if trade.trade_type == 'buy' else '卖出'
                print(f"{trade.id:<5} {str(trade.trade_date):<12} {trade.fund_code:<10} "
                      f"{type_str:<6} {float(trade.shares):<12.2f} ¥{float(trade.amount):<11.2f}")
            
            print("-" * 100)
            if len(trades) > 30:
                print(f"... 还有 {len(trades) - 30} 条记录")
            print(f"共 {len(trades)} 条交易记录")
    
    def do_trade_buy(self, arg):
        """记录买入: trade_buy"""
        print("\n📥 记录买入:")
        fund_code = input("基金代码: ").strip()
        date_str = input("交易日期 (YYYY-MM-DD，默认今天): ").strip() or datetime.now().strftime('%Y-%m-%d')
        
        try:
            shares = float(input("买入份额: ").strip())
            amount = float(input("买入金额: ").strip())
        except ValueError:
            print("❌ 份额和金额必须是数字")
            return
        
        remark = input("备注 (可选): ").strip()
        
        with db_manager.get_session() as session:
            trade = TradeRecord(
                fund_code=fund_code,
                trade_date=datetime.strptime(date_str, '%Y-%m-%d').date(),
                trade_type='buy',
                trade_status='confirmed',
                shares=shares,
                amount=amount,
                remark=remark
            )
            session.add(trade)
            session.commit()
            print(f"✅ 买入记录添加成功: ID={trade.id}")
    
    def do_trade_sell(self, arg):
        """记录卖出: trade_sell"""
        print("\n📤 记录卖出:")
        fund_code = input("基金代码: ").strip()
        date_str = input("交易日期 (YYYY-MM-DD，默认今天): ").strip() or datetime.now().strftime('%Y-%m-%d')
        
        try:
            shares = float(input("卖出份额: ").strip())
            amount = float(input("卖出金额: ").strip())
        except ValueError:
            print("❌ 份额和金额必须是数字")
            return
        
        remark = input("备注 (可选): ").strip()
        
        with db_manager.get_session() as session:
            trade = TradeRecord(
                fund_code=fund_code,
                trade_date=datetime.strptime(date_str, '%Y-%m-%d').date(),
                trade_type='sell',
                trade_status='confirmed',
                shares=shares,
                amount=amount,
                remark=remark
            )
            session.add(trade)
            session.commit()
            print(f"✅ 卖出记录添加成功: ID={trade.id}")
    
    def do_trade_delete(self, arg):
        """删除交易记录: trade_delete <id>"""
        if not arg:
            print("❌ 请输入交易ID")
            return
        
        try:
            trade_id = int(arg.strip())
        except ValueError:
            print("❌ ID必须是数字")
            return
        
        with db_manager.get_session() as session:
            trade = session.query(TradeRecord).filter_by(id=trade_id).first()
            if trade:
                session.delete(trade)
                session.commit()
                print(f"✅ 删除成功: ID={trade_id}")
            else:
                print(f"❌ 交易记录不存在: ID={trade_id}")
    
    # ========== 持仓与收益命令 ==========
    
    def do_holding(self, arg):
        """查看当前持仓"""
        from collections import defaultdict
        
        with db_manager.get_session() as session:
            trades = session.query(TradeRecord).filter_by(trade_status='confirmed').all()
            
            # 计算持仓
            holdings = defaultdict(lambda: {'shares': 0, 'cost': 0})
            
            for trade in trades:
                if trade.trade_type == 'buy':
                    holdings[trade.fund_code]['shares'] += float(trade.shares)
                    holdings[trade.fund_code]['cost'] += float(trade.amount)
                elif trade.trade_type == 'sell':
                    if holdings[trade.fund_code]['shares'] > 0:
                        ratio = float(trade.shares) / holdings[trade.fund_code]['shares']
                        holdings[trade.fund_code]['cost'] -= holdings[trade.fund_code]['cost'] * ratio
                        holdings[trade.fund_code]['shares'] -= float(trade.shares)
            
            # 过滤清仓
            holdings = {k: v for k, v in holdings.items() if v['shares'] > 0}
            
            if not holdings:
                print("\n📭 当前没有持仓")
                return
            
            print("\n📊 当前持仓:")
            print("-" * 100)
            print(f"{'代码':<10} {'名称':<20} {'份额':<12} {'成本价':<10} {'市值':<12} {'盈亏':<12}")
            print("-" * 100)
            
            total_value = 0
            total_cost = 0
            
            for fund_code, data in holdings.items():
                fund = session.query(FundBasic).filter_by(fund_code=fund_code).first()
                fund_name = fund.fund_name if fund else 'N/A'
                avg_cost = data['cost'] / data['shares'] if data['shares'] > 0 else 0
                
                # 使用成本价作为当前净值（简化）
                value = data['shares'] * avg_cost
                profit = 0  # 简化计算
                
                total_value += value
                total_cost += data['cost']
                
                name = fund_name[:18] + '..' if fund_name and len(fund_name) > 20 else fund_name
                print(f"{fund_code:<10} {name:<20} {data['shares']:<12.2f} "
                      f"{avg_cost:<10.4f} ¥{value:<11.2f} {profit:+.2f}")
            
            print("-" * 100)
            print(f"{'总计':<10} {'':<20} {'':<12} {'':<10} "
                  f"¥{total_value:<11.2f} {total_value-total_cost:+.2f}")
            print(f"\n💰 总资产: ¥{total_value:,.2f}")
    
    def do_profit(self, arg):
        """收益分析"""
        with db_manager.get_session() as session:
            trades = session.query(TradeRecord).filter_by(trade_status='confirmed').all()
            
            total_buy = sum(float(t.amount) for t in trades if t.trade_type == 'buy')
            total_sell = sum(float(t.amount) for t in trades if t.trade_type == 'sell')
            
            print("\n📈 收益分析报告:")
            print("=" * 60)
            print(f"\n💰 交易统计:")
            print(f"   累计买入: ¥{total_buy:,.2f}")
            print(f"   累计卖出: ¥{total_sell:,.2f}")
            print(f"   净投入: ¥{total_buy - total_sell:,.2f}")
            print("=" * 60)
    
    def do_report(self, arg):
        """生成报告: report"""
        self.do_holding(arg)
        self.do_profit(arg)
    
    # ========== 帮助命令 ==========
    
    def do_help(self, arg):
        """显示帮助信息"""
        if arg:
            super().do_help(arg)
        else:
            print("""
╔══════════════════════════════════════════════════════════════╗
║                        可用命令列表                           ║
╠══════════════════════════════════════════════════════════════╣
║ 基础命令:                                                     ║
║   status              查看系统状态                            ║
║   clear               清屏                                    ║
║   quit/exit           退出系统                                ║
╠══════════════════════════════════════════════════════════════╣
║ 基金管理:                                                     ║
║   fund_list           列出所有基金                            ║
║   fund_add            添加基金                                ║
║   fund_search         搜索基金                                ║
╠══════════════════════════════════════════════════════════════╣
║ 交易管理:                                                     ║
║   trade_list          查看交易记录                            ║
║   trade_buy           记录买入                                ║
║   trade_sell          记录卖出                                ║
║   trade_delete        删除交易记录                            ║
╠══════════════════════════════════════════════════════════════╣
║ 持仓与收益:                                                   ║
║   holding             查看当前持仓                            ║
║   profit              收益分析                                ║
║   report              生成报告                                ║
╚══════════════════════════════════════════════════════════════╝

输入 'help <command>' 查看命令详细说明。
            """)


def start_interactive_cli():
    """启动交互式CLI"""
    try:
        cli = FundSystemCLI()
        cli.cmdloop()
    except KeyboardInterrupt:
        print("\n\n感谢使用，再见！")
        sys.exit(0)
