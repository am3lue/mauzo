import { Component, ErrorInfo, ReactNode } from 'react';
import { ShoppingBag, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  declare props: Props;
  declare state: State;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#e0e5ec] flex items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full clay-card p-8 flex flex-col items-center text-center gap-4 bg-[#f1f3f6]">
            <div className="w-16 h-16 rounded-3xl bg-rose-50 flex items-center justify-center text-rose-500 border border-rose-200">
              <ShoppingBag size={32} />
            </div>
            <h2 className="font-black text-xl text-slate-800">Samahani! Kuna tatizo limetokea.</h2>
            <p className="text-sm text-slate-500">Programu imekumbana na hitilafu isiyotarajiwa. Tafadhali jaribu tena.</p>
            <div className="text-xs text-slate-400 font-mono bg-slate-100 p-3 rounded-2xl w-full truncate">
              {this.state.error?.message || 'Hitilafu isiyojulikana'}
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={this.handleReload}
                className="clay-btn-indigo px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw size={16} />
                Anzisha upya (Reload)
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
