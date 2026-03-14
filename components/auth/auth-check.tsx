/**
 * 登录状态检查组件
 *
 * 检查 localStorage 中的登录状态
 *
 * @module components/auth/auth-check
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * 登录状态检查组件
 */
export function AuthCheck({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 检查登录状态
    const checkAuth = () => {
      const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
      setIsAuthenticated(isLoggedIn);
      setIsLoading(false);

      // 如果未登录且不在登录页面，跳转到登录页
      if (!isLoggedIn && pathname !== '/login') {
        router.push('/login');
      }

      // 如果已登录且在登录页面，跳转到首页
      if (isLoggedIn && pathname === '/login') {
        router.push('/');
      }
    };

    checkAuth();
  }, [pathname, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  // 登录页面不需要检查
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // 未登录不显示内容
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
