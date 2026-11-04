/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#07080b',
          900: '#0b0d12',
          850: '#0f1218',
          800: '#141820',
          750: '#191e28',
          700: '#1f2531',
          600: '#2a3142',
          500: '#3b4458',
          400: '#5b6478',
          300: '#8b93a7',
          200: '#b8bfcd',
          100: '#e3e6ec',
        },
        state: '#7cc4ff',
        axis: '#c49bff',
        phase: '#f2c14e',
        p0: '#4fd1c5',
        p1: '#f78c6c',
        good: '#6ee7a8',
        bad: '#ff8a8a',
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 10px 30px -12px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
