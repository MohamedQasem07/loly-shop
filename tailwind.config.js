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
        soft: '0 8px 28px -10px rgba(209, 59, 131, 0.30)',
        card: '0 4px 18px -8px rgba(107, 70, 48, 0.14)',
        glow: '0 0 0 4px rgba(232, 91, 158, 0.12)',
        lift: '0 14px 34px -12px rgba(209, 59, 131, 0.40)',
      },
      backgroundImage: {
        'rose-grad': 'linear-gradient(135deg, #F06CA8 0%, #D13B83 100%)',
        'gold-grad': 'linear-gradient(135deg, #E9C877 0%, #D9A441 100%)',
        'cream-grad': 'linear-gradient(180deg, #FFF7F0 0%, #FCE7F0 100%)',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        pop: { '0%': { transform: 'scale(.96)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
      },
      animation: {
        fadeIn: 'fadeIn .25s ease both',
        pop: 'pop .2s ease both',
        floaty: 'floaty 3.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
