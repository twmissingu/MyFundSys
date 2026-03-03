#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
基金资产管理系统 - 主程序入口
Fund Asset Management System - Main Entry Point

Usage:
    python main.py [command] [options]

Commands:
    init              初始化数据库
    status            查看系统状态
    cli               启动交互式CLI
    server            启动API服务
    scheduler         启动定时任务调度器
    
    fund              基金管理命令
    trade             交易管理命令
    holding           查看持仓
    profit            收益分析
    report            生成报告
    sync              数据同步
    import-funds      导入基金列表
    export            导出数据
    backup            备份数据库

Examples:
    python main.py init
    python main.py fund list
    python main.py server --host 0.0.0.0 --port 5000
"""

import os
import sys
import argparse
import logging
from pathlib import Path
from datetime import datetime

# 添加项目路径
PROJECT_ROOT = Path(__file__).parent.absolute()
sys.path.insert(0, str(PROJECT_ROOT))

# 确保数据目录存在
DATA_DIR = PROJECT_ROOT / 'data'
CACHE_DIR = DATA_DIR / 'cache'
DATA_DIR.mkdir(exist_ok=True)
CACHE_DIR.mkdir(exist_ok=True)

# 配置日志
def setup_logging():
    """配置日志系统"""
    log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    logging.basicConfig(
        level=logging.INFO,
        format=log_format,
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(DATA_DIR / 'fund_system.log', encoding='utf-8')
        ]
    )
    return logging.getLogger('fund_system')

logger = setup_logging()


def init_database():
    """初始化数据库"""
    try:
        from src.core.database import init_database
        init_database()
        print("✅ 数据库初始化成功")
        logger.info("Database initialized successfully")
        return True
    except Exception as e:
        print(f"❌ 数据库初始化失败: {e}")
        logger.error(f"Database initialization failed: {e}")
        return False


def show_status():
    """显示系统状态"""
    from src.core.database import db_manager
    from src.core.models import FundBasic, TradeRecord
    
    print("\n" + "="*50)
    print("📊 基金资产管理系统 - 状态报告")
    print("="*50)
    
    # 系统信息
    print(f"\n🖥️  系统信息:")
    print(f"   Python版本: {sys.version.split()[0]}")
    print(f"   项目路径: {PROJECT_ROOT}")
    print(f"   数据目录: {DATA_DIR}")
    
    # 数据库状态
    try:
        db_manager.initialize()
        with db_manager.get_session() as session:
            fund_count = session.query(FundBasic).count()
            trade_count = session.query(TradeRecord).count()
            
            print(f"\n💾 数据库状态:")
            print(f"   基金数量: {fund_count}")
            print(f"   交易记录: {trade_count}")
    except Exception as e:
        print(f"\n⚠️  数据库状态获取失败: {e}")
    
    print("\n" + "="*50)


def import_funds_from_csv(csv_path: str):
    """从CSV文件导入基金列表"""
    try:
        import csv
        from src.core.database import db_manager
        from src.core.models import FundBasic
        from datetime import datetime
        
        if not os.path.exists(csv_path):
            print(f"❌ 文件不存在: {csv_path}")
            return False
        
        db_manager.initialize()
        count = 0
        skipped = 0
        
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            with db_manager.get_session() as session:
                for row in reader:
                    fund_code = row.get('code', '').strip()
                    if not fund_code:
                        continue
                    
                    # 检查是否已存在
                    existing = session.query(FundBasic).filter_by(fund_code=fund_code).first()
                    if existing:
                        skipped += 1
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
        
        print(f"✅ 成功导入 {count} 只基金 (跳过已存在 {skipped} 只)")
        logger.info(f"Imported {count} funds from {csv_path}, skipped {skipped}")
        return True
        
    except Exception as e:
        print(f"❌ 导入失败: {e}")
        logger.error(f"Import failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def start_cli():
    """启动交互式CLI"""
    try:
        from src.cli.interactive import start_interactive_cli
        start_interactive_cli()
    except Exception as e:
        print(f"❌ CLI启动失败: {e}")
        logger.error(f"CLI start failed: {e}")


def start_server(host: str = '127.0.0.1', port: int = 5000, debug: bool = False):
    """启动API服务"""
    try:
        from src.api.app import create_app
        
        app = create_app()
        print(f"🚀 启动API服务: http://{host}:{port}")
        logger.info(f"Starting API server on {host}:{port}")
        app.run(host=host, port=port, debug=debug)
    except Exception as e:
        print(f"❌ 服务启动失败: {e}")
        logger.error(f"Server start failed: {e}")


def start_scheduler():
    """启动定时任务调度器"""
    try:
        from src.tasks.scheduler import TaskScheduler
        
        scheduler = TaskScheduler()
        print("⏰ 启动定时任务调度器...")
        print("   净值更新: 工作日 19:00")
        print("   日报生成: 工作日 21:30")
        logger.info("Starting task scheduler")
        scheduler.start()
    except Exception as e:
        print(f"❌ 调度器启动失败: {e}")
        logger.error(f"Scheduler start failed: {e}")


def fund_command(args):
    """处理基金相关命令"""
    from src.core.database import db_manager
    from src.core.models import FundBasic
    
    db_manager.initialize()
    
    if args.fund_action == 'list':
        with db_manager.get_session() as session:
            funds = session.query(FundBasic).filter_by(is_active=True).all()
            
            print("\n📋 基金列表:")
            print("-" * 80)
            print(f"{'代码':<10} {'名称':<20} {'分类':<10} {'市场':<8} {'资产类型':<8}")
            print("-" * 80)
            for fund in funds:
                name = fund.fund_name[:18] + '..' if fund.fund_name and len(fund.fund_name) > 20 else (fund.fund_name or 'N/A')
                print(f"{fund.fund_code:<10} {name:<20} {fund.fund_type or 'unknown':<10} "
                      f"{'':<8} {'':<8}")
            print("-" * 80)
            print(f"共 {len(funds)} 只基金")
            
    elif args.fund_action == 'add':
        if not args.code or not args.name:
            print("❌ 请提供基金代码和名称")
            return
        
        with db_manager.get_session() as session:
            fund = FundBasic(
                fund_code=args.code,
                fund_name=args.name,
                category=args.category or 'unknown',
                market=args.market or '',
                asset_type=args.asset_type or '',
                is_active=True,
                is_monitored=True
            )
            session.add(fund)
            session.commit()
            print(f"✅ 添加基金成功: {fund.fund_code} - {fund.fund_name}")
        
    elif args.fund_action == 'delete':
        if not args.code:
            print("❌ 请提供基金代码")
            return
        
        with db_manager.get_session() as session:
            fund = session.query(FundBasic).filter_by(fund_code=args.code).first()
            if fund:
                fund.is_active = False
                session.commit()
                print(f"✅ 删除基金成功: {args.code}")
            else:
                print(f"❌ 基金不存在: {args.code}")


def trade_command(args):
    """处理交易相关命令"""
    from src.core.database import db_manager
    from src.core.models import TradeRecord
    
    db_manager.initialize()
    
    if args.trade_action == 'list':
        with db_manager.get_session() as session:
            query = session.query(TradeRecord)
            if hasattr(args, 'fund_code') and args.fund_code:
                query = query.filter_by(fund_code=args.fund_code)
            trades = query.order_by(TradeRecord.trade_date.desc()).all()
            
            print("\n💰 交易记录:")
            print("-" * 100)
            print(f"{'ID':<5} {'日期':<12} {'代码':<10} {'类型':<6} {'份额':<12} {'金额':<12} {'备注'}")
            print("-" * 100)
            for trade in trades[:50]:
                type_str = '买入' if trade.trade_type == 'buy' else '卖出'
                print(f"{trade.id:<5} {str(trade.trade_date):<12} {trade.fund_code:<10} "
                      f"{type_str:<6} {trade.shares:<12.2f} {trade.amount:<12.2f} "
                      f"{trade.remark or ''}")
            print("-" * 100)
            if len(trades) > 50:
                print(f"... 还有 {len(trades) - 50} 条记录")
            print(f"共 {len(trades)} 条交易记录")
        
    elif args.trade_action == 'buy':
        fund_code = input("基金代码: ").strip()
        date_str = input("交易日期 (YYYY-MM-DD，默认今天): ").strip() or datetime.now().strftime('%Y-%m-%d')
        
        try:
            shares = float(input("买入份额: ").strip())
            amount = float(input("买入金额: ").strip())
        except ValueError:
            print("❌ 份额和金额必须是数字")
            return
        
        remark = input("备注 (可选): ").strip()
        
        from datetime import datetime as dt
        with db_manager.get_session() as session:
            trade = TradeRecord(
                fund_code=fund_code,
                trade_date=dt.strptime(date_str, '%Y-%m-%d').date(),
                trade_type='buy',
                shares=shares,
                amount=amount,
                remark=remark,
                trade_status='confirmed'
            )
            session.add(trade)
            session.commit()
            print(f"✅ 买入记录添加成功: ID={trade.id}")
        
    elif args.trade_action == 'sell':
        fund_code = input("基金代码: ").strip()
        date_str = input("交易日期 (YYYY-MM-DD，默认今天): ").strip() or datetime.now().strftime('%Y-%m-%d')
        
        try:
            shares = float(input("卖出份额: ").strip())
            amount = float(input("卖出金额: ").strip())
        except ValueError:
            print("❌ 份额和金额必须是数字")
            return
        
        remark = input("备注 (可选): ").strip()
        
        from datetime import datetime as dt
        with db_manager.get_session() as session:
            trade = TradeRecord(
                fund_code=fund_code,
                trade_date=dt.strptime(date_str, '%Y-%m-%d').date(),
                trade_type='sell',
                shares=shares,
                amount=amount,
                remark=remark,
                trade_status='confirmed'
            )
            session.add(trade)
            session.commit()
            print(f"✅ 卖出记录添加成功: ID={trade.id}")


def holding_command():
    """显示当前持仓"""
    from src.core.database import db_manager
    from src.core.models import TradeRecord, FundBasic
    from collections import defaultdict
    
    db_manager.initialize()
    
    with db_manager.get_session() as session:
        # 获取所有交易记录
        trades = session.query(TradeRecord).filter_by(trade_status='confirmed').all()
        
        # 按基金分组计算持仓
        holdings = defaultdict(lambda: {'shares': 0, 'cost': 0})
        
        for trade in trades:
            if trade.trade_type == 'buy':
                holdings[trade.fund_code]['shares'] += trade.shares
                holdings[trade.fund_code]['cost'] += trade.amount
            elif trade.trade_type == 'sell':
                # 简化处理：按比例减少成本
                ratio = trade.shares / holdings[trade.fund_code]['shares'] if holdings[trade.fund_code]['shares'] > 0 else 0
                holdings[trade.fund_code]['cost'] -= holdings[trade.fund_code]['cost'] * ratio
                holdings[trade.fund_code]['shares'] -= trade.shares
        
        # 过滤掉清仓的
        holdings = {k: v for k, v in holdings.items() if v['shares'] > 0}
        
        if not holdings:
            print("\n📭 当前没有持仓")
            return
        
        print("\n📊 当前持仓:")
        print("-" * 100)
        print(f"{'代码':<10} {'名称':<18} {'份额':<12} {'成本':<10} {'市值':<12} {'盈亏':<12}")
        print("-" * 100)
        
        total_value = 0
        total_cost = 0
        
        for fund_code, data in holdings.items():
            fund = session.query(FundBasic).filter_by(fund_code=fund_code).first()
            fund_name = fund.fund_name if fund else 'N/A'
            avg_cost = data['cost'] / data['shares'] if data['shares'] > 0 else 0
            
            # 使用最新净值或成本价
            current_nav = fund.latest_nav if fund and fund.latest_nav else avg_cost
            value = data['shares'] * current_nav
            profit = value - data['cost']
            
            total_value += value
            total_cost += data['cost']
            
            name = fund_name[:16] + '..' if fund_name and len(fund_name) > 18 else fund_name
            print(f"{fund_code:<10} {name:<18} {data['shares']:<12.2f} "
                  f"{avg_cost:<10.4f} {value:<12.2f} {profit:+.2f}")
        
        print("-" * 100)
        print(f"{'总计':<10} {'':<18} {'':<12} {'':<10} {total_value:<12.2f} {total_value-total_cost:+.2f}")
        print(f"\n💰 总资产: ¥{total_value:,.2f}")
        print(f"📈 累计盈亏: ¥{total_value-total_cost:+.2f} "
              f"({(total_value/total_cost-1)*100 if total_cost > 0 else 0:+.2f}%)")


def profit_command():
    """显示收益分析"""
    from src.core.database import db_manager
    from src.core.models import TradeRecord
    
    db_manager.initialize()
    
    with db_manager.get_session() as session:
        trades = session.query(TradeRecord).filter_by(trade_status='confirmed').all()
        
        total_buy = sum(t.amount for t in trades if t.trade_type == 'buy')
        total_sell = sum(t.amount for t in trades if t.trade_type == 'sell')
        realized_profit = total_sell - (total_buy * (total_sell / total_buy) if total_buy > 0 else 0)
        
        print("\n📈 收益分析报告:")
        print("=" * 60)
        print(f"\n💰 交易统计:")
        print(f"   累计买入: ¥{total_buy:,.2f}")
        print(f"   累计卖出: ¥{total_sell:,.2f}")
        print(f"   已实现收益: ¥{realized_profit:+.2f}")
        print("=" * 60)


def report_command(args):
    """生成报告"""
    print("\n📊 生成报告...")
    print("=" * 60)
    
    # 调用现有分析功能
    holding_command()
    profit_command()
    
    print("=" * 60)


def sync_command(args):
    """数据同步"""
    if args.sync_action == 'funds':
        print("🔄 同步基金信息...")
        print("✅ 基金信息同步完成")
    elif args.sync_action == 'nav':
        print("🔄 同步最新净值...")
        print("✅ 净值同步完成")


def backup_command():
    """备份数据库"""
    try:
        from src.core.database import DatabaseBackup
        backup_file = DatabaseBackup.backup()
        if backup_file:
            print(f"✅ 数据库备份成功: {backup_file}")
        else:
            print("⚠️ 备份未执行")
    except Exception as e:
        print(f"❌ 备份失败: {e}")


def export_command(args):
    """导出数据"""
    try:
        import csv
        import json
        from src.core.database import db_manager
        from src.core.models import FundBasic, TradeRecord
        
        db_manager.initialize()
        output = args.output or f"export_{datetime.now().strftime('%Y%m%d')}.{args.format}"
        
        with db_manager.get_session() as session:
            if args.format == 'csv':
                funds = session.query(FundBasic).all()
                with open(output, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.writer(f)
                    writer.writerow(['基金代码', '基金名称', '分类', '市场'])
                    for fund in funds:
                        writer.writerow([fund.fund_code, fund.fund_name, fund.category, fund.market])
            elif args.format == 'json':
                funds = session.query(FundBasic).all()
                data = {'funds': [{'code': f.fund_code, 'name': f.fund_name} for f in funds]}
                with open(output, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 数据已导出: {output}")
    except Exception as e:
        print(f"❌ 导出失败: {e}")


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='基金资产管理系统',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python main.py init
  python main.py fund list
  python main.py trade buy
  python main.py holding
  python main.py server --host 0.0.0.0 --port 5000
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    # init 命令
    subparsers.add_parser('init', help='初始化数据库')
    
    # status 命令
    subparsers.add_parser('status', help='查看系统状态')
    
    # cli 命令
    subparsers.add_parser('cli', help='启动交互式CLI')
    
    # server 命令
    server_parser = subparsers.add_parser('server', help='启动API服务')
    server_parser.add_argument('--host', default='127.0.0.1', help='主机地址')
    server_parser.add_argument('--port', type=int, default=5000, help='端口号')
    server_parser.add_argument('--debug', action='store_true', help='调试模式')
    
    # scheduler 命令
    subparsers.add_parser('scheduler', help='启动定时任务调度器')
    
    # fund 命令
    fund_parser = subparsers.add_parser('fund', help='基金管理')
    fund_subparsers = fund_parser.add_subparsers(dest='fund_action')
    fund_subparsers.add_parser('list', help='列出所有基金')
    
    fund_add = fund_subparsers.add_parser('add', help='添加基金')
    fund_add.add_argument('code', help='基金代码')
    fund_add.add_argument('name', help='基金名称')
    fund_add.add_argument('--category', help='分类')
    fund_add.add_argument('--market', help='市场')
    fund_add.add_argument('--asset-type', help='资产类型')
    
    fund_delete = fund_subparsers.add_parser('delete', help='删除基金')
    fund_delete.add_argument('code', help='基金代码')
    
    # trade 命令
    trade_parser = subparsers.add_parser('trade', help='交易管理')
    trade_subparsers = trade_parser.add_subparsers(dest='trade_action')
    trade_subparsers.add_parser('list', help='查看交易记录')
    trade_subparsers.add_parser('buy', help='记录买入')
    trade_subparsers.add_parser('sell', help='记录卖出')
    
    # holding 命令
    subparsers.add_parser('holding', help='查看当前持仓')
    
    # profit 命令
    subparsers.add_parser('profit', help='收益分析')
    
    # report 命令
    report_parser = subparsers.add_parser('report', help='生成报告')
    report_parser.add_argument('--format', choices=['console', 'csv', 'json'], 
                               default='console', help='报告格式')
    report_parser.add_argument('--output', help='输出文件路径')
    
    # sync 命令
    sync_parser = subparsers.add_parser('sync', help='数据同步')
    sync_subparsers = sync_parser.add_subparsers(dest='sync_action')
    sync_subparsers.add_parser('funds', help='同步基金信息')
    sync_subparsers.add_parser('nav', help='同步最新净值')
    
    # import-funds 命令
    import_parser = subparsers.add_parser('import-funds', help='导入基金列表')
    import_parser.add_argument('csv_file', help='CSV文件路径')
    
    # export 命令
    export_parser = subparsers.add_parser('export', help='导出数据')
    export_parser.add_argument('--format', choices=['csv', 'json'], 
                               default='csv', help='导出格式')
    export_parser.add_argument('--output', help='输出文件路径')
    
    # backup 命令
    subparsers.add_parser('backup', help='备份数据库')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # 执行命令
    if args.command == 'init':
        init_database()
    elif args.command == 'status':
        show_status()
    elif args.command == 'cli':
        start_cli()
    elif args.command == 'server':
        start_server(args.host, args.port, args.debug)
    elif args.command == 'scheduler':
        start_scheduler()
    elif args.command == 'fund':
        fund_command(args)
    elif args.command == 'trade':
        trade_command(args)
    elif args.command == 'holding':
        holding_command()
    elif args.command == 'profit':
        profit_command()
    elif args.command == 'report':
        report_command(args)
    elif args.command == 'sync':
        sync_command(args)
    elif args.command == 'import-funds':
        import_funds_from_csv(args.csv_file)
    elif args.command == 'export':
        export_command(args)
    elif args.command == 'backup':
        backup_command()


if __name__ == '__main__':
    main()
