import React, { useState, useEffect } from 'react';
import { Card, SearchBar, SpinLoading } from 'antd-mobile';
import { SearchOutline } from 'antd-mobile-icons';
import { searchByCode, searchByName, FundSearchResult } from '../services/fundApi';
import FavoriteFunds from '../components/FavoriteFunds';
import './Layout.css';

const FundList: React.FC = () => {
  // 双搜索栏状态
  const [codeSearchText, setCodeSearchText] = useState('');
  const [nameSearchText, setNameSearchText] = useState('');
  const [codeSearchResults, setCodeSearchResults] = useState<FundSearchResult[]>([]);
  const [nameSearchResults, setNameSearchResults] = useState<FundSearchResult[]>([]);
  const [isCodeSearching, setIsCodeSearching] = useState(false);
  const [isNameSearching, setIsNameSearching] = useState(false);

  // 防抖搜索（代码）
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (codeSearchText.trim().length >= 2) {
        setIsCodeSearching(true);
        try {
          const results = await searchByCode(codeSearchText.trim());
          setCodeSearchResults(results);
        } catch (error) {
          console.error('搜索失败:', error);
        } finally {
          setIsCodeSearching(false);
        }
      } else {
        setCodeSearchResults([]);
      }
    }, 300); // 300ms 防抖

    return () => clearTimeout(timer);
  }, [codeSearchText]);

  // 防抖搜索（名称）
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (nameSearchText.trim().length >= 2) {
        setIsNameSearching(true);
        try {
          const results = await searchByName(nameSearchText.trim());
          setNameSearchResults(results);
        } catch (error) {
          console.error('搜索失败:', error);
        } finally {
          setIsNameSearching(false);
        }
      } else {
        setNameSearchResults([]);
      }
    }, 300); // 300ms 防抖

    return () => clearTimeout(timer);
  }, [nameSearchText]);

  // 点击搜索结果
  const handleSelectFund = (fund: FundSearchResult) => {
    window.location.hash = `fund/${fund.code}`;
  };

  // 渲染搜索结果（去重处理）
  const renderSearchResults = (results: FundSearchResult[]) => {
    if (results.length === 0) return null;
    
    // 按 code 去重，保留第一个
    const uniqueResults = results.filter((fund, index, self) => 
      index === self.findIndex(f => f.code === fund.code)
    );
    
    return (
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>
          搜索结果 ({uniqueResults.length}只)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {uniqueResults.map((fund) => (
            <div
              key={fund.code}
              onClick={() => handleSelectFund(fund)}
              style={{
                padding: '12px',
                background: '#f5f5f5',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontWeight: 500, marginBottom: 4 }}>{fund.name}</div>
              <div style={{ fontSize: 12, color: '#999' }}>{fund.code}</div>
            </div>
          ))}
        </div>
      </Card>
    );
  };

  return (
    <div className="page-container">
      <div style={{ padding: '16px' }}>
        <h1 style={{ fontSize: 20, marginBottom: 16 }}>基金搜索</h1>
        
        {/* 按代码搜索 */}
        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
            <SearchOutline /> 按基金代码搜索
          </div>
          <SearchBar
            placeholder="输入基金代码（如：000001）"
            value={codeSearchText}
            onChange={(val) => {
              setCodeSearchText(val);
              setNameSearchText(''); // 清空另一边的搜索
              setNameSearchResults([]);
            }}
            style={{ '--background': '#f5f5f5' }}
          />
          {isCodeSearching && (
            <div style={{ textAlign: 'center', padding: '12px' }}>
              <SpinLoading style={{ '--size': '20px' }} />
            </div>
          )}
          {!isCodeSearching && codeSearchResults.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {renderSearchResults(codeSearchResults)}
            </div>
          )}
          {!isCodeSearching && codeSearchText.length >= 2 && codeSearchResults.length === 0 && (
            <div style={{ textAlign: 'center', padding: '12px', color: '#999', fontSize: 14 }}>
              未找到匹配代码的基金
            </div>
          )}
        </Card>

        {/* 按名称搜索 */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
            <SearchOutline /> 按基金名称搜索
          </div>
          <SearchBar
            placeholder="输入基金名称（如：华夏成长）"
            value={nameSearchText}
            onChange={(val) => {
              setNameSearchText(val);
              setCodeSearchText(''); // 清空另一边的搜索
              setCodeSearchResults([]);
            }}
            style={{ '--background': '#f5f5f5' }}
          />
          {isNameSearching && (
            <div style={{ textAlign: 'center', padding: '12px' }}>
              <SpinLoading style={{ '--size': '20px' }} />
            </div>
          )}
          {!isNameSearching && nameSearchResults.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {renderSearchResults(nameSearchResults)}
            </div>
          )}
          {!isNameSearching && nameSearchText.length >= 2 && nameSearchResults.length === 0 && (
            <div style={{ textAlign: 'center', padding: '12px', color: '#999', fontSize: 14 }}>
              未找到匹配名称的基金
            </div>
          )}
        </Card>

        {/* 已收藏基金 */}
        <FavoriteFunds />
      </div>
    </div>
  );
};

export default FundList;
