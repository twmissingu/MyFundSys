#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
交易管理命令行交互界面
提供友好的CLI界面进行买卖记录管理、持仓查询等操作
"""

import sys
import os
from datetime import datetime
from typing import Optional

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from trade_manager import TradeManager, TradeType, TradeRecord
from position_calculator import PositionCalculator, Position


class TradeCLI:
    """交易管理命令行界面"""
    
    def __init__(self):
        self.trade_manager = TradeManager()
        self.calculator = PositionCalculator(self.trade_manager)
        self.running = True
    
    def clear_screen(self):
        """清屏"""
        os.system('clear' if os.name == 'posix' else 'cls')
    
    def print_header(self, title: str):
        """打印标题"""
        print("\n" + "=" * 60)
        print(f"  {title}")
        print("=" * 60)
    
    def print_menu(self):
        """打印主菜单"""
        self.print_header("基金交易管理系统")
        print("\n  【交易管理】")
        print("    1. 录入买入记录")
        print("    2. 录入卖出记录")
        print("    3. 查询交易记录")
        print("    4. 修改交易记录")
        print("    5. 删除交易记录")
        print("\n  【持仓管理】")
        print("    6. 查看持仓")
        print("    7. 查看持仓详情")
        print("    8. 投资组合摘要")
        print("\n  【数据管理】")
        print("    9. 导出交易记录")
        print("   10. 导入交易记录")
        print("   11. 交易统计")
        print("\n  【系统】")
        print("    0. 退出系统")
        print("\n" + "-" * 60)
    
    def get_input(self, prompt: str, default: str = None, required: bool = True) -> str:
        """获取用户输入"""
        if default:
            full_prompt = f"{prompt} [{default}]: "
        else:
            full_prompt = f"{prompt}: "
        
        while True:
            value = input(full_prompt).strip()
            if value:
                return value
            if default is not None:
                return default
            if not required:
                return ""
            print("  ⚠ 该字段不能为空，请重新输入")
    
    def get_float_input(self, prompt: str, default: float = None, required: bool = True) -> float:
        """获取浮点数输入"""
        while True:
            try:
                value = self.get_input(prompt, str(default) if default else None, required)
                if not value and not required:
                    return 0.0
                return float(value)
            except ValueError:
                print("  ⚠ 请输入有效的数字")
    
    def get_date_input(self, prompt: str, default: str = None) -> str:
        """获取日期输入"""
        if default is None:
            default = datetime.now().strftime("%Y-%m-%d")
        
        while True:
            value = self.get_input(prompt, default)
            try:
                datetime.strptime(value, "%Y-%m-%d")
                return value
            except ValueError:
                print("  ⚠ 日期格式错误，请使用 YYYY-MM-DD 格式")
    
    def confirm(self, message: str) -> bool:
        """确认操作"""
        response = input(f"{message} (y/n): ").strip().lower()
        return response in ['y', 'yes', '是', '确认']
    
    def add_buy_trade(self):
        """添加买入记录"""
        self.print_header("录入买入记录")
        
        trade_date = self.get_date_input("交易日期")
        fund_code = self.get_input("基金代码 (6位数字)")
        
        print("\n  请选择输入方式:")
        print("    1. 输入金额 + 净值（自动计算份额）")
        print("    2. 输入份额 + 净值（自动计算金额）")
        print("    3. 手动输入金额、份额、净值")
        
        choice = input("\n  请选择 [1]: ").strip() or "1"
        
        if choice == "1":
            amount = self.get_float_input("买入金额 (元)")
            nav = self.get_float_input("单位净值")
            fee = self.get_float_input("手续费", 0)
            shares = (amount - fee) / nav
            print(f"\n  计算得出份额: {shares:.4f}")
        elif choice == "2":
            shares = self.get_float_input("买入份额")
            nav = self.get_float_input("单位净值")
            fee = self.get_float_input("手续费", 0)
            amount = shares * nav + fee
            print(f"\n  计算得出金额: {amount:.2f} 元")
        else:
            amount = self.get_float_input("买入金额 (元)")
            shares = self.get_float_input("买入份额")
            nav = self.get_float_input("单位净值")
            fee = self.get_float_input("手续费", 0)
        
        remark = self.get_input("备注", required=False)
        
        print("\n  请确认交易信息:")
        print(f"    日期: {trade_date}")
        print(f"    基金: {fund_code}")
        print(f"    类型: 买入")
        print(f"    金额: {amount:.2f} 元")
        print(f"    份额: {shares:.4f}")
        print(f"    净值: {nav:.4f}")
        print(f"    手续费: {fee:.2f} 元")
        
        if self.confirm("\n  确认录入?"):
            success, result = self.trade_manager.add_trade(
                trade_date=trade_date,
                fund_code=fund_code,
                trade_type="buy",
                amount=amount,
                shares=shares,
                nav=nav,
                fee=fee,
                remark=remark
            )
            
            if success:
                print(f"\n  ✓ 买入记录添加成功!")
                print(f"    交易ID: {result.id}")
            else:
                print(f"\n  ✗ 添加失败: {result}")
        else:
            print("\n  已取消")
        
        input("\n  按回车键继续...")
    
    def add_sell_trade(self):
        """添加卖出记录"""
        self.print_header("录入卖出记录")
        
        # 先显示持仓
        positions = self.calculator.calculate_all_positions()
        if positions:
            print("\n  当前持仓:")
            for code, pos in positions.items():
                print(f"    {code}: {pos.total_shares:.4f} 份")
        
        trade_date = self.get_date_input("交易日期")
        fund_code = self.get_input("基金代码 (6位数字)")
        
        # 检查持仓
        position = self.calculator.calculate_position(fund_code)
        if position and position.total_shares > 0:
            print(f"\n  当前持仓: {position.total_shares:.4f} 份")
            print(f"  平均成本: {position.avg_cost:.4f}")
        
        print("\n  请选择输入方式:")
        print("    1. 输入份额 + 净值（自动计算金额）")
        print("    2. 输入金额 + 净值（自动计算份额）")
        print("    3. 手动输入金额、份额、净值")
        
        choice = input("\n  请选择 [1]: ").strip() or "1"
        
        if choice == "1":
            shares = self.get_float_input("卖出份额")
            nav = self.get_float_input("单位净值")
            fee = self.get_float_input("手续费", 0)
            amount = shares * nav - fee
            print(f"\n  计算得出金额: {amount:.2f} 元")
        elif choice == "2":
            amount = self.get_float_input("卖出金额 (元)")
            nav = self.get_float_input("单位净值")
            fee = self.get_float_input("手续费", 0)
            shares = (amount + fee) / nav
            print(f"\n  计算得出份额: {shares:.4f}")
        else:
            amount = self.get_float_input("卖出金额 (元)")
            shares = self.get_float_input("卖出份额")
            nav = self.get_float_input("单位净值")
            fee = self.get_float_input("手续费", 0)
        
        remark = self.get_input("备注", required=False)
        
        # 检查卖出份额是否超过持仓
        if position and shares > position.total_shares:
            print(f"\n  ⚠ 警告: 卖出份额({shares:.4f})超过持仓({position.total_shares:.4f})")
            if not self.confirm("  是否继续?"):
                print("\n  已取消")
                input("\n  按回车键继续...")
                return
        
        print("\n  请确认交易信息:")
        print(f"    日期: {trade_date}")
        print(f"    基金: {fund_code}")
        print(f"    类型: 卖出")
        print(f"    金额: {amount:.2f} 元")
        print(f"    份额: {shares:.4f}")
        print(f"    净值: {nav:.4f}")
        print(f"    手续费: {fee:.2f} 元")
        
        if position:
            expected_pnl = amount - fee - (shares * position.avg_cost)
            print(f"    预计盈亏: {expected_pnl:.2f} 元")
        
        if self.confirm("\n  确认录入?"):
            success, result = self.trade_manager.add_trade(
                trade_date=trade_date,
                fund_code=fund_code,
                trade_type="sell",
                amount=amount,
                shares=shares,
                nav=nav,
                fee=fee,
                remark=remark
            )
            
            if success:
                print(f"\n  ✓ 卖出记录添加成功!")
                print(f"    交易ID: {result.id}")
            else:
                print(f"\n  ✗ 添加失败: {result}")
        else:
            print("\n  已取消")
        
        input("\n  按回车键继续...")
    
    def query_trades(self):
        """查询交易记录"""
        self.print_header("查询交易记录")
        
        print("\n  筛选条件（直接回车跳过）:")
        fund_code = self.get_input("基金代码", required=False)
        
        print("\n  交易类型:")
        print("    1. 全部")
        print("    2. 买入")
        print("    3. 卖出")
        type_choice = input("  请选择 [1]: ").strip() or "1"
        
        trade_type = None
        if type_choice == "2":
            trade_type = "buy"
        elif type_choice == "3":
            trade_type = "sell"
        
        start_date = self.get_input("开始日期 (YYYY-MM-DD)", required=False)
        end_date = self.get_input("结束日期 (YYYY-MM-DD)", required=False)
        
        # 查询
        trades = self.trade_manager.get_all_trades(
            fund_code=fund_code if fund_code else None,
            trade_type=trade_type,
            start_date=start_date if start_date else None,
            end_date=end_date if end_date else None
        )
        
        print(f"\n  共找到 {len(trades)} 条记录:\n")
        
        if trades:
            print(f"  {'交易ID':<18} {'日期':<12} {'基金':<8} {'类型':<6} {'金额':<12} {'份额':<10} {'净值':<8}")
            print("  " + "-" * 90)
            
            for t in trades:
                type_str = "买入" if t.trade_type == "buy" else "卖出"
                print(f"  {t.id:<18} {t.trade_date:<12} {t.fund_code:<8} {type_str:<6} "
                      f"{t.amount:>10.2f} {t.shares:>10.4f} {t.nav:>8.4f}")
        else:
            print("  暂无交易记录")
        
        input("\n  按回车键继续...")
    
    def update_trade(self):
        """修改交易记录"""
        self.print_header("修改交易记录")
        
        trade_id = self.get_input("交易ID")
        trade = self.trade_manager.get_trade(trade_id)
        
        if not trade:
            print(f"\n  ✗ 未找到交易记录: {trade_id}")
            input("\n  按回车键继续...")
            return
        
        print(f"\n  当前记录:")
        print(f"    日期: {trade.trade_date}")
        print(f"    基金: {trade.fund_code}")
        print(f"    类型: {'买入' if trade.trade_type == 'buy' else '卖出'}")
        print(f"    金额: {trade.amount}")
        print(f"    份额: {trade.shares}")
        print(f"    净值: {trade.nav}")
        print(f"    手续费: {trade.fee}")
        print(f"    备注: {trade.remark}")
        
        print("\n  请输入新值（直接回车保持原值）:")
        
        updates = {}
        
        new_date = self.get_input(f"日期 [{trade.trade_date}]", required=False)
        if new_date:
            updates['trade_date'] = new_date
        
        new_code = self.get_input(f"基金代码 [{trade.fund_code}]", required=False)
        if new_code:
            updates['fund_code'] = new_code
        
        new_amount = input(f"  金额 [{trade.amount}]: ").strip()
        if new_amount:
            updates['amount'] = float(new_amount)
        
        new_shares = input(f"  份额 [{trade.shares}]: ").strip()
        if new_shares:
            updates['shares'] = float(new_shares)
        
        new_nav = input(f"  净值 [{trade.nav}]: ").strip()
        if new_nav:
            updates['nav'] = float(new_nav)
        
        new_fee = input(f"  手续费 [{trade.fee}]: ").strip()
        if new_fee:
            updates['fee'] = float(new_fee)
        
        new_remark = self.get_input(f"备注 [{trade.remark}]", required=False)
        if new_remark:
            updates['remark'] = new_remark
        
        if updates:
            if self.confirm("\n  确认修改?"):
                success, result = self.trade_manager.update_trade(trade_id, **updates)
                if success:
                    print("\n  ✓ 修改成功!")
                else:
                    print(f"\n  ✗ 修改失败: {result}")
            else:
                print("\n  已取消")
        else:
            print("\n  未做任何修改")
        
        input("\n  按回车键继续...")
    
    def delete_trade(self):
        """删除交易记录"""
        self.print_header("删除交易记录")
        
        trade_id = self.get_input("交易ID")
        trade = self.trade_manager.get_trade(trade_id)
        
        if not trade:
            print(f"\n  ✗ 未找到交易记录: {trade_id}")
            input("\n  按回车键继续...")
            return
        
        print(f"\n  要删除的记录:")
        print(f"    日期: {trade.trade_date}")
        print(f"    基金: {trade.fund_code}")
        print(f"    类型: {'买入' if trade.trade_type == 'buy' else '卖出'}")
        print(f"    金额: {trade.amount}")
        
        if self.confirm("\n  ⚠ 确认删除? 此操作不可恢复!"):
            success, msg = self.trade_manager.delete_trade(trade_id)
            if success:
                print("\n  ✓ 删除成功!")
            else:
                print(f"\n  ✗ 删除失败: {msg}")
        else:
            print("\n  已取消")
        
        input("\n  按回车键继续...")
    
    def view_positions(self):
        """查看持仓"""
        self.print_header("当前持仓")
        
        positions = self.calculator.calculate_all_positions()
        
        if not positions:
            print("\n  暂无持仓")
        else:
            print(f"\n  {'基金代码':<10} {'持仓份额':<12} {'平均成本':<10} {'最新净值':<10} {'市值':<12} {'盈亏':<12} {'收益率':<10}")
            print("  " + "-" * 90)
            
            for code, pos in positions.items():
                if pos.total_shares > 0:
                    pnl_str = f"{pos.total_pnl:+.2f}"
                    pnl_rate_str = f"{pos.pnl_rate * 100:+.2f}%"
                    print(f"  {code:<10} {pos.total_shares:<12.4f} {pos.avg_cost:<10.4f} "
                          f"{pos.current_nav:<10.4f} {pos.market_value:<12.2f} "
                          f"{pnl_str:<12} {pnl_rate_str:<10}")
        
        input("\n  按回车键继续...")
    
    def view_position_detail(self):
        """查看持仓详情"""
        self.print_header("持仓详情")
        
        fund_code = self.get_input("基金代码")
        
        position, trades = self.calculator.get_position_with_trades(fund_code)
        
        if not position:
            print(f"\n  未找到基金 {fund_code} 的持仓记录")
        else:
            print(f"\n  【持仓概况】")
            print(f"    基金代码: {position.fund_code}")
            print(f"    持仓份额: {position.total_shares:.4f}")
            print(f"    平均成本: {position.avg_cost:.4f}")
            print(f"    最新净值: {position.current_nav:.4f}")
            print(f"    总成本: {position.total_cost:.2f} 元")
            print(f"    市值: {position.market_value:.2f} 元")
            print(f"    未实现盈亏: {position.unrealized_pnl:+.2f} 元")
            print(f"    已实现盈亏: {position.realized_pnl:+.2f} 元")
            print(f"    总盈亏: {position.total_pnl:+.2f} 元")
            print(f"    收益率: {position.pnl_rate * 100:+.2f}%")
            print(f"    买入次数: {position.buy_count}")
            print(f"    卖出次数: {position.sell_count}")
            print(f"    首次买入: {position.first_buy_date}")
            print(f"    最后交易: {position.last_trade_date}")
            
            print(f"\n  【交易明细】")
            if trades:
                print(f"    {'日期':<12} {'类型':<6} {'金额':<12} {'份额':<10} {'净值':<8} {'手续费':<8}")
                print("    " + "-" * 70)
                for t in trades:
                    type_str = "买入" if t.trade_type == "buy" else "卖出"
                    print(f"    {t.trade_date:<12} {type_str:<6} {t.amount:>10.2f} "
                          f"{t.shares:>10.4f} {t.nav:>8.4f} {t.fee:>8.2f}")
            else:
                print("    暂无交易记录")
        
        input("\n  按回车键继续...")
    
    def view_portfolio_summary(self):
        """查看投资组合摘要"""
        self.print_header("投资组合摘要")
        
        summary = self.calculator.calculate_portfolio_summary()
        
        print(f"\n  【总体概况】")
        print(f"    持仓基金数: {summary.position_count} 只")
        print(f"    总投入成本: {summary.total_cost:.2f} 元")
        print(f"    当前总市值: {summary.total_market_value:.2f} 元")
        print(f"    总未实现盈亏: {summary.total_unrealized_pnl:+.2f} 元")
        print(f"    总已实现盈亏: {summary.total_realized_pnl:+.2f} 元")
        print(f"    总盈亏: {summary.total_pnl:+.2f} 元")
        print(f"    总收益率: {summary.total_pnl_rate * 100:+.2f}%")
        
        # 资产配置
        allocation = self.calculator.get_asset_allocation()
        if allocation:
            print(f"\n  【资产配置】")
            for category, ratio in allocation.items():
                bar = "█" * int(ratio * 20)
                print(f"    {category:<12} {ratio * 100:>6.2f}% {bar}")
        
        input("\n  按回车键继续...")
    
    def export_trades(self):
        """导出交易记录"""
        self.print_header("导出交易记录")
        
        default_filename = f"trades_export_{datetime.now().strftime('%Y%m%d')}.csv"
        filepath = self.get_input("导出文件路径", default_filename)
        
        if self.trade_manager.export_to_csv(filepath):
            print(f"\n  ✓ 导出成功: {filepath}")
        else:
            print(f"\n  ✗ 导出失败")
        
        input("\n  按回车键继续...")
    
    def import_trades(self):
        """导入交易记录"""
        self.print_header("导入交易记录")
        
        filepath = self.get_input("CSV文件路径")
        
        if not os.path.exists(filepath):
            print(f"\n  ✗ 文件不存在: {filepath}")
            input("\n  按回车键继续...")
            return
        
        if self.confirm(f"\n  确认从 {filepath} 导入交易记录?"):
            success, fail, errors = self.trade_manager.import_from_csv(filepath)
            print(f"\n  导入完成:")
            print(f"    成功: {success} 条")
            print(f"    失败: {fail} 条")
            
            if errors:
                print(f"\n  错误信息:")
                for error in errors[:10]:  # 只显示前10条错误
                    print(f"    - {error}")
                if len(errors) > 10:
                    print(f"    ... 还有 {len(errors) - 10} 条错误")
        else:
            print("\n  已取消")
        
        input("\n  按回车键继续...")
    
    def view_statistics(self):
        """查看交易统计"""
        self.print_header("交易统计")
        
        summary = self.trade_manager.get_trade_summary()
        
        print(f"\n  【交易概况】")
        print(f"    总交易次数: {summary['total_trades']}")
        print(f"    买入次数: {summary['buy_trades']}")
        print(f"    卖出次数: {summary['sell_trades']}")
        print(f"    涉及基金: {summary['fund_count']} 只")
        
        print(f"\n  【资金统计】")
        print(f"    总买入金额: {summary['total_buy_amount']:.2f} 元")
        print(f"    总卖出金额: {summary['total_sell_amount']:.2f} 元")
        print(f"    总手续费: {summary['total_fee']:.2f} 元")
        print(f"    净投入: {summary['total_buy_amount'] - summary['total_sell_amount']:.2f} 元")
        
        # 基金交易统计
        fund_codes = self.trade_manager.get_fund_codes()
        if fund_codes:
            print(f"\n  【各基金交易次数】")
            for code in fund_codes:
                trades = self.trade_manager.get_trades_by_fund(code)
                buy_count = len([t for t in trades if t.trade_type == "buy"])
                sell_count = len([t for t in trades if t.trade_type == "sell"])
                print(f"    {code}: 买入{buy_count}次, 卖出{sell_count}次")
        
        input("\n  按回车键继续...")
    
    def run(self):
        """运行主循环"""
        while self.running:
            self.clear_screen()
            self.print_menu()
            
            choice = input("  请选择操作 [0-11]: ").strip()
            
            if choice == "0":
                self.running = False
                print("\n  感谢使用，再见！\n")
            elif choice == "1":
                self.add_buy_trade()
            elif choice == "2":
                self.add_sell_trade()
            elif choice == "3":
                self.query_trades()
            elif choice == "4":
                self.update_trade()
            elif choice == "5":
                self.delete_trade()
            elif choice == "6":
                self.view_positions()
            elif choice == "7":
                self.view_position_detail()
            elif choice == "8":
                self.view_portfolio_summary()
            elif choice == "9":
                self.export_trades()
            elif choice == "10":
                self.import_trades()
            elif choice == "11":
                self.view_statistics()
            else:
                print("\n  无效选择，请重试")
                input("  按回车键继续...")


def main():
    """主函数"""
    cli = TradeCLI()
    
    try:
        cli.run()
    except KeyboardInterrupt:
        print("\n\n  程序已退出")
        sys.exit(0)


if __name__ == "__main__":
    main()
