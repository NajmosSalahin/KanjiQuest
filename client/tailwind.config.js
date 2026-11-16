/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        subtle: 'var(--bg-subtle)',
        ink: {
          primary: 'var(--ink-primary)',
          secondary: 'var(--ink-secondary)',
          muted: 'var(--ink-muted)',
        },
        line: {
          subtle: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
        },
        vermillion: {
          DEFAULT: 'var(--accent-vermillion)',
          hover: 'var(--accent-vermillion-hover)',
        },
        indigo: {
          DEFAULT: 'var(--accent-indigo)',
          hover: 'var(--accent-indigo-hover)',
        },
        matcha: 'var(--success-matcha)',
        persimmon: 'var(--warning-persimmon)',
        crimson: 'var(--danger-crimson)',
        focus: 'var(--focus-ring)',
      },
      // §12: text-only overrides keep the §3 palette for fills/borders while
      // giving small copy a 4.5:1 contrast ratio in light mode.
      textColor: {
        ink: { muted: 'var(--text-muted)' },
        matcha: 'var(--text-matcha)',
        persimmon: 'var(--text-persimmon)',
        'on-accent': 'var(--text-on-accent)',
        'on-bright': 'var(--text-on-bright)',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
        jp: ['"Noto Sans JP"', 'sans-serif'],
        'jp-serif': ['"Noto Serif JP"', 'serif'],
      },
      borderRadius: {
        control: '6px',
        card: '8px',
        modal: '12px',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      transitionDuration: {
        fast: '120ms',
        normal: '220ms',
        slow: '380ms',
        celebration: '800ms',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        in: 'var(--ease-in)',
      },
      maxWidth: {
        app: '1200px',
        dash: '720px',
        review: '640px',
        answer: '480px',
      },
    },
  },
  plugins: [],
};
