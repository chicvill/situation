import { StrictMode, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Error Boundary to catch silent crashes
class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('🚨 App Error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: '40px', background: '#1f2937', color: 'white',
          minHeight: '100vh', fontFamily: 'monospace'
        }}>
          <h1 style={{ color: '#ef4444' }}>🚨 앱 오류 감지됨</h1>
          <pre style={{
            background: '#111827', padding: '20px', borderRadius: '8px',
            color: '#f97316', whiteSpace: 'pre-wrap', wordBreak: 'break-all'
          }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <p style={{ color: '#94a3b8' }}>이 오류를 AI에게 전달하면 즉시 수정해드립니다.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
