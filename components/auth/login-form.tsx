/**
 * 登录表单组件
 *
 * @module components/auth/login-form
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

/**
 * 登录表单组件
 */
export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  /**
   * 处理登录
   */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // 验证密码
    if (code !== process.env.NEXT_PUBLIC_AUTH_CODE) {
      setError('密码错误');
      setIsLoading(false);
      return;
    }

    try {
      // 模拟登录延迟
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 保存登录状态到 localStorage
      localStorage.setItem('isLoggedIn', 'true');

      // 跳转到仪表盘
      router.push('/');
      router.refresh();
    } catch (err) {
      setError('登录失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Input
              id="code"
              type="password"
              placeholder="请输入密码"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={isLoading}
              className="text-center text-lg tracking-widest"
              maxLength={10}
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                登录中...
              </>
            ) : (
              '进入系统'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
