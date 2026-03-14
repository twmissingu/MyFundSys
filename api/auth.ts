/**
 * @fileoverview 认证 API
 * @description 简单的密码验证，保持与现有做法一致
 * @module api/auth
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * 处理认证请求
 * @param req - Vercel请求对象
 * @param res - Vercel响应对象
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // 验证密码
    const correctPassword = process.env.APP_PASSWORD;
    
    if (!correctPassword) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (password === correctPassword) {
      return res.status(200).json({ 
        success: true,
        message: 'Authentication successful'
      });
    } else {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid password'
      });
    }
  } catch (error) {
    console.error('[Auth Error]', error);
    return res.status(500).json({ 
      error: 'Authentication failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
