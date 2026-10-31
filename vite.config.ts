import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    // GitHub Pages는 /leadmaster-crm/ 아래, Vercel은 도메인 루트(/)에서 연다 (Vercel 빌드 때 VERCEL=1)
    base: process.env.VERCEL ? '/' : '/leadmaster-crm/',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    // AI 키는 번들에 넣지 않는다 (AI 호출은 Supabase Edge Function ai-proxy가 서버 비밀값으로 한다)
    build: {
      rollupOptions: {
        output: {
          entryFileNames: `assets/[name].[hash].js`,
          chunkFileNames: `assets/[name].[hash].js`,
          assetFileNames: `assets/[name].[hash].[ext]`
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
