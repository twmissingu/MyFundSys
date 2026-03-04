import React, { useState } from 'react';
import { Card, Form, Input, Button, Toast, Tabs } from 'antd-mobile';
import { signIn, signUp, resetPassword } from '../hooks/useSupabase';
import './Layout.css';

interface AuthPageProps {
  onAuthSuccess: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();
  const [resetForm] = Form.useForm();

  const handleLogin = async (values: any) => {
    try {
      setLoading(true);
      const { data, error } = await signIn(values.email, values.password);
      
      if (error) {
        Toast.show({
          content: error.message || '登录失败',
          position: 'bottom',
        });
        return;
      }

      if (data.user) {
        Toast.show({
          content: '登录成功',
          position: 'bottom',
        });
        onAuthSuccess();
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

  const handleRegister = async (values: any) => {
    if (values.password !== values.confirmPassword) {
      Toast.show({
        content: '两次输入的密码不一致',
        position: 'bottom',
      });
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await signUp(values.email, values.password);
      
      if (error) {
        Toast.show({
          content: error.message || '注册失败',
          position: 'bottom',
        });
        return;
      }

      if (data.user) {
        Toast.show({
          content: '注册成功，请登录',
          position: 'bottom',
        });
        setActiveTab('login');
        registerForm.resetFields();
      }
    } catch (error) {
      Toast.show({
        content: '注册失败，请重试',
        position: 'bottom',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (values: any) => {
    try {
      setLoading(true);
      const { error } = await resetPassword(values.email);
      
      if (error) {
        Toast.show({
          content: error.message || '重置失败',
          position: 'bottom',
        });
        return;
      }

      Toast.show({
        content: '重置链接已发送到您的邮箱',
        position: 'bottom',
      });
      setActiveTab('login');
      resetForm.resetFields();
    } catch (error) {
      Toast.show({
        content: '重置失败，请重试',
        position: 'bottom',
      });
    } finally {
      setLoading(false);
    }
  };

  const renderLoginForm = () => (
    <Form
      form={loginForm}
      layout="vertical"
      onFinish={handleLogin}
      footer={
        <>
          <Button
            block
            type="submit"
            color="primary"
            loading={loading}
            size="large"
          >
            登录
          </Button>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Button
              fill="none"
              size="small"
              onClick={() => setActiveTab('reset')}
            >
              忘记密码？
            </Button>
          </div>
        </>
      }
    >
      <Form.Item
        name="email"
        label="邮箱"
        rules={[
          { required: true, message: '请输入邮箱' },
          { type: 'email', message: '请输入有效的邮箱地址' },
        ]}
      >
        <Input placeholder="请输入邮箱" type="email" />
      </Form.Item>

      <Form.Item
        name="password"
        label="密码"
        rules={[
          { required: true, message: '请输入密码' },
          { min: 6, message: '密码至少6位' },
        ]}
      >
        <Input placeholder="请输入密码" type="password" />
      </Form.Item>
    </Form>
  );

  const renderRegisterForm = () => (
    <Form
      form={registerForm}
      layout="vertical"
      onFinish={handleRegister}
      footer={
        <Button
          block
          type="submit"
          color="primary"
          loading={loading}
          size="large"
        >
          注册
        </Button>
      }
    >
      <Form.Item
        name="email"
        label="邮箱"
        rules={[
          { required: true, message: '请输入邮箱' },
          { type: 'email', message: '请输入有效的邮箱地址' },
        ]}
      >
        <Input placeholder="请输入邮箱" type="email" />
      </Form.Item>

      <Form.Item
        name="password"
        label="密码"
        rules={[
          { required: true, message: '请输入密码' },
          { min: 6, message: '密码至少6位' },
        ]}
      >
        <Input placeholder="请输入密码" type="password" />
      </Form.Item>

      <Form.Item
        name="confirmPassword"
        label="确认密码"
        rules={[
          { required: true, message: '请确认密码' },
        ]}
      >
        <Input placeholder="请再次输入密码" type="password" />
      </Form.Item>
    </Form>
  );

  const renderResetForm = () => (
    <Form
      form={resetForm}
      layout="vertical"
      onFinish={handleResetPassword}
      footer={
        <>
          <Button
            block
            type="submit"
            color="primary"
            loading={loading}
            size="large"
          >
            发送重置链接
          </Button>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Button
              fill="none"
              size="small"
              onClick={() => setActiveTab('login')}
            >
              返回登录
            </Button>
          </div>
        </>
      }
    >
      <Form.Item
        name="email"
        label="邮箱"
        rules={[
          { required: true, message: '请输入邮箱' },
          { type: 'email', message: '请输入有效的邮箱地址' },
        ]}
      >
        <Input placeholder="请输入注册时的邮箱" type="email" />
      </Form.Item>
      <p style={{ color: '#666', fontSize: 13, marginTop: 8 }}>
        我们将向您的邮箱发送密码重置链接，请注意查收。
      </p>
    </Form>
  );

  return (
    <div className="page-container">
      <div style={{ textAlign: 'center', padding: '40px 0 20px' }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>MyFundSys</h1>
        <p style={{ color: '#666', fontSize: 14 }}>智能基金投资管理系统</p>
      </div>

      <Card className="card">
        <Tabs
          activeKey={activeTab === 'reset' ? 'login' : activeTab}
          onChange={setActiveTab}
          style={{ marginBottom: 20 }}
        >
          <Tabs.Tab title="登录" key="login" />
          <Tabs.Tab title="注册" key="register" />
        </Tabs>

        {activeTab === 'login' && renderLoginForm()}
        {activeTab === 'register' && renderRegisterForm()}
        {activeTab === 'reset' && renderResetForm()}
      </Card>

      <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: 13 }}>
        <p>基于 E大（ETF拯救世界）投资理念</p>
        <p>投资有风险，入市需谨慎</p>
      </div>
    </div>
  );
};

export default AuthPage;
