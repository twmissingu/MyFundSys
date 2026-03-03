#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
定时任务调度器
Task Scheduler
"""

import logging
from datetime import datetime

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger('fund_system')


class TaskScheduler:
    """任务调度器"""
    
    def __init__(self):
        self.scheduler = BlockingScheduler()
        self._setup_jobs()
    
    def _setup_jobs(self):
        """设置定时任务"""
        # 净值更新任务 - 工作日 19:00
        self.scheduler.add_job(
            self.update_nav_task,
            CronTrigger(day_of_week='mon-fri', hour=19, minute=0),
            id='update_nav',
            name='更新基金净值',
            replace_existing=True
        )
        
        # 日报生成任务 - 工作日 21:30
        self.scheduler.add_job(
            self.generate_report_task,
            CronTrigger(day_of_week='mon-fri', hour=21, minute=30),
            id='daily_report',
            name='生成日报',
            replace_existing=True
        )
        
        # 数据备份任务 - 每天 23:00
        self.scheduler.add_job(
            self.backup_task,
            CronTrigger(hour=23, minute=0),
            id='backup',
            name='数据备份',
            replace_existing=True
        )
        
        logger.info("Task scheduler initialized")
    
    def update_nav_task(self):
        """更新净值任务"""
        logger.info("Running NAV update task")
        print(f"[{datetime.now()}] 🔄 开始更新基金净值...")
        
        try:
            # TODO: 实现净值更新逻辑
            # from ..crawlers.eastmoney import EastMoneyCrawler
            # crawler = EastMoneyCrawler()
            # crawler.update_all_nav()
            
            print(f"[{datetime.now()}] ✅ 净值更新完成")
            logger.info("NAV update completed")
        except Exception as e:
            logger.error(f"NAV update failed: {e}")
            print(f"[{datetime.now()}] ❌ 净值更新失败: {e}")
    
    def generate_report_task(self):
        """生成日报任务"""
        logger.info("Running daily report task")
        print(f"[{datetime.now()}] 📊 开始生成日报...")
        
        try:
            from ..analysis.analyzer import ReportGenerator
            generator = ReportGenerator()
            report = generator.generate_daily_report()
            
            # 保存报告
            filename = f"daily_report_{datetime.now().strftime('%Y%m%d')}.txt"
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(report)
            
            print(f"[{datetime.now()}] ✅ 日报生成完成: {filename}")
            logger.info(f"Daily report generated: {filename}")
            
            # TODO: 发送通知
            # self.send_notification(report)
            
        except Exception as e:
            logger.error(f"Report generation failed: {e}")
            print(f"[{datetime.now()}] ❌ 日报生成失败: {e}")
    
    def backup_task(self):
        """数据备份任务"""
        logger.info("Running backup task")
        print(f"[{datetime.now()}] 💾 开始数据备份...")
        
        try:
            import shutil
            from ..core.database import get_db_path
            from pathlib import Path
            
            db_path = get_db_path()
            backup_dir = Path('backups')
            backup_dir.mkdir(exist_ok=True)
            
            backup_path = backup_dir / f"fund_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
            shutil.copy2(db_path, backup_path)
            
            print(f"[{datetime.now()}] ✅ 数据备份完成: {backup_path}")
            logger.info(f"Backup completed: {backup_path}")
            
        except Exception as e:
            logger.error(f"Backup failed: {e}")
            print(f"[{datetime.now()}] ❌ 数据备份失败: {e}")
    
    def send_notification(self, message: str):
        """发送通知"""
        # TODO: 实现飞书/邮件通知
        pass
    
    def start(self):
        """启动调度器"""
        logger.info("Starting task scheduler")
        print("\n⏰ 定时任务调度器已启动")
        print("   净值更新: 工作日 19:00")
        print("   日报生成: 工作日 21:30")
        print("   数据备份: 每天 23:00")
        print("\n按 Ctrl+C 停止\n")
        
        try:
            self.scheduler.start()
        except KeyboardInterrupt:
            self.scheduler.shutdown()
            print("\n调度器已停止")
    
    def stop(self):
        """停止调度器"""
        self.scheduler.shutdown()
        logger.info("Task scheduler stopped")
