/**
 * 飞书推送服务
 * 
 * 功能：
 * 1. 配置飞书 Webhook
 * 2. 发送文本/富文本消息
 * 3. 生成投资报告卡片
 * 4. 签名验证（可选）
 * 
 * 使用说明：
 * 1. 在飞书群中添加自定义机器人
 * 2. 复制 Webhook URL
 * 3. 在设置页面配置
 * 4. 可选择启用签名验证
 */

import { db, type FeishuConfig } from '../db';

// ============================================
// 获取/更新配置
// ============================================

export async function getFeishuConfig(): Promise<FeishuConfig | undefined> {
  return db.feishuConfig.toCollection().first();
}

export async function saveFeishuConfig(config: Omit<FeishuConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
  const existing = await db.feishuConfig.toCollection().first();
  const now = new Date().toISOString();
  
  if (existing?.id) {
    await db.feishuConfig.update(existing.id, {
      ...config,
      updatedAt: now,
    });
  } else {
    await db.feishuConfig.add({
      ...config,
      createdAt: now,
      updatedAt: now,
    } as FeishuConfig);
  }
}

// ============================================
// 签名生成（用于安全验证）
// ============================================

async function generateSignature(secret: string, timestamp: number): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${timestamp}\n${secret}`);
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, data);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// ============================================
// 发送纯文本消息
// ============================================

export async function sendTextMessage(
  webhookUrl: string, 
  text: string, 
  secret?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload: any = {
      msg_type: 'text',
      content: { text },
    };

    if (secret) {
      payload.timestamp = timestamp;
      payload.sign = await generateSignature(secret, timestamp);
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.code === 0) {
      return { success: true, message: '发送成功' };
    } else {
      return { success: false, message: result.msg || '发送失败' };
    }
  } catch (error) {
    return { 
      success: false, 
      message: error instanceof Error ? error.message : '网络错误' 
    };
  }
}

// ============================================
// 发送富文本消息（带格式）
// ============================================

export async function sendRichTextMessage(
  webhookUrl: string,
  title: string,
  content: Array<{ tag: string; text?: string; href?: string }>,
  secret?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload: any = {
      msg_type: 'post',
      content: {
        post: {
          zh_cn: {
            title,
            content: [content],
          },
        },
      },
    };

    if (secret) {
      payload.timestamp = timestamp;
      payload.sign = await generateSignature(secret, timestamp);
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.code === 0) {
      return { success: true, message: '发送成功' };
    } else {
      return { success: false, message: result.msg || '发送失败' };
    }
  } catch (error) {
    return { 
      success: false, 
      message: error instanceof Error ? error.message : '网络错误' 
    };
  }
}

// ============================================
// 发送交互式卡片（投资报告样式）
// ============================================

export interface DailyReportData {
  date: string;
  totalAssets: number;
  dailyProfit: number;
  dailyProfitRate: number;
  holdingsCount: number;
  topHoldings: Array<{
    name: string;
    profitRate: number;
  }>;
  marketSentiment: '极度恐慌' | '恐慌' | '中性' | '贪婪' | '极度贪婪';
}

export async function sendDailyReportCard(
  webhookUrl: string,
  data: DailyReportData,
  secret?: string
): Promise<{ success: boolean; message: string }> {
  const color = data.dailyProfit >= 0 ? 'red' : 'green';
  const profitEmoji = data.dailyProfit >= 0 ? '📈' : '📉';
  
  const card = {
    config: { wide_screen_mode: true },
    header: {
      template: color,
      title: {
        content: `${profitEmoji} ${data.date} 投资日报`,
        tag: 'plain_text',
      },
    },
    elements: [
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: {
              content: `**总资产**\n¥${data.totalAssets.toFixed(2)}`,
              tag: 'lark_md',
            },
          },
          {
            is_short: true,
            text: {
              content: `**今日盈亏**\n${data.dailyProfit >= 0 ? '+' : ''}¥${data.dailyProfit.toFixed(2)} (${data.dailyProfitRate >= 0 ? '+' : ''}${data.dailyProfitRate.toFixed(2)}%)`,
              tag: 'lark_md',
            },
          },
        ],
      },
      {
        tag: 'div',
        fields: [
          {
            is_short: true,
            text: {
              content: `**持仓数量**\n${data.holdingsCount} 只`,
              tag: 'lark_md',
            },
          },
          {
            is_short: true,
            text: {
              content: `**市场情绪**\n${data.marketSentiment}`,
              tag: 'lark_md',
            },
          },
        ],
      },
      { tag: 'hr' },
      {
        tag: 'div',
        text: {
          content: '**今日表现最佳**',
          tag: 'lark_md',
        },
      },
      ...data.topHoldings.slice(0, 3).map((h, i) => ({
        tag: 'div',
        text: {
          content: `${i + 1}. ${h.name}: ${h.profitRate >= 0 ? '+' : ''}${h.profitRate.toFixed(2)}%`,
          tag: 'lark_md',
        },
      })),
      { tag: 'hr' },
      {
        tag: 'note',
        elements: [
          {
            content: '数据仅供参考，投资有风险，入市需谨慎。',
            tag: 'plain_text',
          },
        ],
      },
    ],
  };

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload: any = {
      msg_type: 'interactive',
      card,
    };

    if (secret) {
      payload.timestamp = timestamp;
      payload.sign = await generateSignature(secret, timestamp);
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (result.code === 0) {
      return { success: true, message: '日报发送成功' };
    } else {
      return { success: false, message: result.msg || '发送失败' };
    }
  } catch (error) {
    return { 
      success: false, 
      message: error instanceof Error ? error.message : '网络错误' 
    };
  }
}

// ============================================
// 测试连接
// ============================================

export async function testWebhook(
  webhookUrl: string, 
  secret?: string
): Promise<{ success: boolean; message: string }> {
  return sendTextMessage(
    webhookUrl,
    '✅ MyFundSys 连接测试成功！\n\n您的投资数据将自动推送到此群。',
    secret
  );
}

// ============================================
// 预设消息模板
// ============================================

export const MESSAGE_TEMPLATES = {
  // 交易提醒
  transaction: (type: 'buy' | 'sell', fundName: string, amount: number) => ({
    title: type === 'buy' ? '💰 买入提醒' : '💸 卖出提醒',
    content: [
      { tag: 'text', text: `基金：${fundName}` },
      { tag: 'text', text: `金额：¥${amount.toFixed(2)}` },
      { tag: 'text', text: `时间：${new Date().toLocaleString('zh-CN')}` },
    ],
  }),

  // 大涨提醒
  surgeAlert: (fundName: string, changePercent: number) => ({
    title: '🚀 大涨提醒',
    content: [
      { tag: 'text', text: `${fundName} 今日涨幅 ${changePercent.toFixed(2)}%` },
      { tag: 'text', text: '达到预设的涨幅阈值，请关注。' },
    ],
  }),

  // 大跌提醒
  dropAlert: (fundName: string, changePercent: number) => ({
    title: '⚠️ 大跌提醒',
    content: [
      { tag: 'text', text: `${fundName} 今日跌幅 ${Math.abs(changePercent).toFixed(2)}%` },
      { tag: 'text', text: '达到预设的跌幅阈值，请关注。' },
    ],
  }),

  // 定投提醒
  investReminder: (fundName: string, amount: number) => ({
    title: '📅 定投提醒',
    content: [
      { tag: 'text', text: `今日是 ${fundName} 定投日` },
      { tag: 'text', text: `建议投入金额：¥${amount}` },
    ],
  }),
};

// ============================================
// 快捷发送方法
// ============================================

export async function sendTransactionNotification(
  type: 'buy' | 'sell',
  fundName: string,
  amount: number
): Promise<{ success: boolean; message: string }> {
  const config = await getFeishuConfig();
  if (!config?.enabled || !config.webhookUrl) {
    return { success: false, message: '飞书推送未配置' };
  }

  if (!config.notifyOn.transactionAdded) {
    return { success: false, message: '交易通知未启用' };
  }

  const template = MESSAGE_TEMPLATES.transaction(type, fundName, amount);
  return sendRichTextMessage(
    config.webhookUrl,
    template.title,
    template.content,
    config.secret
  );
}

export async function sendDailySummary(data: DailyReportData): Promise<{ success: boolean; message: string }> {
  const config = await getFeishuConfig();
  if (!config?.enabled || !config.webhookUrl) {
    return { success: false, message: '飞书推送未配置' };
  }

  if (!config.notifyOn.dailyReport) {
    return { success: false, message: '日报推送未启用' };
  }

  return sendDailyReportCard(config.webhookUrl, data, config.secret);
}
