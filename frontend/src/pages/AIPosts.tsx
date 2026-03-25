import React, { useState, useEffect } from 'react';
import { List, Card, Avatar, Space, SpinLoading, ErrorBlock } from 'antd-mobile';
import { LikeOutline, MessageOutline, UploadOutline } from 'antd-mobile-icons';
import { fetchAITweets } from '../services/twitterService';
import type { Tweet } from '../types';

const AIPosts: React.FC = () => {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTweets();
  }, []);

  const loadTweets = async () => {
    try {
      setLoading(true);
      const response = await fetchAITweets();
      if (response.error) {
        setError(response.error);
      } else {
        setTweets(response.data);
      }
    } catch (err) {
      setError('Failed to load tweets');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
        <SpinLoading color="primary" />
      </div>
    );
  }

  if (error) {
    return <ErrorBlock title="加载失败" description={error} />;
  }

  return (
    <div style={{ padding: '16px' }}>
      <h2 style={{ marginBottom: '16px' }}>AI 博主最新动态</h2>
      <List>
        {tweets.map((tweet) => (
          <List.Item key={tweet.id}>
            <Card style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <Avatar
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${tweet.username}`}
                  style={{ flexShrink: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 'bold' }}>@{tweet.username}</span>
                    <span style={{ color: '#666', fontSize: '12px' }}>
                      {formatDate(tweet.created_at)}
                    </span>
                  </div>
                  <div style={{ marginBottom: '8px', lineHeight: '1.5' }}>
                    {tweet.text}
                  </div>
                  <Space style={{ fontSize: '12px', color: '#666' }}>
                    <span>
                      <MessageOutline style={{ marginRight: '4px' }} />
                      {tweet.public_metrics.reply_count}
                    </span>
                    <span>
                      <UploadOutline style={{ marginRight: '4px' }} />
                      {tweet.public_metrics.retweet_count}
                    </span>
                    <span>
                      <LikeOutline style={{ marginRight: '4px' }} />
                      {tweet.public_metrics.like_count}
                    </span>
                  </Space>
                </div>
              </div>
            </Card>
          </List.Item>
        ))}
      </List>
      {tweets.length === 0 && (
        <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
          暂无推文数据
        </div>
      )}
    </div>
  );
};

export default AIPosts;