/**
 * 定时任务服务（预留功能，浏览器环境无法真正运行）
 * 使用内存存储，不依赖 IndexedDB
 */

import type { ScheduledTask } from '../db';

interface TaskExecution {
  taskId: number;
  taskName: string;
  status: 'success' | 'failed' | 'running';
  startTime: string;
  endTime?: string;
  result?: any;
  error?: string;
}

const executionHistory: TaskExecution[] = [];

const defaultTasks: ScheduledTask[] = [
  {
    id: 1,
    name: '自动抓取净值',
    type: 'fetch_nav',
    enabled: false,
    schedule: '0 18 * * 1-5',
    config: { sources: ['tiantian', 'xueqiu'], retryCount: 3 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: '生成日报',
    type: 'generate_report',
    enabled: false,
    schedule: '0 19 * * 1-5',
    config: { includeHoldings: true, includeValuation: true, includeSuggestions: true },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 3,
    name: '飞书推送',
    type: 'feishu_notify',
    enabled: false,
    schedule: '0 19 * * 1-5',
    config: { sendDaily: true, sendWeekly: true, sendOnLargeFluctuation: true, fluctuationThreshold: 3 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let tasks = [...defaultTasks];

export async function getScheduledTasks(): Promise<ScheduledTask[]> {
  return tasks;
}

export async function updateTaskConfig(id: number, updates: Partial<ScheduledTask>): Promise<void> {
  tasks = tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t);
}

export async function toggleTask(id: number, enabled: boolean): Promise<void> {
  await updateTaskConfig(id, { enabled });
}

export function calculateNextRunTime(schedule: string): Date | null {
  const now = new Date();
  const parts = schedule.split(' ');
  if (parts.length !== 5) return null;

  const [minute, hour, , , dayOfWeek] = parts;
  const next = new Date(now);
  next.setSeconds(0, 0);

  if (minute !== '*') next.setMinutes(parseInt(minute));
  if (hour !== '*') next.setHours(parseInt(hour));

  if (next <= now) next.setDate(next.getDate() + 1);

  if (dayOfWeek === '1-5') {
    while (next.getDay() === 0 || next.getDay() === 6) {
      next.setDate(next.getDate() + 1);
    }
  }

  return next;
}

export async function runTaskManually(taskId: number): Promise<TaskExecution> {
  const task = tasks.find(t => t.id === taskId);
  if (!task) throw new Error('任务不存在');

  const execution: TaskExecution = {
    taskId,
    taskName: task.name,
    status: 'running',
    startTime: new Date().toISOString(),
  };

  executionHistory.unshift(execution);
  if (executionHistory.length > 50) executionHistory.pop();

  try {
    await new Promise(resolve => setTimeout(resolve, 1000));
    execution.status = 'success';
    execution.endTime = new Date().toISOString();
    execution.result = { message: '任务执行成功（模拟）' };
    await updateTaskConfig(taskId, {
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

export function getExecutionHistory(taskId?: number): TaskExecution[] {
  if (taskId) return executionHistory.filter(e => e.taskId === taskId);
  return executionHistory;
}

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
