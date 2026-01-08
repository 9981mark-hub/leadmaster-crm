// @ts-nocheck
import React, { Component } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error, errorInfo: null };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white p-6 rounded-xl shadow-2xl max-w-lg w-full border-l-4 border-red-500 animate-in fade-in zoom-in duration-300">
                        <h2 className="text-xl font-bold text-red-600 mb-2 flex items-center gap-2">
                            <AlertTriangle /> 오류가 발생했습니다.
                        </h2>
                        <p className="text-gray-600 mb-4">
                            죄송합니다. 처리 중 예상치 못한 오류가 발생했습니다.<br />
                            화면을 캡처하여 개발자에게 전달주시면 큰 도움이 됩니다.
                        </p>

                        <div className="bg-gray-100 p-3 rounded-lg text-xs font-mono text-gray-700 overflow-auto max-h-40 mb-4 border border-gray-200">
                            <strong>{this.state.error?.toString()}</strong>
                            <div className="mt-2 text-gray-500 whitespace-pre-wrap">
                                {this.state.errorInfo?.componentStack}
                            </div>
                        </div>

                        <button
                            onClick={() => window.location.reload()}
                            className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center justify-center gap-2"
                        >
                            <RefreshCcw size={16} /> 새로고침
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
