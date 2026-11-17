import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'An unexpected error occurred.' };
  }

  componentDidCatch(error: Error) {
    console.error('7Sense ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      let readable = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed.error && parsed.operationType) {
          readable = `Database ${parsed.operationType} on ${parsed.path || 'collection'}: ${parsed.error}`;
        }
      } catch {
        // non-JSON message
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FAF8F4] dark:bg-[#0A0A0C] p-6">
          <div className="max-w-lg w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-8 space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-[#C5A059]">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="font-display text-2xl font-semibold text-neutral-900 dark:text-[#F5F2EB]">
                Workspace Recovery
              </h2>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed break-words">
              {readable}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C5A059] text-neutral-950 text-sm font-semibold hover:bg-[#D4B475] transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Return to Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
