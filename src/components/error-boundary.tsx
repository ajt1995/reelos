import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ReelOS ErrorBoundary caught an unhandled error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallbackView
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          showDetails={this.state.showDetails}
          onToggleDetails={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
          onReset={this.handleReset}
          onGoHome={this.handleGoHome}
        />
      );
    }

    return this.props.children;
  }
}

export function ErrorFallbackView({
  error,
  errorInfo,
  showDetails,
  onToggleDetails,
  onReset,
  onGoHome,
}: {
  error: Error | null;
  errorInfo?: ErrorInfo | null;
  showDetails?: boolean;
  onToggleDetails?: () => void;
  onReset?: () => void;
  onGoHome?: () => void;
}) {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
      <div className="relative mb-6 flex size-20 items-center justify-center rounded-3xl border border-gold/30 bg-gold/10 shadow-2xl shadow-gold/10">
        <AlertTriangle className="size-10 text-gold" />
      </div>

      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Momentary Interface Hiccup
      </h1>

      <p className="mt-2.5 max-w-md text-sm text-muted">
        ReelOS isolated this visual hiccup. Your media library, storage, and background streams
        remain safe and running smoothly.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="gold"
          size="md"
          onClick={onReset || (() => window.location.reload())}
          className="h-11 px-6 rounded-xl font-semibold shadow-lg shadow-gold/20"
        >
          <RefreshCw className="mr-2 size-4" />
          Reload Screen
        </Button>

        <Button
          variant="quiet"
          size="md"
          onClick={onGoHome || (() => (window.location.href = "/"))}
          className="h-11 px-6 rounded-xl font-medium border border-border"
        >
          <Home className="mr-2 size-4" />
          Return Home
        </Button>
      </div>

      {error ? (
        <div className="mt-10 w-full max-w-lg text-left">
          <button
            type="button"
            onClick={onToggleDetails}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors mx-auto"
          >
            <span>{showDetails ? "Hide technical diagnostic" : "Show technical diagnostic"}</span>
            {showDetails ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>

          {showDetails ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-border/80 bg-raised/80 p-4 shadow-inner text-xs font-mono backdrop-blur-md">
              <p className="text-red-400 font-semibold break-all">{error.toString()}</p>
              {errorInfo?.componentStack ? (
                <pre className="mt-2 max-h-48 overflow-y-auto text-[11px] text-faint whitespace-pre-wrap">
                  {errorInfo.componentStack}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** TanStack Router Root errorComponent adapter */
export function RootRouteErrorFallback({ error }: { error: unknown }) {
  const err = error instanceof Error ? error : new Error(String(error || "Unknown router error"));
  return (
    <ErrorFallbackView
      error={err}
      onReset={() => window.location.reload()}
      onGoHome={() => (window.location.href = "/")}
    />
  );
}
