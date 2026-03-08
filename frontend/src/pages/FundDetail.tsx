import React, { useState, useEffect } from 'react';
import { Card, List, Tabs, Tag, Toast, SpinLoading } from 'antd-mobile';
import { useParams, useNavigate } from 'react-router-dom';
import { useFunds } from '../hooks/useSync';
import { fetchFundNav } from '../services/fundApi';
import { formatMoney, formatPercent } from '../utils';
import type { FundApiData } from '../types';
import './Layout.css';

const FundDetail: React.FC = () => {
  const { fundCode } = useParams<{ fundCode: string }>();
  const navigate = useNavigate();
  const { funds } = useFunds();
  const [fundData, setFundData] = useState<FundApiData | null>(null);
  const [loading, setLoading] = useState(true);

  const fund = funds.find(f => f.code === fundCode);

  useEffect(() => {
    if (fundCode) {
      loadFundData();
    }
  }, [fundCode]);

  const loadFundData = async () => {
    try {
      setLoading(true);
      const data = await fetchFundNav(fundCode!);
      if (data) {
        setFundData(data);
      }
    } catch (error) {
      Toast.show({ content: '获取基金数据失败', position: 'bottom' });
    } finally {
      setLoading(false);
    }
  };

  if (!fund) {
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

  return (
    <div className="page-container">
      <div style={{ padding: '16px' }}>
        <div style={{ marginBottom: 16 }}>
          <Tag color={getCategoryColor(fund.category)}>{fund.category}</Tag>
        </div>
        
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>{fund.name}</h1>
        <p style={{ color: '#666', fontSize: 16, marginBottom: 16 }}>
          代码: {fund.code}
        </p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <SpinLoading style={{ '--size': '48px' }} />
          </div>
        ) : fundData ? (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>最新净值</div>
                <div style={{ fontSize: 32, fontWeight: 'bold' }}>{fundData.nav.toFixed(4)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>日涨跌幅</div>
                <div 
                  style={{ 
                    fontSize: 24, 
                    fontWeight: 'bold',
                    color: fundData.dailyChangeRate >= 0 ? '#ff4d4f' : '#52c41a'
                  }}
                >
                  {fundData.dailyChangeRate >= 0 ? '+' : ''}
                  {fundData.dailyChangeRate.toFixed(2)}%
                </div>
              </div>
            </div>
            
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#666' }}>涨跌额</span>
                <span style={{ color: fundData.dailyChange >= 0 ? '#ff4d4f' : '#52c41a' }}>
                  {fundData.dailyChange >= 0 ? '+' : ''}{fundData.dailyChange.toFixed(4)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ color: '#666' }}>净值日期</span>
                <span>{fundData.navDate}</span>
              </div>
            </div>
          </Card>
        ) : null}

        <Card title="基金信息" style={{ marginBottom: 16 }}>
          <List>
            <List.Item title="基金名称">{fund.name}</List.Item>
            <List.Item title="基金代码">{fund.code}</List.Item>
            <List.Item title="基金分类">
              <Tag color={getCategoryColor(fund.category)}>{fund.category}</Tag>
            </List.Item>
            {fund.pe && (
              <List.Item title="市盈率(PE)">{fund.pe.toFixed(2)}</List.Item>
            )}
            {fund.pb && (
              <List.Item title="市净率(PB)">{fund.pb.toFixed(2)}</List.Item>
            )}
            {fund.dividendYield && (
              <List.Item title="股息率">{formatPercent(fund.dividendYield)}</List.Item>
            )}
          </List>
        </Card>

        <Card title="投资提示" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
          <div style={{ fontSize: 14, color: '#389e0d', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 8px 0' }}><strong>E大投资理念</strong></p>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li>不要满仓，保留现金</li>
              <li>分散投资，降低风险</li>
              <li>低估值时买入，高估值时卖出</li>
              <li>长期持有，忽略短期波动</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default FundDetail;
