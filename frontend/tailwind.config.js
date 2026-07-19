/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#0b0d12',
        panel: '#12151c',
        line: '#1f242e',
        accent: '#6366f1',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Thai', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
