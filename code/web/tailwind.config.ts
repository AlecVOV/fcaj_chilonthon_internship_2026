import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  darkMode: 'class',
  content: [
    './components/**/*.vue',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './app.vue',
    './error.vue',
  ],
  theme: {
    extend: {
      colors: {
        // Core Brand Colors
        'brand-orange': '#FF9900',
        'squid-ink': '#232F3E',
        'interactive-blue': '#006CE0',

        // Neutral Light Mode
        neutral: {
          100: '#F9F9FA',
          150: '#F6F6F9',
          200: '#F3F3F7',
          400: '#B4B4BB',
          950: '#0F141A',
        },

        // Dark Mode Surfaces
        dark: {
          bg: '#0A0A0F',
          surface: '#1A1A24',
          card: '#262630',
          border: '#3A3A44',
          text: '#F0F0F0',
        },

        // Semantic Status
        success: '#67A353',
        warning: '#CC5F21',
        critical: '#DB0000',

        // Dark-adapted semantic
        'success-dark': '#5A9147',
        'warning-dark': '#B8541E',
        'critical-dark': '#C70000',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '4px',
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(0, 0, 0, 0.05)',
        'subtle-lg': '0 2px 4px rgba(0, 0, 0, 0.06)',
        'subtle-dark': '0 1px 2px rgba(0, 0, 0, 0.2)',
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '0.9rem' }],
      },
    },
  },
}
