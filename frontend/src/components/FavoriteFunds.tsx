import React, { useState, useEffect, useCallback } from 'react';
import { Card, SwipeAction, Toast, SpinLoading } from 'antd-mobile';
import { StarFill } from 'antd-mobile-icons';
import { db, FavoriteFund } from '../db';
import { fetchFundNav } from '../services/fundApi';
import { batchGetFundHistory, MiniHistoryPoint } from '../services/fundApi';
import SparklineChart from './SparklineChart';
import type { FundApiData } from '../types';
import './FavoriteFunds.css';

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

  // 初始加载
  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      const list = await db.favoriteFunds
        .orderBy('createdAt')
        .reverse()
        .toArray();
      
      // 获取实时净值（优先）
      const listWithNav = await Promise.all(
        list.map(async (fund) => {
          try {
            const navData = await fetchFundNav(fund.code);
            return { ...fund, navData };
          } catch (error) {
            return fund;
          }
        })
      );
      
      setFavorites(listWithNav);
      
      // 再异步加载历史数据（用于图表）
      loadHistoryData(listWithNav);
    } catch (error) {
      console.error('加载收藏失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载历史数据（带缓存优化）
  const loadHistoryData = async (funds: FundWithData[]) => {
    if (funds.length === 0) return;
    
    setLoadingHistory(true);
    try {
      const codes = funds.map(f => f.code);
      const historyMap = await batchGetFundHistory(codes, 90); // 3个月
      
      setFavorites(prev => prev.map(fund => ({
        ...fund,
        historyData: historyMap[fund.code] || []
      })));
    } catch (error) {
      console.error('加载历史数据失败:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await db.favoriteFunds.delete(id);
      await loadFavorites();
      Toast.show({ content: '已取消收藏', position: 'bottom' });
    } catch (error) {
      Toast.show({ content: '操作失败', position: 'bottom' });
    }
  };

  const handleClick = (fund: FundWithData) => {
    if (onSelectFund) {
      onSelectFund(fund.code, fund.name);
    } else {
      window.location.hash = `fund/${fund.code}`;
    }
  };

  // 刷新净值数据
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    await loadFavorites();
    Toast.show({ content: '已刷新', position: 'bottom' });
  }, []);

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
      <div className="favorite-list">
        {favorites.map((fund) => (
          <SwipeAction
            key={fund.id}
            rightActions={[
              {
                key: 'delete',
                text: '取消收藏',
                color: '#ff4d4f',
                onClick: () => handleRemove(fund.id),
              },
            ]}
          >
            <div
              className="favorite-item"
              onClick={() => handleClick(fund)}
            >
              {/* 左侧：基金信息 */}
              <div className="favorite-info">
                <div className="favorite-name">{fund.name}</div>
                <div className="favorite-code">{fund.code}</div>
              </div>
              
              {/* 中部：三月走势迷你图 */}
              <div className="favorite-chart">
                <SparklineChart 
                  data={fund.historyData || []} 
                  width={80} 
                  height={36}
                />
                <div className="chart-label">近三月</div>
              </div>
              
              {/* 右侧：净值信息 */}
              <div className="favorite-nav">
                {fund.navData ? (
                  <>
                    <div className="nav-value">{fund.navData.nav.toFixed(4)}</div>
                    <div 
                      className="nav-change"
                      style={{ 
                        color: fund.navData.dailyChangeRate >= 0 ? '#ff4d4f' : '#52c41a' 
                      }}
                    >
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
        ))}
      </div>
    </Card>
  );
};

export default FavoriteFunds;
