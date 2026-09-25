/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        ink: {
          950: '#09090b',
          900: '#0e0e11',
          850: '#131317',
          800: '#18181c',
        },
        accent: {
          DEFAULT: '#9aa5ff',
          soft: '#9aa5ff1a',
          strong: '#b8c0ff',
        },
        gain: '#5fd3a4',
        loss: '#f28b8b',
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 20px 40px -24px rgba(0,0,0,0.8)',
        pop: '0 24px 60px -20px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.06)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'none' } },
        'grow-x': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'grow-x': 'grow-x 700ms cubic-bezier(.2,.8,.2,1)',
      },
    },
  },
  plugins: [],
};
