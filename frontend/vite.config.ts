import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/MyFundSys/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // 忽略 TypeScript 错误
    minify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['antd-mobile', 'antd-mobile-icons'],
        }
      }
    }
  },
  esbuild: {
    // 忽略所有 TypeScript 错误
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
    target: 'es2020',
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://xeddgyxugpwmgwmeetme.supabase.co/functions/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    }
  },
})
