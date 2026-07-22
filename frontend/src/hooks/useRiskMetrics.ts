import { useMemo } from 'react';
import { useGridStrategies } from './useGrid';

export interface RiskMetrics {
  gridTriggeredCount: number;
  valuationSignal: '低估' | '合理' | '高估' | null;
}

/**
 * 风险指标 Hook。
 * 仅返回 Dashboard 实际消费的两个指标（gridTriggeredCount、valuationSignal）。
 * 此前的 totalAssets/deploymentRate/top3Concentration/pendingCount/loading 无调用方使用，
 * 且 totalAssets 漏算 pendingBuyAmount（H1）——死计算已移除，不再保留误导性字段。
 */
export function useRiskMetrics(valuationPercentile?: number | null): RiskMetrics {
  const { overviews } = useGridStrategies();

  return useMemo(() => {
    let valuationSignal: RiskMetrics['valuationSignal'] = null;
    if (valuationPercentile !== null && valuationPercentile !== undefined) {
      // 修复 #11：与 getValuationStatus 五档展示对齐
      // <0.4（钻石坑/低估）→ 低估；0.4~0.6（合理）→ 合理；≥0.6（高估/危险）→ 高估
      if (valuationPercentile < 0.4) {
        valuationSignal = '低估';
      } else if (valuationPercentile < 0.6) {
        valuationSignal = '合理';
      } else {
        valuationSignal = '高估';
      }
    }

    const gridTriggeredCount = overviews.reduce(
      (sum, o) => sum + (o.triggered_pending_count || 0), 0
    );

    return { gridTriggeredCount, valuationSignal };
  }, [overviews, valuationPercentile]);
}
