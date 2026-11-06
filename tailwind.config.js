/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const shades = [950, 900, 850, 800, 750, 700, 600, 500, 400, 300, 200, 100];

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // neutral scale, mirrored between the dark and light themes (100 = strongest ink)
        ink: Object.fromEntries(shades.map((s) => [s, v(`ink-${s}`)])),
        state: v('c-state'),
        axis: v('c-axis'),
        phase: v('c-phase'),
        p0: v('c-p0'),
        p1: v('c-p1'),
        good: v('c-good'),
        bad: v('c-bad'),
      },
      fontFamily: {
        // reading text and UI copy are set in a text serif that sits well next to KaTeX's Computer Modern
        sans: ['"Source Serif 4 Variable"', '"Source Serif 4"', 'Georgia', 'serif'],
        serif: ['"Source Serif 4 Variable"', '"Source Serif 4"', 'Georgia', 'serif'],
        // instrument labels, numbers and controls
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        panel: '0 0 0 0 transparent',
        float: '0 18px 50px -20px rgb(0 0 0 / 0.45)',
      },
    },
  },
  plugins: [],
};
