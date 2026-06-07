/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Loly Store identity (from the logo)
        rose: {
          DEFAULT: '#E85B9E',
          light: '#F49ABF',
          dark: '#D13B83',
        },
        pink: {
          DEFAULT: '#F8C8DC',
          soft: '#FCE7F0',
        },
        blush: '#FCE7F0',
        cream: '#FFF7F0',
        gold: {
          DEFAULT: '#D9A441',
          light: '#E9C877',
          dark: '#B9852A',
        },
        cocoa: {
          DEFAULT: '#6B4630',
          light: '#8A6A55',
        },
        ok: '#3FAE78',
        warn: '#E0A33C',
        danger: '#E5556E',
      },
      fontFamily: {
        sans: ['Cairo', 'system-ui', 'Segoe UI', 'Tahoma', 'sans-serif'],
        display: ['Tajawal', 'Cairo', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        soft: '0 4px 20px -8px rgba(209, 59, 131, 0.25)',
        card: '0 2px 12px -4px rgba(107, 70, 48, 0.12)',
      },
    },
  },
  plugins: [],
}
