import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mock Supabase（vi.hoisted 确保在模块加载前初始化）----
const mockInvoke = vi.hoisted(() => vi.fn());

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: {
    functions: { invoke: mockInvoke },
  },
}));

import { searchByCode, searchByName, fetchFundNav, fetchFundHistory, clearNavCache } from '../../services/fundApi';
import { db } from '../../db';

// 每个测试前重置 mock 队列 + 清除内存缓存 + 清除 IndexedDB 缓存
beforeEach(async () => {
  mockInvoke.mockReset();
  clearNavCache();
  await db.fundCache.clear();
});

describe('searchByCode', () => {
  it('关键词长度不足2位时返回空数组', async () => {
    expect(await searchByCode('')).toEqual([]);
    expect(await searchByCode('0')).toEqual([]);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('Supabase 返回结果时正确过滤代码前缀', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: [
        { code: '000001', name: '华夏成长', type: '混合型' },
        { code: '100001', name: '富国天惠', type: '混合型' }, // 不匹配前缀 "000"
      ],
      error: null,
    });

    const results = await searchByCode('000');
    expect(results.every(r => r.code.startsWith('000'))).toBe(true);
    expect(results.find(r => r.code === '100001')).toBeUndefined();
  });

  it('Supabase 报错时返回空数组', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('Network error') });
    const results = await searchByCode('000');
    expect(results).toEqual([]);
  });
});

describe('searchByName', () => {
  it('关键词少于2个字时返回空数组', async () => {
    expect(await searchByName('')).toEqual([]);
    expect(await searchByName('华')).toEqual([]);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('Supabase 返回结果时正确过滤名称包含关键词', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: [
        { code: '000001', name: '华夏成长混合', type: '混合型' },
        { code: '000002', name: '易方达蓝筹', type: '混合型' }, // 不包含 "华夏"
      ],
      error: null,
    });

    const results = await searchByName('华夏');
    expect(results.every(r => r.name.includes('华夏'))).toBe(true);
    expect(results.find(r => r.code === '000002')).toBeUndefined();
  });
});

describe('fetchFundNav', () => {
  it('Supabase 成功返回数据时正确映射字段', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        code: '000001',
        name: '华夏成长混合',
        nav: 1.5,
        navDate: '2024-01-15',
        estimateNav: 1.52,
        estimateRate: 1.33,
      },
      error: null,
    });

    const result = await fetchFundNav('000001');
    expect(result).not.toBeNull();
    expect(result!.code).toBe('000001');
    expect(result!.name).toBe('华夏成长混合');
    expect(result!.nav).toBe(1.5);
    expect(result!.navDate).toBe('2024-01-15');
    expect(result!.dailyChangeRate).toBe(1.33);
  });

  it('缓存命中时不重复调用 Supabase', async () => {
    mockInvoke.mockResolvedValue({
      data: { code: '000001', name: '测试基金', nav: 1.0, navDate: '2024-01-01', estimateRate: 0 },
      error: null,
    });

    await fetchFundNav('000001');
    await fetchFundNav('000001'); // 第二次命中内存缓存

    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('Supabase 返回 error 时返回 null', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('Timeout') });
    const result = await fetchFundNav('999999');
    expect(result).toBeNull();
  });
});

describe('fetchFundHistory', () => {
  it('Supabase 可用时调用 fund-history Edge Function', async () => {
    const mockRecord = {
      date: '2024-01-15',
      nav: 1.5,
      accNav: 2.0,
      dailyChangeRate: 0.5,
      buyStatus: '开放',
      sellStatus: '开放',
    };
    mockInvoke.mockResolvedValueOnce({ data: [mockRecord], error: null });

    const result = await fetchFundHistory('000001', 5, 1, '');

    expect(mockInvoke).toHaveBeenCalledWith('fund-history', {
      body: { code: '000001', pageSize: 5, pageIndex: 1, startDate: '' },
    });
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-01-15');
    expect(result[0].nav).toBe(1.5);
  });

  it('Supabase error 时降级（返回空数组）', async () => {
    // 模拟 Supabase 失败，降级直接调用也会因 CORS 失败
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('Edge Function error') });

    const result = await fetchFundHistory('000001');
    expect(Array.isArray(result)).toBe(true);
  });
});
