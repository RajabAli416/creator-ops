import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[hsl(222,47%,6%)] text-[hsl(210,40%,98%)]">
          <div className="max-w-md w-full rounded-xl border border-red-500/30 bg-[hsl(222,47%,8%)] p-6">
            <h1 className="text-lg font-semibold text-red-400 mb-2">Something went wrong</h1>
            <p className="text-sm text-[hsl(215,20%,55%)] mb-4">{this.state.error.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-sm px-4 py-2 rounded-lg bg-[hsl(262,83%,58%)] text-white hover:opacity-90"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
