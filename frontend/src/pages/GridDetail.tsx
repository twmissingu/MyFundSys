import React, { useState } from 'react';
import { NavBar, SpinLoading, Toast, Button } from 'antd-mobile';
import { useGridDetail } from '../hooks/useGrid';
import { GridLadderChart } from '../components/GridLadderChart';
import { GridLevelTable } from '../components/GridLevelTable';
import { GridExecutionSheet } from '../components/GridExecutionSheet';
import { GridTypeLabels, GRID_TYPES, type GridType, type GridLevelWithStatus } from '../types';
import './Layout.css';

interface GridDetailProps {
  fundCode: string;
  onBack: () => void;
}

function GridDetail({ fundCode, onBack }: GridDetailProps) {
  const { strategy, levelsByType, currentNav, loading, error, baseShares, shouldLiquidate, executeGridLevel, sellGridLevel, liquidateGridFund, refresh } = useGridDetail(fundCode);
  const [executionSheet, setExecutionSheet] = useState<{
    visible: boolean;
    gridType: GridType;
    level: GridLevelWithStatus | null;
    action: 'buy' | 'sell';
  }>({ visible: false, gridType: 'small', level: null, action: 'buy' });
  const [isExecuting, setIsExecuting] = useState(false);

  const handleTriggerClick = (gridType: GridType, level: number) => {
    const gridLevel = levelsByType[gridType]?.find(l => l.level === level);
    if (!gridLevel) return;

    const action = gridLevel.status === 'sell_triggered' ? 'sell' : 'buy';
    setExecutionSheet({
      visible: true,
      gridType,
      level: gridLevel,
      action,
    });
  };

  const handleExecute = async (gridType: GridType, level: number) => {
    if (isExecuting) return;
    const gridLevel = levelsByType[gridType]?.find(l => l.level === level);
    if (!gridLevel) return;

    setIsExecuting(true);
    try {
      if (gridLevel.status === 'sell_triggered') {
        await sellGridLevel(gridType, level);
      } else {
        await executeGridLevel(gridType, level);
      }
    } catch (err) {
      // 修复：此前仅 finally 无 catch，executeGrid 抛错（如 C1 "买入交易尚未确认"、超卖校验）成未处理 rejection，用户无反馈
      const msg = err instanceof Error ? err.message : '操作失败';
      Toast.show({ content: msg, position: 'bottom' });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleLiquidate = async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    try {
      await liquidateGridFund();
      Toast.show({ content: '清仓完成', position: 'bottom' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '清仓失败';
      Toast.show({ content: msg, position: 'bottom' });
    } finally {
      setIsExecuting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <SpinLoading />
      </div>
    );
  }

  if (!strategy || !currentNav) {
    return (
      <div>
        <NavBar onBack={onBack}>网格详情</NavBar>
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          {error || '未找到该基金的网格策略'}
        </div>
      </div>
    );
  }

  // 统计
  let executedCount = 0;
  let triggeredCount = 0;
  let sellTriggeredCount = 0;
  let holdingCount = 0;
  let totalCount = 0;
  for (const gridType of GRID_TYPES) {
    for (const level of levelsByType[gridType] || []) {
      totalCount++;
      if (level.sellExecution) {
        executedCount++;
      } else if (level.execution) {
        holdingCount++;
        if (level.status === 'sell_triggered') {
          sellTriggeredCount++;
        }
      } else if (level.status === 'triggered') {
        triggeredCount++;
      }
    }
  }

  return (
    <div>
      <NavBar onBack={onBack}>{strategy.fund_name}</NavBar>

      {/* 基金信息头部 */}
      <div className="card" style={{ margin: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{strategy.fund_name}</div>
            <div style={{ fontSize: 13, color: '#999', marginTop: 2 }}>{strategy.fund_code}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#1677ff' }}>
              {currentNav.toFixed(4)}
            </div>
            <div style={{ fontSize: 11, color: '#999' }}>当前净值</div>
          </div>
        </div>

        {/* 统计行 */}
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <div style={{
            flex: 1,
            textAlign: 'center',
            padding: 8,
            background: '#f6ffed',
            borderRadius: 6,
          }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#52c41a' }}>{executedCount}</div>
            <div style={{ fontSize: 11, color: '#999' }}>已完成</div>
          </div>
          <div style={{
            flex: 1,
            textAlign: 'center',
            padding: 8,
            background: '#f0f5ff',
            borderRadius: 6,
          }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#1677ff' }}>{holdingCount}</div>
            <div style={{ fontSize: 11, color: '#999' }}>持有中</div>
          </div>
          <div style={{
            flex: 1,
            textAlign: 'center',
            padding: 8,
            background: sellTriggeredCount > 0 ? '#fff2f0' : '#f5f5f5',
            borderRadius: 6,
          }}>
            <div style={{
              fontSize: 18,
              fontWeight: 600,
              color: sellTriggeredCount > 0 ? '#ff4d4f' : '#999',
            }}>{sellTriggeredCount}</div>
            <div style={{ fontSize: 11, color: '#999' }}>可卖出</div>
          </div>
          <div style={{
            flex: 1,
            textAlign: 'center',
            padding: 8,
            background: triggeredCount > 0 ? '#fff7f0' : '#f5f5f5',
            borderRadius: 6,
          }}>
            <div style={{
              fontSize: 18,
              fontWeight: 600,
              color: triggeredCount > 0 ? '#ff6b35' : '#999',
            }}>{triggeredCount}</div>
            <div style={{ fontSize: 11, color: '#999' }}>待买入</div>
          </div>
        </div>

        {/* 底仓信息 */}
        {baseShares > 0 && (
          <div style={{
            marginTop: 12,
            padding: '8px 12px',
            background: '#f6ffed',
            borderRadius: 6,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <span style={{ fontSize: 12, color: '#666' }}>底仓份额：</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#52c41a' }}>{baseShares.toFixed(2)}</span>
            </div>
            <div style={{ fontSize: 11, color: '#999' }}>零成本底仓</div>
          </div>
        )}

        {/* 清仓按钮 */}
        {shouldLiquidate && (
          <div style={{ marginTop: 12 }}>
            <Button block color="danger" onClick={handleLiquidate}>
              清仓（超出网格范围，卖出所有底仓）
            </Button>
          </div>
        )}
      </div>

      {/* 阶梯图 */}
      <div style={{ margin: '0 12px 12px' }}>
        <GridLadderChart levelsByType={levelsByType} currentNav={currentNav} />
      </div>

      {/* 详细表格 */}
      <div style={{ margin: '0 12px 12px' }}>
        <div className="card">
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>网格详情</div>
          <GridLevelTable
            levelsByType={levelsByType}
            onTriggerClick={handleTriggerClick}
            shouldLiquidate={shouldLiquidate}
          />
        </div>
      </div>

      {/* 执行确认弹窗 */}
      {executionSheet.level && (
        <GridExecutionSheet
          visible={executionSheet.visible}
          strategy={strategy}
          gridType={executionSheet.gridType}
          gridLevel={executionSheet.level}
          currentNav={currentNav}
          action={executionSheet.action}
          onExecute={handleExecute}
          onClose={() => setExecutionSheet({ visible: false, gridType: 'small', level: null, action: 'buy' })}
        />
      )}
    </div>
  );
}

export default GridDetail;
