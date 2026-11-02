import React from 'react';

/**
 * 신규 배포 등으로 청크 파일(해시)이 변경되어 구버전 JS 파일을 찾지 못할 때(404),
 * 빨간 에러 창을 띄우지 않고 최신 index.html과 스크립트를 즉시 자동 새로고침하여 로드하는 스마트 Lazy 래퍼
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    const pageHasBeenForceRefreshed = sessionStorage.getItem('chunk_refreshed_at');
    const now = Date.now();

    try {
      const component = await componentImport();
      // 성공적으로 로드되면 새로고침 플래그 초기화
      sessionStorage.removeItem('chunk_refreshed_at');
      return component;
    } catch (error: any) {
      const isChunkLoadFailed =
        error?.name === 'ChunkLoadError' ||
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Importing a module script failed') ||
        error?.message?.includes('error loading dynamically imported module');

      // 최근 15초 이내에 자동 새로고침한 적이 없다면 즉시 자동 갱신
      const lastRefreshed = pageHasBeenForceRefreshed ? parseInt(pageHasBeenForceRefreshed, 10) : 0;
      const shouldAutoReload = isChunkLoadFailed && (now - lastRefreshed > 15000);

      if (shouldAutoReload) {
        console.warn('[AutoRecovery] 신규 버전 배포 감지: 최신 번들로 자동 갱신합니다.', error);
        sessionStorage.setItem('chunk_refreshed_at', String(now));
        // 브라우저 캐시를 건너뛰고 강제 최신 버전 로드
        window.location.reload();

        // 새로고침이 진행되는 동안 빨간 에러 화면이 깜빡이지 않도록 대기 Promise 반환
        return new Promise<{ default: T }>(() => {});
      }

      // 무한 루프 방지: 15초 이내 재발생 시 에러를 던져 ErrorBoundary로 위임
      throw error;
    }
  });
}
