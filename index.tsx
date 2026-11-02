import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Vite 신규 배포 청크 누락(404) 전역 감지 및 자동 새로고침 복구
window.addEventListener('vite:preloadError', (event) => {
  const now = Date.now();
  const lastReload = parseInt(sessionStorage.getItem('vite_preload_reload') || '0', 10);
  if (now - lastReload > 15000) {
    sessionStorage.setItem('vite_preload_reload', String(now));
    console.warn('[Vite] 신규 배포본 감지: 페이지를 최신 버전으로 자동 갱신합니다.', event);
    window.location.reload();
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
