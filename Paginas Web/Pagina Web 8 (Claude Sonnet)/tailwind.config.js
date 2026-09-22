/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'monospace'],
      },
      colors: {
        truck: {
          a: '#ef4444',
          b: '#06b6d4',
          empty: '#27272a',
        }
      },
      keyframes: {
        'pulse-warning': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'slide-in-bottom': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'pulse-warning': 'pulse-warning 1s ease-in-out infinite',
        'slide-in-bottom': 'slide-in-bottom 0.4s ease-out',
      },
    },
  },
  plugins: [],
}
