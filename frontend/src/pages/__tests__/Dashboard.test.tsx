/**
 * @fileoverview Dashboard 页面测试
 * @description 测试仪表盘页面的渲染和功能
 * @module pages/__tests__/Dashboard
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';

// Mock 依赖
vi.mock('../../hooks/useDB', () => ({
  useDB: () => ({
    holdings: [],
    transactions: [],
    loading: false,
  }),
}));

vi.mock('../../hooks/useSync', () => ({
  useSync: () => ({
    syncStatus: 'idle',
    lastSyncTime: null,
    sync: vi.fn(),
  }),
}));

describe('Dashboard', () => {
  it('应该正确渲染仪表盘标题', () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
    expect(screen.getByText('资产总览')).toBeInTheDocument();
  });

  it('应该显示市场估值卡片', () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
    expect(screen.getByText('市场估值')).toBeInTheDocument();
  });

  it('应该显示持仓概览', () => {
    render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
    expect(screen.getByText('持仓概览')).toBeInTheDocument();
  });
});
