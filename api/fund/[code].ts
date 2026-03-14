/**
 * @fileoverview 基金净值查询 API
 * @description 代理东方财富API获取基金实时净值
 * @module api/fund/[code]
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * 处理基金净值查询请求
 * @param req - Vercel请求对象
 * @param res - Vercel响应对象
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 设置CORS头，允许前端访问
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 只支持GET请求
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Fund code is required' });
  }

  try {
    // 调用东方财富API
    const url = `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo?pageIndex=1&pageSize=500&appType=ttjj&plat=Android&product=EFund&Version=1&deviceid=vercel-edge&Fcodes=${code}`;
    
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

    // 解析数据
    if (data.ErrCode !== 0 || !data.Datas || data.Datas.length === 0) {
      return res.status(404).json({ error: 'Fund not found' });
    }

    const fund = data.Datas[0];
    
    const result = {
      code: code,
      name: fund.SHORTNAME,
      nav: parseFloat(fund.NAV),
      navDate: fund.NAVDATE || fund.PDATE,
      dailyChangeRate: parseFloat(fund.NAVCHGRT || '0'),
      accNav: fund.ACCNAV ? parseFloat(fund.ACCNAV) : null,
      updatedAt: new Date().toISOString(),
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error('[API Error]', error);
    return res.status(500).json({ 
      error: 'Failed to fetch fund data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
