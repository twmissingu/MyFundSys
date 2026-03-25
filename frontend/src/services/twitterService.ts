import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Tweet } from '../types';

export interface TwitterResponse {
  data: Tweet[];
  error?: string;
}

/**
 * 获取 AI 相关博主的最新推文
 */
export async function fetchAITweets(): Promise<TwitterResponse> {
  try {
    // 优先使用 Supabase Edge Function
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.functions.invoke('twitter-posts');
      if (error) throw error;
      return { data: data.data || [] };
    }

    // 如果 Supabase 未配置，返回空数据
    return { data: [] };

  } catch (error) {
    console.error('获取推文失败:', error);
    return { data: [], error: 'Failed to fetch tweets' };
  }
}