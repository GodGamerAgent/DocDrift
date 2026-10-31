/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        fg: token('fg'),
        muted: token('muted'),
        line: token('line'),
        'depth-edge': token('depth-edge'),
        accent: token('accent'),
        'accent-secondary': token('accent-secondary'),
        danger: token('danger'),
        warn: token('warn'),
        ok: token('ok'),
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
