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
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Handle chunk load errors (dynamic import failures)
        const isChunkLoadError = error.message.includes('Failed to fetch dynamically imported module') ||
            error.message.includes('Importing a module script failed');

        if (isChunkLoadError) {
            const retryCount = parseInt(sessionStorage.getItem('chunk_retry_count') || '0', 10);
            if (retryCount < 3) {
                console.warn(`Chunk load error detected. Reloading... (Attempt ${retryCount + 1}/3)`);
                sessionStorage.setItem('chunk_retry_count', (retryCount + 1).toString());
                window.location.reload();
                return;
            } else {
                console.error("Max retries for chunk load error reached.");
            }
        } else {
            // Reset retry count for other errors or successful loads (success logic handled elsewhere usually, but if we hit a different error, clear it)
            sessionStorage.removeItem('chunk_retry_count');
        }

        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
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
