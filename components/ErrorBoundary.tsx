import React from 'react';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error, errorInfo: null };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }
            return (
                <div style={{ padding: '20px', margin: '20px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', color: '#991b1b' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>System Error (Data Critical)</h2>
                    <p style={{ fontWeight: '600' }}>{this.state.error?.toString()}</p>
                    <details style={{ marginTop: '10px', fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                        <summary style={{ cursor: 'pointer', marginBottom: '5px' }}>Stack Trace</summary>
                        {this.state.errorInfo?.componentStack}
                    </details>
                    <button
                        onClick={() => window.location.reload()}
                        style={{ marginTop: '15px', padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Recover (Reload)
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
