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
 * 处理基金净值查询请求
 */
serve(async (req: Request) => {
  // CORS 头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 从 URL 获取基金代码
    const url = new URL(req.url);
    const code = url.pathname.split('/').pop();

    if (!code) {
      return new Response(
        JSON.stringify({ error: '基金代码不能为空' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 调用东方财富 API
    const eastMoneyUrl = `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo?pageIndex=1&pageSize=500&appType=ttjj&plat=Android&product=EFund&Version=1&deviceid=4252d0ac69bb50&Fcodes=${code}`;

    const response = await fetch(eastMoneyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
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
