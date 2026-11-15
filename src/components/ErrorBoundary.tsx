import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('[CampusConnect ErrorBoundary] Uncaught UI error:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      timestamp: new Date().toISOString(),
    });
  }

  private handleReset = (): void => {
    this.setState({ hasError: true ? false : false, error: null, errorInfo: null });
  };

  private handleGoHome = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== 'undefined') {
      window.location.assign('/');
    }
  };

  private handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-[70dvh] w-full flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-md glass rounded-3xl p-6 sm:p-8 border border-border-subtle shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/15 text-red-500 flex items-center justify-center">
              <AlertTriangle size={28} />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight font-display">
                Something went wrong
              </h1>
              <p className="text-sm text-secondary leading-relaxed">
                An unexpected error interrupted this screen. Your session and data remain safe.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="text-left rounded-2xl bg-background/70 border border-border-subtle p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary mb-1">
                  Error Details
                </p>
                <p className="text-xs font-mono text-red-500 break-words">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-3 px-4 rounded-xl bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                <RefreshCw size={16} />
                Try Again
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex-1 py-3 px-4 rounded-xl border border-border-subtle text-sm font-semibold flex items-center justify-center gap-2 hover:bg-secondary/10 transition-colors"
              >
                <Home size={16} />
                Home
              </button>
            </div>

            <button
              type="button"
              onClick={this.handleReload}
              className="text-xs font-semibold text-secondary hover:text-foreground underline underline-offset-4"
            >
              Reload application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
