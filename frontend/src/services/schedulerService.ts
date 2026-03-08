/**
 * 定时任务服务
 * 
 * 预留功能：自动抓取净值、生成日报、飞书推送
 * 
 * 注意：浏览器环境无法真正运行定时任务，此服务提供：
 * 1. 任务配置管理
 * 2. 手动触发执行
 * 3. 下次执行时间计算
 * 4. 执行历史记录
 * 
 * 真正的定时任务需要在后端（Python/Node.js）运行
 */

import { db, type ScheduledTask } from '../db';

// ============================================
// 任务执行历史
// ============================================

interface TaskExecution {
  id?: number;
  taskId: number;
  taskName: string;
  status: 'success' | 'failed' | 'running';
  startTime: string;
  endTime?: string;
  result?: any;
  error?: string;
}

// 在内存中存储执行历史（实际项目中可以存储到 IndexedDB）
const executionHistory: TaskExecution[] = [];

// ============================================
// 获取任务列表
// ============================================

export async function getScheduledTasks(): Promise<ScheduledTask[]> {
  return db.scheduledTasks.toArray();
}

// ============================================
// 更新任务配置
// ============================================

export async function updateTaskConfig(
  id: number, 
  updates: Partial<ScheduledTask>
): Promise<void> {
  await db.scheduledTasks.update(id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

// ============================================
// 切换任务启用状态
// ============================================

export async function toggleTask(id: number, enabled: boolean): Promise<void> {
  await db.scheduledTasks.update(id, {
    enabled,
    updatedAt: new Date().toISOString(),
  });
}

// ============================================
// 计算下次执行时间
// ============================================

export function calculateNextRunTime(schedule: string): Date | null {
  const now = new Date();
  
  // 简单的 cron 解析（仅支持基本格式）
  const parts = schedule.split(' ');
  if (parts.length !== 5) return null;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  
  const next = new Date(now);
  next.setSeconds(0, 0);

  // 处理小时和分钟
  if (minute !== '*') {
    next.setMinutes(parseInt(minute));
  }
  if (hour !== '*') {
    next.setHours(parseInt(hour));
  }

  // 如果设置的时间已过，设置为明天
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  // 处理工作日（周一到周五）
  if (dayOfWeek === '1-5') {
    while (next.getDay() === 0 || next.getDay() === 6) {
      next.setDate(next.getDate() + 1);
    }
  }

  return next;
}

// ============================================
// 手动触发任务（预留接口）
// ============================================

export async function runTaskManually(taskId: number): Promise<TaskExecution> {
  const task = await db.scheduledTasks.get(taskId);
  if (!task) {
    throw new Error('任务不存在');
  }

  const execution: TaskExecution = {
    taskId,
    taskName: task.name,
    status: 'running',
    startTime: new Date().toISOString(),
  };

  executionHistory.unshift(execution);
  if (executionHistory.length > 50) {
    executionHistory.pop();
  }

  try {
    switch (task.type) {
      case 'fetch_nav':
        await executeFetchNav(task.config);
        break;
      case 'generate_report':
        await executeGenerateReport(task.config);
        break;
      case 'feishu_notify':
        await executeFeishuNotify(task.config);
        break;
    }

    execution.status = 'success';
    execution.endTime = new Date().toISOString();
    execution.result = { message: '任务执行成功' };

    // 更新任务的最后执行时间
    await db.scheduledTasks.update(taskId, {
      lastRunAt: execution.startTime,
      nextRunAt: calculateNextRunTime(task.schedule)?.toISOString(),
    });

  } catch (error) {
    execution.status = 'failed';
    execution.endTime = new Date().toISOString();
    execution.error = error instanceof Error ? error.message : '未知错误';
  }

  return execution;
}

// ============================================
// 获取执行历史
// ============================================

export function getExecutionHistory(taskId?: number): TaskExecution[] {
  if (taskId) {
    return executionHistory.filter(e => e.taskId === taskId);
  }
  return executionHistory;
}

// ============================================
// 具体任务执行逻辑（预留实现）
// ============================================

/**
 * 执行净值抓取
 * 
 * 实际实现需要：
 * 1. 调用基金数据 API（天天基金、雪球等）
 * 2. 解析返回数据
 * 3. 更新本地数据库
 * 4. 同步到云端
 */
async function executeFetchNav(config: any): Promise<void> {
  console.log('[Scheduler] 开始抓取净值...', config);
  
  // 模拟 API 调用
  await simulateDelay(2000);
  
  // TODO: 实现真实的净值抓取逻辑
  // 示例代码：
  // const funds = await db.funds.toArray();
  // for (const fund of funds) {
  //   const nav = await fetchFundNav(fund.code, config.sources);
  //   await db.funds.update(fund.id, { nav, navDate: new Date().toISOString() });
  // }
  
  console.log('[Scheduler] 净值抓取完成');
}

/**
 * 生成日报
 * 
 * 实际实现需要：
 * 1. 获取当前持仓
 * 2. 计算今日收益
 * 3. 生成估值分析
 * 4. 生成投资建议
 * 5. 保存或发送报告
 */
async function executeGenerateReport(config: any): Promise<void> {
  console.log('[Scheduler] 开始生成日报...', config);
  
  await simulateDelay(1500);
  
  // TODO: 实现真实的报告生成逻辑
  
  console.log('[Scheduler] 日报生成完成');
}

/**
 * 飞书推送
 * 
 * 实际实现需要：
 * 1. 获取飞书配置
 * 2. 生成推送内容
 * 3. 调用飞书 Webhook API
 */
async function executeFeishuNotify(config: any): Promise<void> {
  console.log('[Scheduler] 开始飞书推送...', config);
  
  await simulateDelay(1000);
  
  // TODO: 实现真实的飞书推送逻辑
  // 调用 feishuService.sendMessage(...)
  
  console.log('[Scheduler] 飞书推送完成');
}

// ============================================
// 工具函数
// ============================================

function simulateDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// 启动定时检查（浏览器环境模拟）
// ============================================

let checkInterval: number | null = null;

export function startSchedulerCheck(): void {
  if (checkInterval) return;

  // 每分钟检查一次是否有任务需要执行
  checkInterval = window.setInterval(async () => {
    const now = new Date();
    const tasks = await db.scheduledTasks.where('enabled').equals(1).toArray();

    for (const task of tasks) {
      const nextRun = calculateNextRunTime(task.schedule);
      if (nextRun && Math.abs(nextRun.getTime() - now.getTime()) < 60000) {
        // 任务应该执行
        console.log(`[Scheduler] 任务 "${task.name}" 触发执行`);
        // 注意：实际生产环境不应该在前端自动执行任务
        // 这里仅作演示，建议手动触发或使用后端的定时任务
      }
    }
  }, 60000);
}

export function stopSchedulerCheck(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

// ============================================
// 预设的定时规则
// ============================================

export const PRESET_SCHEDULES = [
  { label: '每小时', value: '0 * * * *' },
  { label: '每天 9:00', value: '0 9 * * *' },
  { label: '每天 15:00', value: '0 15 * * *' },
  { label: '每天 18:00（收盘后）', value: '0 18 * * *' },
  { label: '每天 21:00', value: '0 21 * * *' },
  { label: '工作日 18:00', value: '0 18 * * 1-5' },
  { label: '每周一 9:00', value: '0 9 * * 1' },
  { label: '每月 1 日 9:00', value: '0 9 1 * *' },
];
