import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockUseGridStrategies = vi.hoisted(() => vi.fn());

vi.mock('../../hooks/useGrid', () => ({
  useGridStrategies: mockUseGridStrategies,
}));

import { useRiskMetrics } from '../../hooks/useRiskMetrics';
import type { GridFundOverview } from '../../types';

function makeOverview(overrides: Partial<GridFundOverview> = {}): GridFundOverview {
  return {
    strategy: {} as any, current_nav: 1,
    nearest_trigger: { price: 1, distance_pct: 0, grid_type: 'small', level: 1 },
    total_budget: 10000, capital_deployed: 5000,
    executed_count: 2, total_grid_count: 10,
    triggered_pending_count: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseGridStrategies.mockReturnValue({
    overviews: [], loading: false, error: null, refresh: vi.fn(),
  });
});

describe('useRiskMetrics', () => {
  it('empty overviews returns zero gridTriggeredCount and null valuationSignal', () => {
    const { result } = renderHook(() => useRiskMetrics());
    expect(result.current.gridTriggeredCount).toBe(0);
    expect(result.current.valuationSignal).toBeNull();
  });

  it('valuationSignal is 低估 when percentile < 0.4', () => {
    const { result } = renderHook(() => useRiskMetrics(0.15));
    expect(result.current.valuationSignal).toBe('低估');
  });

  it('valuationSignal is 合理 when percentile 0.5', () => {
    const { result } = renderHook(() => useRiskMetrics(0.5));
    expect(result.current.valuationSignal).toBe('合理');
  });

  it('valuationSignal is 高估 when percentile >= 0.6', () => {
    const { result } = renderHook(() => useRiskMetrics(0.9));
    expect(result.current.valuationSignal).toBe('高估');
  });

  it('valuationSignal is null when percentile not provided', () => {
    const { result } = renderHook(() => useRiskMetrics(undefined));
    expect(result.current.valuationSignal).toBeNull();
  });

  it('gridTriggeredCount aggregates triggered_pending_count from overviews', () => {
    mockUseGridStrategies.mockReturnValue({
      overviews: [
        makeOverview({ triggered_pending_count: 2 }),
        makeOverview({ triggered_pending_count: 3 }),
      ],
      loading: false,
    });
    const { result } = renderHook(() => useRiskMetrics());
    expect(result.current.gridTriggeredCount).toBe(5);
  });
});
