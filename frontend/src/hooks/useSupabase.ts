import { useEffect, useState } from 'react';

// ============================================
// 认证相关 Hooks (简化版 - 本地密码验证)
// ============================================

// 检查是否已登录
export function useAuthStatus() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const auth = localStorage.getItem('myfundsys_auth');
      const authTime = localStorage.getItem('myfundsys_auth_time');
      
      if (auth === 'true' && authTime) {
        // 检查登录是否过期（30天）
        const elapsed = Date.now() - parseInt(authTime);
        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
        
        if (elapsed < thirtyDays) {
          setIsAuthenticated(true);
        } else {
          // 登录过期，清除状态
          localStorage.removeItem('myfundsys_auth');
          localStorage.removeItem('myfundsys_auth_time');
          setIsAuthenticated(false);
        }
      }
      setLoading(false);
    };
    
    checkAuth();
  }, []);

  return { isAuthenticated, loading };
}

// 登出
export async function signOut() {
  localStorage.removeItem('myfundsys_auth');
  localStorage.removeItem('myfundsys_auth_time');
  window.location.href = '/login';
}
