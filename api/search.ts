/**
 * @fileoverview 基金搜索 API
 * @description 代理东方财富搜索API
 * @module api/search
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * 处理基金搜索请求
 * @param req - Vercel请求对象
 * @param res - Vercel响应对象
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { keyword } = req.query;

  if (!keyword || typeof keyword !== 'string') {
    return res.status(400).json({ error: 'Keyword is required' });
  }

  try {
    // 调用东方财富搜索API
    const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(keyword)}&type=14&count=100`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();

    // 解析搜索结果，只保留基金
    if (data.QuotationCodeTable && data.QuotationCodeTable.Data) {
      const funds = data.QuotationCodeTable.Data
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

      return res.status(200).json(funds);
    }

    return res.status(200).json([]);
  } catch (error) {
    console.error('[API Error]', error);
    return res.status(500).json({ 
      error: 'Failed to search funds',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
