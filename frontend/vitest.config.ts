import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/__tests__/setup.ts',
      exclude: ['**/node_modules/**', '**/e2e/**'],
    },
  })
);
