/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        fire: {
          1: '#ff4400',
          2: '#ff8800',
          3: '#ffcc00',
        },
        ash: '#1a1a1a',
        smoke: '#2d2d2d',
        ember: '#3d2010',
      },
      fontFamily: {
        bebas: ['Bebas Neue', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      animation: {
        'rise': 'rise 3s linear infinite',
        'flicker': 'flicker 2s ease-in-out infinite',
        'pulse-fire': 'pulse-fire 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
