import { StrictMode, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 모바일 디버깅을 위한 글로벌 에러 캐처
window.onerror = function(message, source, lineno, colno, error) {
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '0';
    errorDiv.style.left = '0';
    errorDiv.style.width = '100%';
    errorDiv.style.padding = '20px';
    errorDiv.style.background = 'rgba(255, 0, 0, 0.9)';
    errorDiv.style.color = 'white';
    errorDiv.style.zIndex = '999999';
    errorDiv.style.wordBreak = 'break-all';
    errorDiv.style.fontSize = '12px';
    errorDiv.innerHTML = `<h3>🚨 Fatal Error</h3><p>${message}</p><p>${source}:${lineno}:${colno}</p><pre>${error instanceof Error ? error.stack : ''}</pre>`;
    document.body.appendChild(errorDiv);
};

window.addEventListener('unhandledrejection', function(event) {
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '50%';
    errorDiv.style.left = '0';
    errorDiv.style.width = '100%';
    errorDiv.style.padding = '20px';
    errorDiv.style.background = 'rgba(200, 0, 0, 0.9)';
    errorDiv.style.color = 'white';
    errorDiv.style.zIndex = '999999';
    errorDiv.style.wordBreak = 'break-all';
    errorDiv.style.fontSize = '12px';
    errorDiv.innerHTML = `<h3>🚨 Promise Rejection</h3><p>${event.reason}</p>`;
    document.body.appendChild(errorDiv);
});

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
