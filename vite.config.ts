import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/leadmaster-crm/', // Added for GitHub Pages
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify("AIzaSyAF2SafVgWNz00d0UpkD-eeIqSOCmOtK4g"),
      'process.env.GEMINI_API_KEY': JSON.stringify("AIzaSyAF2SafVgWNz00d0UpkD-eeIqSOCmOtK4g")
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
