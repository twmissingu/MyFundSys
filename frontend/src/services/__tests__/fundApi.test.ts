/**
 * @fileoverview 基金 API 服务测试
 * @description 测试基金搜索、净值查询等核心功能
 * @module services/__tests__/fundApi
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchFundNav,
  searchFunds,
  getFundNameByCode,
} from '../fundApi';
import type { FundApiData, FundSearchResult } from '../../types';

// Mock global fetch
global.fetch = vi.fn();

describe('fundApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getFundNameByCode', () => {
    it('应该返回预置基金名称', () => {
      const name = getFundNameByCode('000001');
      expect(name).toBe('华夏成长混合');
    });

    it('对于未知基金代码应该返回默认名称', () => {
      const name = getFundNameByCode('999999');
      expect(name).toBe('基金 999999');
    });
  });

  describe('searchFunds', () => {
    it('应该根据基金代码搜索', async () => {
      const results = await searchFunds('000001');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].code).toBe('000001');
    });

    it('应该根据基金名称搜索', async () => {
      const results = await searchFunds('沪深300');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.name.includes('沪深300'))).toBe(true);
    });

    it('空关键词应该返回空数组', async () => {
      const results = await searchFunds('');
      expect(results).toEqual([]);
    });

    it('未匹配的搜索词应该返回空数组', async () => {
      const results = await searchFunds('不存在的基金');
      expect(results).toEqual([]);
    });
  });

  describe('fetchFundNav', () => {
    it('应该返回基金净值数据', async () => {
      const data = await fetchFundNav('000001');
      expect(data).not.toBeNull();
      expect(data?.code).toBe('000001');
      expect(data?.nav).toBeGreaterThan(0);
    });

    it('应该缓存基金数据', async () => {
      // 第一次调用
      const data1 = await fetchFundNav('000001');
      // 第二次调用应该使用缓存
      const data2 = await fetchFundNav('000001');
      expect(data1?.nav).toBe(data2?.nav);
    });
  });
});
