import React, { useState, useEffect } from 'react';
import { Card, SwipeAction, Toast, SpinLoading } from 'antd-mobile';
import { StarFill } from 'antd-mobile-icons';
import { db, FavoriteFund } from '../db';
import './FavoriteFunds.css';

interface FavoriteFundsProps {
  onSelectFund?: (code: string, name: string) => void;
}

const FavoriteFunds: React.FC<FavoriteFundsProps> = ({ onSelectFund }) => {
  const [favorites, setFavorites] = useState<FavoriteFund[]>([]);
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
      setFavorites(list);
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

  const handleClick = (code: string, name: string) => {
    if (onSelectFund) {
      onSelectFund(code, name);
    } else {
      window.location.hash = `fund/${code}`;
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
    <Card title="已收藏基金" className="favorite-funds-card">
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
              onClick={() => handleClick(fund.code, fund.name)}
            >
              <div className="favorite-info">
                <div className="favorite-name">{fund.name}</div>
                <div className="favorite-code">{fund.code}</div>
              </div>
              <StarFill style={{ fontSize: 20, color: '#faad14' }} />
            </div>
          </SwipeAction>
        ))}
      </div>
    </Card>
  );
};

export default FavoriteFunds;
