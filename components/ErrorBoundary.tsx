// @ts-nocheck
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
    isChunkError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null, isChunkError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        const isChunkError =
            error?.name === 'ChunkLoadError' ||
            error?.message?.includes('Failed to fetch dynamically imported module') ||
            error?.message?.includes('Importing a module script failed') ||
            error?.message?.includes('error loading dynamically imported module');

        return { hasError: true, error, errorInfo: null, isChunkError };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        const isChunkError =
            error?.name === 'ChunkLoadError' ||
            error?.message?.includes('Failed to fetch dynamically imported module') ||
            error?.message?.includes('Importing a module script failed') ||
            error?.message?.includes('error loading dynamically imported module');

        if (isChunkError) {
            const now = Date.now();
            const lastReload = parseInt(sessionStorage.getItem('chunk_boundary_reload') || '0', 10);

            // 15초 이내에 자동 새로고침한 적이 없다면 즉시 최신 버전 로드
            if (now - lastReload > 15000) {
                console.warn('[ErrorBoundary] 청크 로드 실패 감지: 0.3초 후 최신 버전으로 자동 갱신합니다.');
                sessionStorage.setItem('chunk_boundary_reload', String(now));
                setTimeout(() => {
                    window.location.reload();
                }, 300);
                return;
            }
        }

        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo, isChunkError });
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // 신규 배포 청크 누락 시 친절한 자동 갱신 화면
            if (this.state.isChunkError) {
                return (
                    <div style={{
                        maxWidth: '520px',
                        margin: '60px auto',
                        padding: '32px 24px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '16px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)',
                        textAlign: 'center',
                        fontFamily: 'Pretendard, system-ui, sans-serif'
                    }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            margin: '0 auto 16px',
                            borderRadius: '50%',
                            background: '#eff6ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#2563eb',
                            fontSize: '24px'
                        }}>
                            🔄
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>
                            새로운 업데이트가 적용되었습니다
                        </h2>
                        <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: '1.5', marginBottom: '20px' }}>
                            최신 버전의 기능과 화면을 안전하게 불러오기 위해 페이지를 갱신합니다.
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '10px 20px',
                                background: '#2563eb',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: '600',
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                transition: 'background 0.2s'
                            }}
                        >
                            지금 새로고침
                        </button>
                    </div>
                );
            }

            // 기타 일반 시스템 에러
            return (
                <div style={{ padding: '20px', color: '#b91c1c', background: '#fef2f2', border: '1px solid #f87171', margin: '20px', borderRadius: '8px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '10px' }}>⚠️ 시스템 오류 발생 (Critical Crash)</h2>
                    <p style={{ fontWeight: '600' }}>{this.state.error?.toString()}</p>
                    <details style={{ marginTop: '10px', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        <summary style={{ cursor: 'pointer', marginBottom: '5px' }}>상세 에러 로그확인 (클릭)</summary>
                        <pre style={{ whiteSpace: 'pre-wrap' }}>
                            {this.state.errorInfo?.componentStack}
                        </pre>
                    </details>
                    <button
                        onClick={() => {
                            localStorage.removeItem('lm_cases'); // Clear cache option
                            window.location.reload();
                        }}
                        style={{ marginTop: '15px', padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        캐시 삭제 후 새로고침 (복구 시도)
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        style={{ marginTop: '15px', marginLeft: '10px', padding: '8px 16px', background: '#4b5563', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        그냥 새로고침
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
export default ErrorBoundary;
