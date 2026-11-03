/**
 * LogicBridge Design Tokens
 * Consolidated design tokens matching CSS custom properties in index.css.
 */

export const tokens = {
  colors: {
    bg: {
      base: 'var(--bg-base)',
      surface: 'var(--bg-surface)',
      elevated: 'var(--bg-elevated)',
      card: 'var(--bg-card)',
      overlay: 'var(--bg-overlay)',
    },
    text: {
      primary: 'var(--text-primary)',
      secondary: 'var(--text-secondary)',
      muted: 'var(--text-muted)',
      disabled: 'var(--text-disabled)',
      accent: 'var(--text-accent)',
      inverse: 'var(--text-inverse)',
    },
    border: {
      default: 'var(--border)',
      subtle: 'var(--border-subtle)',
      strong: 'var(--border-strong)',
      hover: 'var(--border-hover)',
      focus: 'var(--border-focus)',
    },
    accent: {
      primary: 'var(--accent-primary)',
      secondary: 'var(--accent-secondary)',
      gradient: 'var(--accent-gradient)',
      glow: 'var(--accent-glow)',
    },
    status: {
      success: {
        color: 'var(--color-success)',
        bg: 'var(--color-success-bg)',
        border: 'var(--color-success-border)',
        text: 'var(--color-success-text)',
      },
      warning: {
        color: 'var(--color-warning)',
        bg: 'var(--color-warning-bg)',
        border: 'var(--color-warning-border)',
        text: 'var(--color-warning-text)',
      },
      danger: {
        color: 'var(--color-danger)',
        bg: 'var(--color-danger-bg)',
        border: 'var(--color-danger-border)',
        text: 'var(--color-danger-text)',
      },
      info: {
        color: 'var(--color-info)',
        bg: 'var(--color-info-bg)',
        border: 'var(--color-info-border)',
        text: 'var(--color-info-text)',
      },
    },
  },
  spacing: {
    '3xs': 'var(--space-3xs, 2px)',
    '2xs': 'var(--space-2xs, 4px)',
    xs: 'var(--space-xs, 6px)',
    sm: 'var(--space-sm, 8px)',
    md: 'var(--space-md, 12px)',
    lg: 'var(--space-lg, 16px)',
    xl: 'var(--space-xl, 20px)',
    '2xl': 'var(--space-2xl, 24px)',
    '3xl': 'var(--space-3xl, 32px)',
    '4xl': 'var(--space-4xl, 48px)',
  },
  typography: {
    fontFamilies: {
      body: "'Inter', system-ui, sans-serif",
      display: "'Space Grotesk', sans-serif",
      mono: "var(--font-mono, monospace)",
    },
    sizes: {
      '2xs': 'var(--font-2xs, 0.6875rem)',
      xs: 'var(--font-xs, 0.75rem)',
      sm: 'var(--font-sm, 0.8125rem)',
      base: 'var(--font-base, 0.875rem)',
      md: 'var(--font-md, 0.9375rem)',
      lg: 'var(--font-lg, 1.0625rem)',
      xl: 'var(--font-xl, 1.25rem)',
      '2xl': 'var(--font-2xl, 1.5rem)',
      '3xl': 'var(--font-3xl, 1.875rem)',
    },
    weights: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
  },
  radii: {
    xs: 'var(--radius-xs, 4px)',
    sm: 'var(--radius-sm, 8px)',
    md: 'var(--radius-md, 12px)',
    lg: 'var(--radius-lg, 16px)',
    xl: 'var(--radius-xl, 24px)',
    full: 'var(--radius-full, 9999px)',
  },
  shadows: {
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
    glow: 'var(--shadow-glow)',
  },
  focus: {
    ring: 'var(--focus-ring, 0 0 0 2px var(--accent-primary))',
    ringColor: 'var(--accent-primary)',
  },
  transitions: {
    fast: 'var(--transition, 0.2s cubic-bezier(0.4, 0, 0.2, 1))',
    slow: 'var(--transition-slow, 0.4s cubic-bezier(0.4, 0, 0.2, 1))',
  },
};

export default tokens;

