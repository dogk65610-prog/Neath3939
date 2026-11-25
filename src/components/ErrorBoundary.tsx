import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): State {
    let displayMsg = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(displayMsg) as { error?: string; operationType?: string };
      if (parsed && parsed.error) {
        displayMsg = `Database permission or sync issue (${parsed.operationType || 'operation'}): ${parsed.error}`;
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, message: displayMsg };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('DOG MODS ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#0D0E12] p-4 text-white">
          <div className="w-full max-w-md rounded-xl border border-red-500/30 bg-[#15171E] p-6 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-[#F16436]" />
            <h1 className="mt-4 font-display text-xl font-bold">Something went wrong</h1>
            <p className="mt-2 text-sm text-zinc-400">{this.state.message}</p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.hash = '#/';
              }}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[#F16436] px-5 text-sm font-semibold text-white hover:bg-[#FF784B]"
            >
              <RefreshCw className="h-4 w-4" />
              Return to Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
