import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f4f0ff',
          100: '#e9e0ff',
          200: '#d7c7ff',
          300: '#b99bff',
          400: '#956fe8',
          500: '#6d4bc3',
          600: '#5b3ca7',
          700: '#49308b',
          800: '#352465',
          900: '#241744'
        },
        ink: '#15121d'
      },
      boxShadow: {
        soft: '0 16px 45px rgba(36, 23, 68, 0.08)',
        card: '0 3px 16px rgba(36, 23, 68, 0.05)'
      }
    }
  },
  plugins: []
};

export default config;
