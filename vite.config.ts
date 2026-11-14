import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    // 공식 도메인(lmaster.xyz) 및 Vercel 배포 시 루트(/), GitHub Pages는 (/leadmaster-crm/)
    base: process.env.VERCEL ? '/' : '/leadmaster-crm/',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      {
        name: 'edge-tts-dev-middleware',
        configureServer(server) {
          server.middlewares.use('/api/edge-tts', async (req, res) => {
            try {
              const handlerModule = await server.ssrLoadModule('./api/edge-tts.ts');
              const handler = handlerModule.default || handlerModule;
              await handler(req, res);
            } catch (err) {
              console.error('Local Edge-TTS dev server error:', err);
              if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: String(err) }));
              }
            }
          });
        },
      },
    ],
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
