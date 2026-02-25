export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        panel: {
          light: '#ffffff',
          dark: '#1a1f2e',
          'dark-hover': '#242937',
          border: '#e2e8f0',
          'border-dark': '#2d3348',
        },
      },
      fontSize: {
        '2xs': '0.625rem',
        'fluid-xs': 'clamp(0.625rem, 0.55rem + 0.15vw, 0.75rem)',
        'fluid-sm': 'clamp(0.75rem, 0.7rem + 0.15vw, 0.875rem)',
        'fluid-base': 'clamp(0.875rem, 0.8rem + 0.2vw, 1rem)',
        'fluid-lg': 'clamp(1.125rem, 1rem + 0.3vw, 1.375rem)',
        'fluid-xl': 'clamp(1.25rem, 1.1rem + 0.4vw, 1.625rem)',
      },
      borderRadius: {
        DEFAULT: '0.375rem',
        panel: '0.75rem',
        card: '0.625rem',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'fade-in-fast': 'fadeIn 0.15s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.2s ease-out',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
        'tab-content': 'tabContent 0.15s ease-out',
        'collapsible-open': 'collapsibleOpen 0.2s ease-out',
        'collapsible-close': 'collapsibleClose 0.15s ease-in',
        'view-enter': 'viewEnter 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(100%)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          from: { opacity: '0', transform: 'translateX(-100%)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        tabContent: {
          from: { opacity: '0', transform: 'translateY(2px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        collapsibleOpen: {
          from: { height: '0', opacity: '0' },
          to: { height: 'var(--radix-collapsible-content-height)', opacity: '1' },
        },
        collapsibleClose: {
          from: { height: 'var(--radix-collapsible-content-height)', opacity: '1' },
          to: { height: '0', opacity: '0' },
        },
        viewEnter: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
