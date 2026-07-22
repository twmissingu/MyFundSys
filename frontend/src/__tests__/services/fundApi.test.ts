import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// ---- Mock Supabase（vi.hoisted 确保在模块加载前初始化）----
const mockInvoke = vi.hoisted(() => vi.fn());
const mockIsSupabaseConfigured = vi.hoisted(() => vi.fn(() => true));

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: mockIsSupabaseConfigured,
  supabase: {
    functions: { invoke: mockInvoke },
  },
}));

import {
  searchByCode,
  searchByName,
  searchFunds,
  fetchFundNav,
  fetchFundHistory,
  fetchMarketValuation,
  batchFetchNav,
  fetchMultipleFundsNav,
  batchRefreshFunds,
  getFundHistoryWithCache,
  batchGetFundHistory,
  clearNavCache,
} from '../../services/fundApi';

// 每个测试前重置 mock 队列 + 清除内存缓存
beforeEach(() => {
  mockInvoke.mockReset();
  mockIsSupabaseConfigured.mockReset();
  mockIsSupabaseConfigured.mockReturnValue(true);
  clearNavCache();
});

// ============================================
// searchByCode / searchByName（已有 + 补充）
// ============================================

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
        { code: '100001', name: '富国天惠', type: '混合型' },
      ],
      error: null,
    });

    const results = await searchByCode('000');
    expect(results.every(r => r.code.startsWith('000'))).toBe(true);
    expect(results.find(r => r.code === '100001')).toBeUndefined();
  });

  it('Supabase 报错时抛出错误（修复 #17：不再返回空数组掩盖）', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('Network error') });
    await expect(searchByCode('000')).rejects.toThrow();
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
        { code: '000002', name: '易方达蓝筹', type: '混合型' },
      ],
      error: null,
    });

    const results = await searchByName('华夏');
    expect(results.every(r => r.name.includes('华夏'))).toBe(true);
    expect(results.find(r => r.code === '000002')).toBeUndefined();
  });
});

// ============================================
// searchFunds（新增）
// ============================================

describe('searchFunds', () => {
  it('空关键词或 trim 后长度不足2时返回空数组', async () => {
    expect(await searchFunds('')).toEqual([]);
    expect(await searchFunds('  ')).toEqual([]);
    expect(await searchFunds('a')).toEqual([]);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('mode=code 时按代码前缀过滤', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: [
        { code: '000001', name: 'A', type: '混合型' },
        { code: '000002', name: 'B', type: '混合型' },
        { code: '100001', name: 'C', type: '混合型' },
      ],
      error: null,
    });

    const results = await searchFunds('000', 'code');
    expect(results).toHaveLength(2);
    expect(results.every(r => r.code.startsWith('000'))).toBe(true);
  });

  it('mode=name 时按名称包含过滤', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: [
        { code: '000001', name: '华夏成长', type: '混合型' },
        { code: '000002', name: '易方达蓝筹', type: '混合型' },
      ],
      error: null,
    });

    const results = await searchFunds('华夏', 'name');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('华夏成长');
  });

  it('auto 模式下纯数字按代码搜索', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: [
        { code: '000001', name: 'A', type: '混合型' },
        { code: '000002', name: 'B', type: '混合型' },
      ],
      error: null,
    });

    const results = await searchFunds('000');
    expect(results.every(r => r.code.startsWith('000'))).toBe(true);
  });

  it('auto 模式下非纯数字按名称搜索', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: [
        { code: '000001', name: '华夏成长', type: '混合型' },
        { code: '000002', name: '易方达蓝筹', type: '混合型' },
      ],
      error: null,
    });

    const results = await searchFunds('华夏');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('华夏成长');
  });

  it('关键词带前后空格时正确 trim 后搜索', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: [{ code: '000001', name: '华夏成长', type: '混合型' }],
      error: null,
    });

    const results = await searchFunds('  华夏  ', 'name');
    expect(results).toHaveLength(1);
    expect(mockInvoke).toHaveBeenCalledWith('fund-search', { body: { keyword: '华夏' } });
  });

  it('API 失败时抛出错误（修复 #17：不再返回空数组掩盖）', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('API error'));
    await expect(searchFunds('test', 'name')).rejects.toThrow('API error');
  });

  it('Supabase 未配置时抛出错误', async () => {
    mockIsSupabaseConfigured.mockReturnValueOnce(false);
    await expect(searchFunds('test', 'name')).rejects.toThrow('Supabase 未配置');
  });

  it('fund-search 返回非数组时返回空数组', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { notArray: true }, error: null });
    const results = await searchFunds('test', 'name');
    expect(results).toEqual([]);
  });
});

// ============================================
// fetchFundNav（已有 + 补充）
// ============================================

describe('fetchFundNav', () => {
  it('Supabase 成功返回数据（有估算）时正确映射字段', async () => {
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
    expect(result!.dailyChange).toBeCloseTo(0.02, 4);
  });

  it('有估算数据时缓存命中不重复调用 Supabase', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        code: '000001',
        name: '测试基金',
        nav: 1.0,
        navDate: '2024-01-01',
        estimateNav: 1.01,
        estimateRate: 1.0,
      },
      error: null,
    });

    await fetchFundNav('000001');
    await fetchFundNav('000001');

    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('无估算数据时返回0涨跌幅（不再额外调用历史API）', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        code: '000001',
        name: '测试基金',
        nav: 1.5,
        navDate: '2024-01-15',
      },
      error: null,
    });

    clearNavCache();

    const result = await fetchFundNav('000001');

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'fund-nav', { body: { code: '000001' } });

    expect(result).not.toBeNull();
    expect(result!.dailyChangeRate).toBe(0);
    expect(result!.dailyChange).toBe(0);
  });

  it('Supabase 返回 error 时返回 null', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('Timeout') });
    const result = await fetchFundNav('999999');
    expect(result).toBeNull();
  });

  it('估算数据 estimateRate 为 0 时正确处理', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        code: '000001',
        name: '测试基金',
        nav: 1.0,
        navDate: '2024-01-01',
        estimateNav: 1.0,
        estimateRate: 0,
      },
      error: null,
    });

    const result = await fetchFundNav('000001');
    expect(result).not.toBeNull();
    expect(result!.dailyChange).toBe(0);
    expect(result!.dailyChangeRate).toBe(0);
  });

  it('无估算数据且无历史数据时返回涨跌幅0', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { code: '000001', name: '测试', nav: 1.0, navDate: '2024-01-01' },
      error: null,
    });
    clearNavCache();

    const result = await fetchFundNav('000001');
    expect(result).not.toBeNull();
    expect(result!.dailyChange).toBe(0);
    expect(result!.dailyChangeRate).toBe(0);
  });

  it('缓存过期后重新调用 Supabase', async () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    mockInvoke.mockResolvedValue({
      data: {
        code: '000001',
        name: '测试基金',
        nav: 1.0,
        navDate: '2024-01-01',
        estimateNav: 1.01,
        estimateRate: 1.0,
      },
      error: null,
    });

    await fetchFundNav('000001');
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    vi.setSystemTime(now + 6 * 60 * 1000);

    await fetchFundNav('000001');
    expect(mockInvoke).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('无估算数据且历史净值返回空时返回零涨跌幅', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: {
        code: '000001',
        name: '测试基金',
        nav: 1.0,
        navDate: '2024-01-01',
      },
      error: null,
    });

    mockInvoke.mockResolvedValueOnce({ data: [], error: null });

    const result = await fetchFundNav('000001');
    expect(result).not.toBeNull();
    expect(result!.dailyChange).toBe(0);
    expect(result!.dailyChangeRate).toBe(0);
  });

  it('Supabase 未配置时返回 null', async () => {
    mockIsSupabaseConfigured.mockReturnValueOnce(false);
    const result = await fetchFundNav('000001');
    expect(result).toBeNull();
  });

  it('Edge Function 返回 null data 时返回 null', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: null });
    const result = await fetchFundNav('000001');
    expect(result).toBeNull();
  });

  it('invoke 抛异常时返回 null', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Internal error'));
    const result = await fetchFundNav('000001');
    expect(result).toBeNull();
  });
});

// ============================================
// fetchMarketValuation（新增）
// ============================================

describe('fetchMarketValuation', () => {
  const mockFetch = vi.fn();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mockFetch.mockReset();
    globalThis.fetch = mockFetch as any;
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('缓存命中时直接返回缓存数据', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ pe: 15, pb: 1.5, percentile: 0.5, temperature: 50, source: 'json' }),
    });

    const first = await fetchMarketValuation();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const second = await fetchMarketValuation();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('缓存过期后重新获取', async () => {
    vi.useFakeTimers();
    const now = Date.now();
    vi.setSystemTime(now);

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ pe: 15, pb: 1.5, source: 'json' }),
    });

    await fetchMarketValuation();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    vi.setSystemTime(now + 6 * 60 * 1000);

    await fetchMarketValuation();
    expect(mockFetch).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('缓存未命中时获取本地 JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ pe: 15, pb: 1.5, percentile: 0.5, temperature: 50, source: 'json' }),
    });

    const result = await fetchMarketValuation();
    expect(result.pe).toBe(15);
    expect(result.pb).toBe(1.5);
    expect(result.source).toBe('json');
    expect(result.date).toBeDefined();
  });

  it('fetch 返回非 ok 时抛出错误', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(fetchMarketValuation()).rejects.toThrow('市场估值数据获取失败');
  });

  it('fetch 返回数据不完整时抛出错误', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ pe: null }),
    });

    await expect(fetchMarketValuation()).rejects.toThrow('市场估值数据获取失败');
  });

  it('fetch 抛异常时抛出错误', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network'));

    await expect(fetchMarketValuation()).rejects.toThrow('市场估值数据获取失败');
  });
});

// ============================================
// batchFetchNav（新增）
// ============================================

describe('batchFetchNav', () => {
  it('空数组返回空 Map', async () => {
    const result = await batchFetchNav([]);
    expect(result.size).toBe(0);
  });

  it('单批次正常获取', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        code: '000001',
        name: 'Test',
        nav: 1.5,
        navDate: '2024-01-01',
        estimateNav: 1.51,
        estimateRate: 0.67,
      },
      error: null,
    });

    const result = await batchFetchNav(['000001']);
    expect(result.size).toBe(1);
    expect(result.get('000001')).toEqual({ nav: 1.5, navDate: '2024-01-01', name: 'Test' });
  });

  it('多批次之间有 100ms 间隔', async () => {
    vi.useFakeTimers();

    mockInvoke.mockResolvedValue({
      data: {
        code: 'x',
        name: 'Test',
        nav: 1,
        navDate: '2024-01-01',
        estimateNav: 1.01,
        estimateRate: 1,
      },
      error: null,
    });

    const promise = batchFetchNav(['1', '2', '3', '4', '5', '6']);
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(result.size).toBe(6);
    vi.useRealTimers();
  });

  it('部分失败时只返回成功的', async () => {
    mockInvoke.mockImplementation((_fnName, { body }: { body: { code: string } }) => {
      if (body.code === 'fail') {
        return Promise.resolve({ data: null, error: new Error('fail') });
      }
      return Promise.resolve({
        data: {
          code: body.code,
          name: 'Test',
          nav: 1,
          navDate: '2024-01-01',
          estimateNav: 1.01,
          estimateRate: 1,
        },
        error: null,
      });
    });

    const result = await batchFetchNav(['ok1', 'fail', 'ok2']);
    expect(result.size).toBe(2);
    expect(result.has('ok1')).toBe(true);
    expect(result.has('fail')).toBe(false);
    expect(result.has('ok2')).toBe(true);
  });

  it('nav <= 0 时不加入结果', async () => {
    mockInvoke.mockResolvedValue({
      data: { code: '000001', name: 'Test', nav: 0, navDate: '2024-01-01' },
      error: null,
    });

    const result = await batchFetchNav(['000001']);
    expect(result.size).toBe(0);
  });
});

// ============================================
// fetchMultipleFundsNav（新增）
// ============================================

describe('fetchMultipleFundsNav', () => {
  it('空数组返回空数组', async () => {
    const result = await fetchMultipleFundsNav([]);
    expect(result).toEqual([]);
  });

  it('单批次正常获取', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        code: '000001',
        name: 'Test',
        nav: 1.5,
        navDate: '2024-01-01',
        estimateNav: 1.51,
        estimateRate: 0.67,
      },
      error: null,
    });

    const result = await fetchMultipleFundsNav(['000001']);
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('000001');
  });

  it('多批次之间有 100ms 间隔', async () => {
    vi.useFakeTimers();

    mockInvoke.mockResolvedValue({
      data: {
        code: 'x',
        name: 'Test',
        nav: 1,
        navDate: '2024-01-01',
        estimateNav: 1.01,
        estimateRate: 1,
      },
      error: null,
    });

    const promise = fetchMultipleFundsNav(['1', '2', '3', '4', '5', '6']);
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(result).toHaveLength(6);
    vi.useRealTimers();
  });

  it('部分失败时只返回成功的', async () => {
    mockInvoke.mockImplementation((_fnName, { body }: { body: { code: string } }) => {
      if (body.code === 'fail') {
        return Promise.resolve({ data: null, error: new Error('fail') });
      }
      return Promise.resolve({
        data: {
          code: body.code,
          name: 'Test',
          nav: 1,
          navDate: '2024-01-01',
          estimateNav: 1.01,
          estimateRate: 1,
        },
        error: null,
      });
    });

    const result = await fetchMultipleFundsNav(['ok', 'fail']);
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('ok');
  });
});

// ============================================
// batchRefreshFunds（新增）
// ============================================

describe('batchRefreshFunds', () => {
  it('全部成功', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        code: 'x',
        name: 'Test',
        nav: 1,
        navDate: '2024-01-01',
        estimateNav: 1.01,
        estimateRate: 1,
      },
      error: null,
    });

    const result = await batchRefreshFunds(['000001', '000002']);
    expect(result.success).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
  });

  it('部分成功部分失败', async () => {
    mockInvoke.mockImplementation((_fnName, { body }: { body: { code: string } }) => {
      if (body.code === 'fail') {
        return Promise.resolve({ data: null, error: new Error('fail') });
      }
      return Promise.resolve({
        data: {
          code: body.code,
          name: 'Test',
          nav: 1,
          navDate: '2024-01-01',
          estimateNav: 1.01,
          estimateRate: 1,
        },
        error: null,
      });
    });

    const result = await batchRefreshFunds(['ok', 'fail']);
    expect(result.success).toEqual(['ok']);
    expect(result.failed).toEqual(['fail']);
  });

  it('多批次之间有 500ms 间隔', async () => {
    vi.useFakeTimers();

    mockInvoke.mockResolvedValue({
      data: {
        code: 'x',
        name: 'Test',
        nav: 1,
        navDate: '2024-01-01',
        estimateNav: 1.01,
        estimateRate: 1,
      },
      error: null,
    });

    const promise = batchRefreshFunds(['1', '2', '3', '4', '5', '6']);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result.success).toHaveLength(6);
    vi.useRealTimers();
  });
});

// ============================================
// fetchFundHistory（已有 + 补充）
// ============================================

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
      body: { code: '000001', pageSize: 5, pageIndex: 1, startDate: '', endDate: '' },
    });
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-01-15');
    expect(result[0].nav).toBe(1.5);
  });

  it('Supabase error 时抛出错误（修复 #13：不再降级返回空数组）', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('Edge Function error') });

    await expect(fetchFundHistory('000001')).rejects.toThrow('获取历史净值失败');
  });

  it('自定义参数传递正确', async () => {
    mockInvoke.mockResolvedValueOnce({ data: [], error: null });
    await fetchFundHistory('000001', 50, 2, '2024-01-01', '2024-12-31');
    expect(mockInvoke).toHaveBeenCalledWith('fund-history', {
      body: { code: '000001', pageSize: 50, pageIndex: 2, startDate: '2024-01-01', endDate: '2024-12-31' },
    });
  });

  it('Supabase 未配置时抛出错误', async () => {
    mockIsSupabaseConfigured.mockReturnValueOnce(false);
    await expect(fetchFundHistory('000001')).rejects.toThrow('Supabase 未配置');
  });

  it('invoke 抛异常时传播错误（修复 #13）', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('fail'));
    await expect(fetchFundHistory('000001')).rejects.toThrow('fail');
  });

  it('fund-history 返回 null data 时返回空数组', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: null });
    const result = await fetchFundHistory('000001');
    expect(result).toEqual([]);
  });
});

// ============================================
// getFundHistoryWithCache / batchGetFundHistory（新增）
// ============================================

describe('getFundHistoryWithCache', () => {
  it('缓存命中时直接返回', async () => {
    mockInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'fund-history') {
        return Promise.resolve({
          data: [
            {
              date: '2024-01-01',
              nav: 1,
              accNav: 1,
              dailyChangeRate: 0,
              buyStatus: '开放',
              sellStatus: '开放',
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const first = await getFundHistoryWithCache('000001', 1);
    expect(mockInvoke).toHaveBeenCalled();

    const callCount = mockInvoke.mock.calls.length;
    const second = await getFundHistoryWithCache('000001', 1);
    expect(mockInvoke.mock.calls.length).toBe(callCount);
    expect(second).toEqual(first);
  });

  it('缓存未命中时从 API 获取', async () => {
    mockInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'fund-history') {
        return Promise.resolve({
          data: [
            {
              date: '2024-01-01',
              nav: 1,
              accNav: 1,
              dailyChangeRate: 0,
              buyStatus: '开放',
              sellStatus: '开放',
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const result = await getFundHistoryWithCache('000001', 1);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-01-01');
  });

  it('fetchFundHistoryBatch 分页、去重和排序', async () => {
    let callCount = 0;
    mockInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'fund-history') {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            data: Array.from({ length: 20 }, (_, i) => ({
              date: `2024-01-${String(i + 1).padStart(2, '0')}`,
              nav: 1.0,
              accNav: 1.0,
              dailyChangeRate: 0,
              buyStatus: '开放',
              sellStatus: '开放',
            })),
            error: null,
          });
        } else if (callCount === 2) {
          return Promise.resolve({
            data: [
              { date: '2024-01-16', nav: 2.0, accNav: 2.0, dailyChangeRate: 0, buyStatus: '开放', sellStatus: '开放' },
              { date: '2024-01-17', nav: 2.0, accNav: 2.0, dailyChangeRate: 0, buyStatus: '开放', sellStatus: '开放' },
              { date: '2024-01-18', nav: 2.0, accNav: 2.0, dailyChangeRate: 0, buyStatus: '开放', sellStatus: '开放' },
              { date: '2024-01-19', nav: 2.0, accNav: 2.0, dailyChangeRate: 0, buyStatus: '开放', sellStatus: '开放' },
              { date: '2024-01-20', nav: 2.0, accNav: 2.0, dailyChangeRate: 0, buyStatus: '开放', sellStatus: '开放' },
              { date: '2024-01-21', nav: 1.0, accNav: 1.0, dailyChangeRate: 0, buyStatus: '开放', sellStatus: '开放' },
              { date: '2024-01-22', nav: 1.0, accNav: 1.0, dailyChangeRate: 0, buyStatus: '开放', sellStatus: '开放' },
              { date: '2024-01-23', nav: 1.0, accNav: 1.0, dailyChangeRate: 0, buyStatus: '开放', sellStatus: '开放' },
              { date: '2024-01-24', nav: 1.0, accNav: 1.0, dailyChangeRate: 0, buyStatus: '开放', sellStatus: '开放' },
              { date: '2024-01-25', nav: 1.0, accNav: 1.0, dailyChangeRate: 0, buyStatus: '开放', sellStatus: '开放' },
            ],
            error: null,
          });
        }
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const result = await getFundHistoryWithCache('000001'); // 默认 days=90
    expect(result).toHaveLength(25);
    expect(result[15].date).toBe('2024-01-16');
    expect(result[15].nav).toBe(2.0);
    expect(result[19].date).toBe('2024-01-20');
    expect(result[19].nav).toBe(2.0);
    expect(result[20].date).toBe('2024-01-21');
  });

  it('API 失败时返回空数组', async () => {
    mockInvoke.mockRejectedValue(new Error('fail'));
    const result = await getFundHistoryWithCache('000001');
    expect(result).toEqual([]);
  });
});

describe('batchGetFundHistory', () => {
  it('正常获取多个基金历史', async () => {
    mockInvoke.mockImplementation((fnName: string, { body }: { body: { code: string } }) => {
      if (fnName === 'fund-history') {
        return Promise.resolve({
          data: [
            {
              date: '2024-01-01',
              nav: 1,
              accNav: 1,
              dailyChangeRate: 0,
              buyStatus: '开放',
              sellStatus: '开放',
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const result = await batchGetFundHistory(['000001', '000002'], 1);
    expect(Object.keys(result)).toHaveLength(2);
    expect(result['000001']).toHaveLength(1);
    expect(result['000002']).toHaveLength(1);
  });

  it('基金数量大于3时有间隔', async () => {
    vi.useFakeTimers();

    mockInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'fund-history') {
        return Promise.resolve({
          data: [
            {
              date: '2024-01-01',
              nav: 1,
              accNav: 1,
              dailyChangeRate: 0,
              buyStatus: '开放',
              sellStatus: '开放',
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const promise = batchGetFundHistory(['1', '2', '3', '4'], 1);
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;

    expect(Object.keys(result)).toHaveLength(4);
    vi.useRealTimers();
  });
});

// ============================================
// clearNavCache（新增）
// ============================================

describe('clearNavCache', () => {
  it('清除 navCache', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        code: '000001',
        name: 'Test',
        nav: 1,
        navDate: '2024-01-01',
        estimateNav: 1.01,
        estimateRate: 1,
      },
      error: null,
    });

    await fetchFundNav('000001');
    clearNavCache();

    mockInvoke.mockClear();
    await fetchFundNav('000001');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('清除 valuationCache', async () => {
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch as any;
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ pe: 15, pb: 1.5, source: 'json' }),
    });

    await fetchMarketValuation();
    clearNavCache();

    mockFetch.mockClear();
    await fetchMarketValuation();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('清除 historyCache', async () => {
    mockInvoke.mockImplementation((fnName: string) => {
      if (fnName === 'fund-history') {
        return Promise.resolve({
          data: [
            {
              date: '2024-01-01',
              nav: 1,
              accNav: 1,
              dailyChangeRate: 0,
              buyStatus: '开放',
              sellStatus: '开放',
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    await getFundHistoryWithCache('000001', 1);
    clearNavCache();

    mockInvoke.mockClear();
    await getFundHistoryWithCache('000001', 1);
    expect(mockInvoke).toHaveBeenCalled();
  });
});
