import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        ink: '#101828',
        mist: '#f4f7fb',
        brand: '#1d4ed8',
        accent: '#0f766e'
      },
      boxShadow: {
        soft: '0 10px 40px rgba(15, 23, 42, 0.08)'
      }
    }
  },
  plugins: []
};

export default config;
