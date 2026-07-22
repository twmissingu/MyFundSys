import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, SwipeAction, Toast, SpinLoading } from 'antd-mobile';
import { StarFill } from 'antd-mobile-icons';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { fetchFundNav } from '../services/fundApi';
import { batchGetFundHistory, MiniHistoryPoint } from '../services/fundApi';
import { reorderFavorites } from '../services/favoriteService';
import SparklineChart from './SparklineChart';
import type { FundApiData } from '../types';
import './FavoriteFunds.css';

interface FavoriteFund {
  id: string;
  fund_code: string;
  fund_name: string;
  category?: string;
  created_at: string;
}

interface FundWithData extends FavoriteFund {
  navData?: FundApiData | null;
  historyData?: MiniHistoryPoint[];
}

interface FavoriteFundsProps {
  onSelectFund?: (code: string, name: string) => void;
}

const FavoriteFunds: React.FC<FavoriteFundsProps> = ({ onSelectFund }) => {
  const [favorites, setFavorites] = useState<FundWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadFavorites = useCallback(async () => {
    try {
      setLoading(true);
      if (!isSupabaseConfigured()) {
        setFavorites([]);
        return;
      }

      const { data: list, error } = await supabase
        .from('favorite_funds')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const listWithNav = await Promise.all(
        (list || []).map(async (fund: FavoriteFund) => {
          try {
            const navData = await fetchFundNav(fund.fund_code);
            return { ...fund, navData };
          } catch {
            return fund;
          }
        })
      );

      setFavorites(listWithNav);
      await loadHistoryData(listWithNav);
    } catch {
      // 加载异常由 loading 状态处理
    } finally {
      setLoading(false);
    }
  }, []);

  async function loadHistoryData(funds: FundWithData[]) {
    if (funds.length === 0) return;

    setLoadingHistory(true);
    try {
      const codes = funds.map(f => f.fund_code);
      const historyMap = await batchGetFundHistory(codes, 90);
      setFavorites(prev => prev.map(fund => ({
        ...fund,
        historyData: historyMap[fund.fund_code] || []
      })));
    } catch (e) {
      // 修复 #22：不再空 catch，至少记录以便排查
      console.warn('加载趋势图失败:', e);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const handleRemove = async (id: string) => {
    try {
      // 修复 #21：检查 error，避免删除失败时 UI 误提示"已取消收藏"
      const { error } = await supabase.from('favorite_funds').delete().eq('id', id);
      if (error) throw new Error(error.message);
      await loadFavorites();
      Toast.show({ content: '已取消收藏', position: 'bottom' });
    } catch (error) {
      Toast.show({ content: '操作失败', position: 'bottom' });
    }
  };

  const handleClick = (fund: FundWithData) => {
    if (onSelectFund) {
      onSelectFund(fund.fund_code, fund.fund_name);
    } else {
      window.location.hash = `fund/${fund.fund_code}`;
    }
  };

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    await loadFavorites();
    Toast.show({ content: '已刷新', position: 'bottom' });
  }, [loadFavorites]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = favorites.findIndex(f => f.id === active.id);
    const newIndex = favorites.findIndex(f => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(favorites, oldIndex, newIndex);
    setFavorites(reordered);
    try {
      await reorderFavorites(reordered.map(f => f.id));
    } catch {
      Toast.show({ content: '排序保存失败', position: 'bottom' });
      loadFavorites();
    }
  };

  if (loading) {
    return (
      <Card title="已收藏基金" className="favorite-funds-card">
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <SpinLoading style={{ '--size': '24px' }} />
        </div>
      </Card>
    );
  }

  if (favorites.length === 0) {
    return (
      <Card title="已收藏基金" className="favorite-funds-card">
        <div className="favorite-empty">
          <StarFill style={{ fontSize: 32, color: '#d9d9d9', marginBottom: 8 }} />
          <p>暂无收藏基金</p>
          <p className="favorite-hint">在基金详情页点击星标收藏</p>
        </div>
      </Card>
    );
  }

  return (
    <Card 
      title="已收藏基金" 
      className="favorite-funds-card"
      extra={
        <span 
          onClick={handleRefresh}
          style={{ fontSize: 13, color: '#1677ff', cursor: 'pointer' }}
        >
          刷新
        </span>
      }
    >
      {loadingHistory && (
        <div style={{ textAlign: 'center', padding: '4px', marginBottom: '8px' }}>
          <span style={{ fontSize: 12, color: '#999' }}>加载趋势图...</span>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={favorites.map(f => f.id)} strategy={verticalListSortingStrategy}>
          <div className="favorite-list">
            {favorites.map((fund) => (
              <SortableFavoriteItem
                key={fund.id}
                fund={fund}
                onRemove={handleRemove}
                onClick={handleClick}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </Card>
  );
};

function SortableFavoriteItem({ fund, onRemove, onClick }: {
  fund: FundWithData;
  onRemove: (id: string) => void;
  onClick: (fund: FundWithData) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: fund.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <SwipeAction
        rightActions={[
          {
            key: 'delete',
            text: '取消收藏',
            color: '#ff4d4f',
            onClick: () => onRemove(fund.id),
          },
        ]}
      >
        <div className="favorite-item" {...attributes} {...listeners} onClick={() => onClick(fund)}>
          <div className="favorite-drag-handle" style={{
            display: 'flex', alignItems: 'center', paddingRight: 6, color: '#bbb', fontSize: 16, cursor: 'grab',
          }}>
            ⋮⋮
          </div>
          <div className="favorite-info">
            <div className="favorite-name">{fund.fund_name}</div>
            <div className="favorite-code">{fund.fund_code}</div>
          </div>
          <div className="favorite-chart">
            <SparklineChart data={fund.historyData || []} width={80} height={36} />
            <div className="chart-label">近三月</div>
          </div>
          <div className="favorite-nav">
            {fund.navData ? (
              <>
                <div className="nav-value">{fund.navData.nav.toFixed(4)}</div>
                <div className="nav-change" style={{ color: fund.navData.dailyChangeRate >= 0 ? '#ff4d4f' : '#52c41a' }}>
                  {fund.navData.dailyChangeRate >= 0 ? '+' : ''}
                  {fund.navData.dailyChangeRate.toFixed(2)}%
                </div>
                <div className="nav-date">{fund.navData.navDate}</div>
              </>
            ) : (
              <div className="nav-loading">--</div>
            )}
          </div>
        </div>
      </SwipeAction>
    </div>
  );
}

export default FavoriteFunds;
