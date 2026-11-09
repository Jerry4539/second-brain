import { Component, type ErrorInfo, type ReactNode, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './lib/theme'
import { ToastProvider } from './lib/toast'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled app error in RootErrorBoundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          height: '100vh',
          width: '100vw',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#131118',
          color: '#f3f3f6',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: '24px',
          boxSizing: 'border-box',
          textAlign: 'center',
        }}>
          <div style={{
            maxWidth: '560px',
            backgroundColor: '#1c1824',
            border: '1px solid #2e2838',
            borderRadius: '16px',
            padding: '28px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#f43f5e', margin: '0 0 12px 0' }}>
              Something went wrong loading Second Brain
            </h2>
            <p style={{ fontSize: '13px', color: '#a1a1aa', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              The application encountered an unexpected runtime error during launch.
            </p>
            <pre style={{
              backgroundColor: '#0d0b12',
              color: '#fda4af',
              fontSize: '11px',
              padding: '12px',
              borderRadius: '8px',
              overflowX: 'auto',
              textAlign: 'left',
              maxHeight: '160px',
              marginBottom: '20px',
              border: '1px solid #3b1b28',
            }}>
              {this.state.error?.message || 'Unknown error'}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#f43f5e',
                color: '#ffffff',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 22px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload Application
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Global unhandled error handler
window.addEventListener('error', (event) => {
  console.error('Global window error:', event.error || event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
})

const rootEl = document.getElementById('root')
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <RootErrorBoundary>
        <ThemeProvider>
          <ToastProvider>
            <HashRouter>
              <App />
            </HashRouter>
          </ToastProvider>
        </ThemeProvider>
      </RootErrorBoundary>
    </StrictMode>,
  )
}
