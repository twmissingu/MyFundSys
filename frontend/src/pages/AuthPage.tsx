import React, { useState } from 'react';
import { Card, Form, Input, Button, Toast } from 'antd-mobile';
import { LockOutline } from 'antd-mobile-icons';
import './Layout.css';

const CORRECT_PASSWORD = '888';

interface AuthPageProps {
  onAuthSuccess: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleSubmit = async (values: { password: string }) => {
    try {
      setLoading(true);
      
      // 模拟网络延迟，增加安全性
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (values.password === CORRECT_PASSWORD) {
        // 将认证状态保存到 localStorage
        localStorage.setItem('myfundsys_auth', 'true');
        localStorage.setItem('myfundsys_auth_time', Date.now().toString());
        
        Toast.show({
          content: '登录成功',
          position: 'bottom',
        });
        onAuthSuccess();
      } else {
        Toast.show({
          content: '密码错误',
          position: 'bottom',
        });
        form.resetFields();
      }
    } catch (error) {
      Toast.show({
        content: '登录失败，请重试',
        position: 'bottom',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div style={{ textAlign: 'center', padding: '60px 0 30px' }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: 'linear-gradient(135deg, #1677ff 0%, #0958d9 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          boxShadow: '0 8px 24px rgba(22, 119, 255, 0.3)',
        }}>
          <LockOutline style={{ fontSize: 40, color: '#fff' }} />
        </div>
        <h1 style={{ fontSize: 28, marginBottom: 8, color: '#333' }}>MyFundSys</h1>
        <p style={{ color: '#666', fontSize: 14 }}>智能基金投资管理系统</p>
      </div>

      <Card className="card" style={{ margin: '0 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, color: '#333', marginBottom: 8 }}>请输入访问密码</h2>
          <p style={{ fontSize: 13, color: '#999' }}>此系统为私人使用，请输入密码继续</p>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          footer={
            <Button
              block
              type="submit"
              color="primary"
              loading={loading}
              size="large"
              style={{ marginTop: 8 }}
            >
              进入系统
            </Button>
          }
        >
          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
            ]}
          >
            <Input
              placeholder="请输入密码"
              type="password"
              clearable
              style={{ textAlign: 'center', fontSize: 18 }}
            />
          </Form.Item>
        </Form>
      </Card>

      <div style={{ 
        textAlign: 'center', 
        padding: '30px 20px', 
        color: '#999', 
        fontSize: 13,
        lineHeight: 1.8,
      }}>
        <p>基于 E大（ETF拯救世界）投资理念</p>
        <p>投资有风险，入市需谨慎</p>
      </div>
    </div>
  );
};

export default AuthPage;
