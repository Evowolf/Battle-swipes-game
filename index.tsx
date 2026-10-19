
import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { Zap } from 'lucide-react';
import App from './App';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Battle Swipes App Error:", error, errorInfo);
  }

  handleReload = () => {
    try {
      this.setState({ hasError: false, error: null });
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-screen bg-black flex flex-col items-center justify-center font-cinzel text-white p-6 text-center select-none">
          <div className="w-16 h-16 rounded-full border-2 border-yellow-500 flex items-center justify-center text-yellow-500 mb-4 animate-pulse">
            <Zap className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-4xl font-black mb-3 text-yellow-500 uppercase tracking-widest">
            Realm Disruption
          </h1>
          <p className="text-xs sm:text-sm text-yellow-200/70 max-w-md mb-6 leading-relaxed">
            The primal elemental energies encountered a brief disturbance. You can restore your connection to the arena instantly.
          </p>
          <button
            onClick={this.handleReload}
            className="bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-black px-6 py-3 rounded-xl text-sm sm:text-base tracking-wider uppercase hover:brightness-110 active:scale-95 transition-all shadow-xl shadow-yellow-500/20"
          >
            Reconnect to Arena
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
