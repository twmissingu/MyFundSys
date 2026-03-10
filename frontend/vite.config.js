import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    base: '/MyFundSys/',
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['react', 'react-dom', 'react-router-dom'],
                    ui: ['antd-mobile', 'antd-mobile-icons'],
                    charts: ['recharts'],
                    db: ['dexie'],
                    supabase: ['@supabase/supabase-js']
                }
            }
        }
    },
    esbuild: {
        logOverride: { 'this-is-undefined-in-esm': 'silent' }
    },
    server: {
        proxy: {
            // 东方财富基金API代理
            '/api/eastmoney': {
                target: 'https://fundmobapi.eastmoney.com',
                changeOrigin: true,
                rewrite: function (path) {
                    var newPath = path.replace(/^\/api\/eastmoney/, '');
                    console.log('[Proxy] Rewrite:', path, '->', newPath);
                    return newPath;
                },
            },
            // 东方财富搜索API代理
            '/api/suggest': {
                target: 'https://searchapi.eastmoney.com',
                changeOrigin: true,
            },
            // 且慢估值API代理
            '/api/qieman': {
                target: 'https://qieman.com',
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/api\/qieman/, ''); },
            },
        }
    }
});
