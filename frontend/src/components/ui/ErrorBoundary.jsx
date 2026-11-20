import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Button from './Button';

/**
 * React Error Boundary component to prevent blank screen crashes.
 * Catches rendering exceptions and presents a recoverable UI state.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught error]', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          resetError: this.handleReset,
        });
      }

      return (
        <div
          role="alert"
          style={{
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            textAlign: 'center',
            background: 'var(--bg-base, #0f111a)',
            color: 'var(--text-primary, #f1f5f9)',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.12)',
              color: 'var(--accent-danger, #ef4444)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <AlertTriangle size={28} />
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px 0' }}>
            Something went wrong
          </h3>
          <p
            style={{
              fontSize: '0.9rem',
              color: 'var(--text-secondary, #94a3b8)',
              maxWidth: 460,
              lineHeight: 1.5,
              margin: '0 0 24px 0',
            }}
          >
            An unexpected error occurred while rendering this component. You can reload the page or return to the dashboard.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button variant="primary" onClick={this.handleReload}>
              <RefreshCw size={15} style={{ marginRight: 6 }} /> Reload Page
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                this.handleReset();
                window.location.href = '/dashboard';
              }}
            >
              <Home size={15} style={{ marginRight: 6 }} /> Go to Dashboard
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
