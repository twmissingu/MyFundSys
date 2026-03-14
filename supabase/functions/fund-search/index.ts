/**
 * @fileoverview 基金搜索 Edge Function
 * @description 代理东方财富 API 搜索基金
 * @module functions/fund-search
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

interface FundSearchResult {
  code: string;
  name: string;
  type: string;
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
  };
}

/**
 * 处理基金搜索请求
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
    // 从 URL 获取搜索关键词
    const url = new URL(req.url);
    const keyword = url.searchParams.get('keyword');

    if (!keyword) {
      return new Response(
        JSON.stringify({ error: '搜索关键词不能为空' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 调用东方财富搜索 API
    const searchUrl = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(keyword)}&type=14&count=100`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`搜索 API 返回错误: ${response.status}`);
    }

    const result = await response.json();

    if (!result.QuotationCodeTable || !result.QuotationCodeTable.Data) {
      return new Response(JSON.stringify([]), { headers: corsHeaders });
    }

    // 过滤只保留基金
    const funds: FundSearchResult[] = result.QuotationCodeTable.Data
      .filter((item: any) => item.Code && item.Name)
      .filter((item: any) => 
        item.Classify === 'OTCFUND' || 
        item.Classify === 'FUND' || 
        item.Classify === 'Fund'
      )
      .map((item: any) => ({
        code: item.Code,
        name: item.Name,
        type: item.Classes || item.Classify || '基金',
      }));

    return new Response(JSON.stringify(funds), { headers: corsHeaders });
  } catch (error) {
    console.error('基金搜索失败:', error);
    return new Response(
      JSON.stringify({ error: '基金搜索失败', message: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
