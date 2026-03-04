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
    }
});
