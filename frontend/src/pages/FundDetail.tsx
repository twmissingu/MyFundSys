import React, { useState, useEffect } from 'react';
import { Card, Tag, Toast, SpinLoading, Button } from 'antd-mobile';
import { LeftOutline } from 'antd-mobile-icons';
import { fetchFundNav } from '../services/fundApi';
import { db } from '../db';
import { formatMoney } from '../utils';
import FundHistoryCard from '../components/FundHistoryCard';
import type { FundApiData } from '../types';
import type { FundCacheItem } from '../db';
import './Layout.css';

interface FundInfo {
  code: string;
  name: string;
  category: string;
  pe?: number;
  pb?: number;
  dividendYield?: number;
}

const FundDetail: React.FC = () => {
  // 从 hash 路由获取基金代码
  const [fundCode, setFundCode] = useState<string>('');
  const [fundInfo, setFundInfo] = useState<FundInfo | null>(null);
  const [fundData, setFundData] = useState<FundApiData | null>(null);
  const [loading, setLoading] = useState(true);

  // 解析 hash 获取 fundCode
  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/#fund\/(.+)/);
    if (match) {
      setFundCode(match[1]);
    }
  }, []);

  // 加载基金信息（从本地缓存）
  useEffect(() => {
    const loadFundInfo = async () => {
      if (!fundCode) return;
      
      // 从缓存数据库查找
      const cachedFund = await db.fundCache.where('code').equals(fundCode).first();
      if (cachedFund) {
        setFundInfo({
          code: cachedFund.code,
          name: cachedFund.name,
          category: cachedFund.category || '未知',
          pe: cachedFund.pe,
          pb: cachedFund.pb,
          dividendYield: cachedFund.dividendYield,
        });
        return;
      }
      
      // 如果没有缓存，等待API返回数据后设置基本信息
      // 此时 fundInfo 保持 null，等 API 返回后设置
    };
    
    loadFundInfo();
  }, [fundCode]);

  // 加载基金净值数据
  useEffect(() => {
    if (fundCode) {
      loadFundData();
    }
  }, [fundCode]);

  const loadFundData = async () => {
    try {
      setLoading(true);
      const data = await fetchFundNav(fundCode);
      if (data) {
        setFundData(data);
        // 如果 fundInfo 还没有，用 API 返回的数据设置
        if (!fundInfo) {
          setFundInfo({
            code: fundCode,
            name: data.name || fundCode,
            category: '未知',
          });
        }
      }
    } catch (error) {
      Toast.show({ content: '获取基金数据失败', position: 'bottom' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    window.location.hash = 'funds';
  };

  // 如果还没有任何基金信息且还在加载中，显示加载状态
  if (!fundInfo && loading) {
    return (
      <div className="page-container">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <SpinLoading style={{ '--size': '48px' }} />
          <p style={{ marginTop: 16, color: '#999' }}>加载基金信息...</p>
        </div>
      </div>
    );
  }

  // 如果没有基金信息且加载完成，显示不存在
  if (!fundInfo && !loading) {
    return (
      <div className="page-container">
        <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
          基金不存在
        </div>
      </div>
    );
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'A股宽基': 'primary',
      'A股行业': 'success',
      '港股': 'warning',
      '美股': 'danger',
      '商品': 'default',
      '债券': 'success',
    };
    return colors[category] || 'default';
  };

  // 使用 fundInfo（可能来自预设列表、缓存或 API）
  const displayFund = fundInfo!;

  return (
    <div className="page-container">
      <div style={{ padding: '16px' }}>
        {/* 返回按钮 */}
        <Button
          fill='none'
          onClick={handleGoBack}
          style={{ marginBottom: 16, padding: 0 }}
        >
          <LeftOutline /> 返回基金列表
        </Button>

        <div style={{ marginBottom: 16 }}>
          <Tag color={getCategoryColor(displayFund.category)}>{displayFund.category}</Tag>
        </div>
        
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>{displayFund.name}</h1>
        <p style={{ color: '#666', fontSize: 16, marginBottom: 16 }}>
          代码: {displayFund.code}
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <SpinLoading style={{ '--size': '48px' }} />
          </div>
        ) : fundData ? (
          <>
            {/* 1. 涨跌幅卡片（最醒目） */}
            <Card 
              style={{ 
                marginBottom: 16, 
                background: fundData.dailyChangeRate >= 0 
                  ? 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)' 
                  : 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
                border: 'none'
              }}
            >
              <div style={{ textAlign: 'center', color: '#fff' }}>
                <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 8 }}>日涨跌幅</div>
                <div style={{ fontSize: 48, fontWeight: 'bold', marginBottom: 8 }}>
                  {fundData.dailyChangeRate >= 0 ? '+' : ''}{fundData.dailyChangeRate.toFixed(2)}%
                </div>
                <div style={{ fontSize: 16, opacity: 0.9 }}>
                  {fundData.dailyChange >= 0 ? '+' : ''}{fundData.dailyChange.toFixed(4)}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                  净值日期: {fundData.navDate}
                </div>
              </div>
            </Card>

            {/* 2. 实时估值卡片（ETF显示实时价格，场外基金显示净值） */}
            <Card title="实时估值" style={{ marginBottom: 16 }}>
              {fundData.newPrice ? (
                /* ETF 显示实时价格 */
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>实时价格</div>
                      <div style={{ fontSize: 28, fontWeight: 'bold' }}>{fundData.newPrice.toFixed(3)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>价格涨跌</div>
                      <div 
                        style={{ 
                          fontSize: 20, 
                          fontWeight: 'bold',
                          color: (fundData.priceChangeRate || 0) >= 0 ? '#ff4d4f' : '#52c41a'
                        }}
                      >
                        {(fundData.priceChangeRate || 0) >= 0 ? '+' : ''}
                        {(fundData.priceChangeRate || 0).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                  {fundData.fundFlow !== undefined && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#666' }}>资金流入</span>
                        <span style={{ color: (fundData.fundFlow || 0) >= 0 ? '#ff4d4f' : '#52c41a' }}>
                          {(fundData.fundFlow || 0) >= 0 ? '+' : ''}{fundData.fundFlow}亿
                        </span>
                      </div>
                    </div>
                  )}
                  {fundData.marketTime && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#999', textAlign: 'right' }}>
                      行情时间: {fundData.marketTime}
                    </div>
                  )}
                </>
              ) : (
                /* 场外基金显示净值估算 */
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>最新净值</div>
                  <div style={{ fontSize: 32, fontWeight: 'bold', color: '#1677ff' }}>
                    {fundData.nav.toFixed(4)}
                  </div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                    场外基金无实时估值，以上一交易日净值为准
                  </div>
                </div>
              )}
            </Card>

            {/* 3. 净值数据卡片 */}
            <Card title="净值数据" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ color: '#666' }}>单位净值</span>
                <span style={{ fontWeight: 500 }}>{fundData.nav.toFixed(4)}</span>
              </div>
              {fundData.accNav && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ color: '#666' }}>累计净值</span>
                  <span style={{ fontWeight: 500 }}>{fundData.accNav.toFixed(4)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ color: '#666' }}>日涨跌幅</span>
                <span 
                  style={{ 
                    fontWeight: 500,
                    color: fundData.dailyChangeRate >= 0 ? '#ff4d4f' : '#52c41a'
                  }}
                >
                  {fundData.dailyChangeRate >= 0 ? '+' : ''}{fundData.dailyChangeRate.toFixed(2)}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ color: '#666' }}>涨跌额</span>
                <span 
                  style={{ 
                    fontWeight: 500,
                    color: fundData.dailyChange >= 0 ? '#ff4d4f' : '#52c41a'
                  }}
                >
                  {fundData.dailyChange >= 0 ? '+' : ''}{fundData.dailyChange.toFixed(4)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#666' }}>净值日期</span>
                <span>{fundData.navDate}</span>
              </div>
            </Card>

            {/* 4. 历史表现卡片 */}
            {fundCode && <FundHistoryCard fundCode={fundCode} />}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default FundDetail;
