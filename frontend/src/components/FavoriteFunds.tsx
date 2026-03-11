import React, { useState, useEffect } from 'react';
import { Card, SwipeAction, Toast, SpinLoading } from 'antd-mobile';
import { StarFill } from 'antd-mobile-icons';
import { db, FavoriteFund } from '../db';
import { fetchFundNav } from '../services/fundApi';
import type { FundApiData } from '../types';
import './FavoriteFunds.css';

interface FundWithData extends FavoriteFund {
  navData?: FundApiData | null;
}

interface FavoriteFundsProps {
  onSelectFund?: (code: string, name: string) => void;
}

const FavoriteFunds: React.FC<FavoriteFundsProps> = ({ onSelectFund }) => {
  const [favorites, setFavorites] = useState<FundWithData[]>([]);
  const [loading, setLoading] = useState(true);

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
      
      // 获取每个基金的实时净值
      const listWithData = await Promise.all(
        list.map(async (fund) => {
          try {
            const navData = await fetchFundNav(fund.code);
            return { ...fund, navData };
          } catch (error) {
            return fund;
          }
        })
      );
      
      setFavorites(listWithData);
    } catch (error) {
      console.error('加载收藏失败:', error);
    } finally {
      setLoading(false);
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
  const handleRefresh = async () => {
    setLoading(true);
    await loadFavorites();
    Toast.show({ content: '已刷新', position: 'bottom' });
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
              <div className="favorite-info">
                <div className="favorite-name">{fund.name}</div>
                <div className="favorite-code">{fund.code}</div>
              </div>
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
