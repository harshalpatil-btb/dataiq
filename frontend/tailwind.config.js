// dealiq/frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sora: ['var(--font-sora)', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg:    '#f6f5f2',
        bg2:   '#eeecea',
        ink:   '#111119',
        ink2:  '#2e2e3a',
        mu:    '#8a8899',
        mu2:   '#b5b3c1',
        ac:    '#3d5afe',
        ac2:   '#536dfe',
        gr:    '#16a34a',
        am:    '#d97706',
        rd:    '#dc2626',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: 0, transform: 'translateY(16px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        slideUp: {
          from: { transform: 'translateY(100%)' },
          to:   { transform: 'translateY(0)' },
        },
        shimmer: {
          from: { backgroundPosition: '-400px 0' },
          to:   { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease both',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1)',
        'shimmer': 'shimmer 1.4s infinite',
      },
    },
  },
  plugins: [],
}
