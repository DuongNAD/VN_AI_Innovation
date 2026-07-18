import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a5f',
        },
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          900: '#78350f',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f8fafc',
          chat: '#f1f5f9',
          elevated: '#ffffff',
          border: '#e2e8f0',
        },
      },
      fontFamily: {
        serif: ['"Times New Roman"', 'Times', 'serif'],
      },
      fontSize: {
        body: ['1.0625rem', { lineHeight: '1.7', letterSpacing: '-0.005em' }],
        'body-lg': ['1.125rem', { lineHeight: '1.75', letterSpacing: '-0.01em' }],
        display: [
          'clamp(2rem, 4vw, 3.5rem)',
          { lineHeight: '1.12', letterSpacing: '-0.035em', fontWeight: '600' },
        ],
        title: ['1.25rem', { lineHeight: '1.35', letterSpacing: '-0.02em', fontWeight: '600' }],
        overline: [
          '0.7rem',
          { lineHeight: '1.2', letterSpacing: '0.08em', fontWeight: '700' },
        ],
      },
      letterSpacing: {
        display: '-0.035em',
        snugish: '-0.015em',
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
      },
      minHeight: {
        touch: '44px',
      },
      boxShadow: {
        shell: '0 10px 40px -12px rgb(15 23 42 / 0.12)',
        'shell-lg':
          '0 1px 0 0 rgb(255 255 255 / 0.7) inset, 0 18px 50px -20px rgb(30 58 95 / 0.18)',
        glow: '0 0 0 1px rgb(37 99 235 / 0.12), 0 12px 40px -12px rgb(37 99 235 / 0.35)',
        'glow-accent':
          '0 0 0 1px rgb(245 158 11 / 0.15), 0 10px 28px -10px rgb(217 119 6 / 0.35)',
      },
      backdropBlur: {
        glass: '16px',
      },
    },
  },
  plugins: [],
};

export default config;
