/**
 * @fileoverview 基金历史净值查询 Edge Function
 * @description 代理东方财富 API 获取基金历史净值数据，解决前端 CORS 限制
 * @module functions/fund-history
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

interface FundHistoryRecord {
  date: string;         // 净值日期
  nav: number;          // 单位净值
  accNav: number;       // 累计净值
  dailyChangeRate: number; // 日涨跌幅(%)
  buyStatus: string;    // 申购状态
  sellStatus: string;   // 赎回状态
}

/**
 * 获取 CORS 头
 */
function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '*';

  const allowedOrigins = [
    'https://twmissingu.github.io',
    'http://localhost:3000',
    'http://localhost:5173',
  ];

  const allowOrigin = allowedOrigins.includes(origin) ? origin : '*';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
  };
}

/**
 * 处理基金历史净值查询请求
 */
serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // 从 POST body 获取参数（supabase.functions.invoke 使用 POST 传参）
    const body = await req.json().catch(() => ({}));
    const code = body.code;
    const pageIndex = body.pageIndex ?? 1;
    const pageSize = body.pageSize ?? 20;
    const startDate = body.startDate ?? '';

    if (!code) {
      return new Response(
        JSON.stringify({ error: '基金代码不能为空' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 调用东方财富历史净值 API
    const historyUrl = `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${code}&pageIndex=${pageIndex}&pageSize=${pageSize}&startDate=${startDate}&endDate=&_=${Date.now()}`;

    const response = await fetch(historyUrl, {
      headers: {
        'User-Agent': 'EMProjJijin/8.4.6 (iPhone; iOS 16.0; Scale/3.00)',
        'Accept': 'application/json',
        'Referer': 'https://fund.eastmoney.com/',
      },
    });

    if (!response.ok) {
      throw new Error(`东方财富 API 返回错误: ${response.status}`);
    }

    const result = await response.json();

    if (!result.Data || !result.Data.LSJZList) {
      return new Response(JSON.stringify([]), { headers: corsHeaders });
    }

    const records: FundHistoryRecord[] = result.Data.LSJZList
      .filter((item: any) => item.FSRQ && item.DWJZ)
      .map((item: any) => ({
        date: item.FSRQ,
        nav: parseFloat(item.DWJZ),
        accNav: parseFloat(item.LJJZ || '0'),
        dailyChangeRate: parseFloat(item.JZZZL || '0'),
        buyStatus: item.SGZT || '-',
        sellStatus: item.SHZT || '-',
      }));

    return new Response(JSON.stringify(records), { headers: corsHeaders });
  } catch (error) {
    console.error('获取历史净值失败:', error);
    return new Response(
      JSON.stringify({ error: '获取历史净值失败', message: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
