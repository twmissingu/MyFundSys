/**
 * @fileoverview 基金净值查询 Edge Function
 * @description 代理东方财富 API 获取基金实时净值
 * @module functions/fund-nav
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

interface FundNavResponse {
  code: string;
  name: string;
  nav: number;
  navDate: string;
  estimateNav?: number;
  estimateRate?: number;
}

/**
 * 获取 CORS 头
 */
function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '*';
  
  // 允许的域名列表
  const allowedOrigins = [
    'https://twmissingu.github.io',
    'http://localhost:3000',
    'http://localhost:5173',
  ];
  
  // 检查请求的 origin 是否在允许列表中
  const allowOrigin = allowedOrigins.includes(origin) ? origin : '*';
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
  };
}

/**
 * 处理基金净值查询请求
 */
serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    // 从 POST body 获取基金代码（supabase.functions.invoke 使用 POST 传参）
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const code = body.code || url.searchParams.get('code') || url.pathname.split('/').pop();

    if (!code || code === 'fund-nav') {
      return new Response(
        JSON.stringify({ error: '基金代码不能为空' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 调用东方财富 API
    const eastMoneyUrl = `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo?pageIndex=1&pageSize=500&appType=ttjj&plat=Android&product=EFund&Version=1&deviceid=4252d0ac69bb50&Fcodes=${code}`;

    const response = await fetch(eastMoneyUrl, {
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

    if (!result.Datas || result.Datas.length === 0) {
      return new Response(
        JSON.stringify({ error: '未找到基金数据' }),
        { status: 404, headers: corsHeaders }
      );
    }

    const fundData = result.Datas[0];

    const data: FundNavResponse = {
      code: fundData.FCODE,
      name: fundData.SHORTNAME,
      nav: parseFloat(fundData.NAV),
      navDate: fundData.PDATE,
      estimateNav: fundData.GSZ ? parseFloat(fundData.GSZ) : undefined,
      estimateRate: fundData.GSZZL ? parseFloat(fundData.GSZZL) : undefined,
    };

    return new Response(JSON.stringify(data), {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('获取基金净值失败:', error);
    return new Response(
      JSON.stringify({ error: '获取基金净值失败', message: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
