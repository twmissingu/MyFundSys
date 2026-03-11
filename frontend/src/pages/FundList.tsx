import React, { useState, useEffect } from 'react';
import { Card, SearchBar, Button, Toast, SpinLoading } from 'antd-mobile';
import { SearchOutline, RedoOutline } from 'antd-mobile-icons';
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

  // 按代码搜索基金
  const handleCodeSearch = async (value: string) => {
    setCodeSearchText(value);
    setNameSearchText('');
    setNameSearchResults([]);
    
    if (!value || value.trim().length < 2) {
      setCodeSearchResults([]);
      return;
    }
    
    setIsCodeSearching(true);
    try {
      const results = await searchByCode(value.trim());
      setCodeSearchResults(results);
      
      if (results.length === 0) {
        Toast.show({ content: '未找到匹配代码的基金', position: 'bottom' });
      }
    } catch (error) {
      Toast.show({ content: '搜索失败', position: 'bottom' });
    } finally {
      setIsCodeSearching(false);
    }
  };

  // 按名称搜索基金
  const handleNameSearch = async (value: string) => {
    setNameSearchText(value);
    setCodeSearchText('');
    setCodeSearchResults([]);
    
    if (!value || value.trim().length < 2) {
      setNameSearchResults([]);
      return;
    }
    
    setIsNameSearching(true);
    try {
      const results = await searchByName(value.trim());
      setNameSearchResults(results);
      
      if (results.length === 0) {
        Toast.show({ content: '未找到匹配名称的基金', position: 'bottom' });
      }
    } catch (error) {
      Toast.show({ content: '搜索失败', position: 'bottom' });
    } finally {
      setIsNameSearching(false);
    }
  };

  // 点击搜索结果
  const handleSelectFund = (fund: FundSearchResult) => {
    window.location.hash = `fund/${fund.code}`;
  };

  // 渲染搜索结果
  const renderSearchResults = (results: FundSearchResult[]) => {
    if (results.length === 0) return null;
    
    return (
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>
          搜索结果 ({results.length}只)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map((fund) => (
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
            onChange={setCodeSearchText}
            onSearch={handleCodeSearch}
            style={{ '--background': '#f5f5f5' }}
          />
          {isCodeSearching && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <SpinLoading style={{ '--size': '24px' }} />
            </div>
          )}
          {!isCodeSearching && codeSearchResults.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {renderSearchResults(codeSearchResults)}
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
            onChange={setNameSearchText}
            onSearch={handleNameSearch}
            style={{ '--background': '#f5f5f5' }}
          />
          {isNameSearching && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <SpinLoading style={{ '--size': '24px' }} />
            </div>
          )}
          {!isNameSearching && nameSearchResults.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {renderSearchResults(nameSearchResults)}
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
