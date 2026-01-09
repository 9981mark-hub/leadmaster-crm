import React, { Component } from 'react';

export class ErrorBoundary extends Component<any, any> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true, error };
    }

    componentDidCatch(error: any, errorInfo: any) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', color: 'red', border: '1px solid red' }}>
                    <h2>CRASH DETECTED</h2>
                    <p>{this.state.error && this.state.error.toString()}</p>
                    <pre style={{ fontSize: '10px' }}>
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </pre>
                    <button onClick={() => window.location.reload()}>Reload</button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
