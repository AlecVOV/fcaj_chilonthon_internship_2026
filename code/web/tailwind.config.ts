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
        // ── Claude Design System: Brand ──
        primary: {
          DEFAULT: '#cc785c',       // Coral — signature Anthropic accent
          active: '#a9583e',         // Press / hover-darker
          disabled: '#e6dfd8',       // Desaturated cream-tinted disabled
        },

        // ── Claude Design System: Ink & Text ──
        ink: {
          DEFAULT: '#141413',        // Warm dark — all headlines & primary text
          body: '#3d3d3a',           // Running-text default
          strong: '#252523',         // Emphasized paragraphs
          muted: '#6c6a64',          // Sub-headings, secondary text
          soft: '#8e8b82',           // Captions, fine-print
        },

        // ── Claude Design System: Surfaces (Light / Cream) ──
        canvas: {
          DEFAULT: '#faf9f5',        // Page floor — tinted warm cream
          soft: '#f5f0e8',           // Section dividers
          card: '#efe9de',           // Feature cards — one step darker
          strong: '#e8e0d2',         // Strongest cream variant
        },

        // ── Claude Design System: Surfaces (Dark / Navy) ──
        'surface-dark': {
          DEFAULT: '#181715',         // Code mockups, footer, dark cards
          elevated: '#252320',        // Elevated panels inside dark bands
          soft: '#1f1e1b',            // Code block backgrounds
        },

        // ── Claude Design System: Hairlines ──
        hairline: {
          DEFAULT: '#e6dfd8',        // 1px border on cream — same as primary-disabled
          soft: '#ebe6df',           // Barely-visible internal divider
          dark: '#3d3a33',           // Warm dark-mode border
        },

        // ── Claude Design System: On-dark text ──
        'on-dark': {
          DEFAULT: '#faf9f5',        // Cream-tinted white on dark surfaces
          soft: '#a09d96',           // Footer body, secondary labels on dark
        },

        // ── Claude Design System: Accent ──
        accent: {
          teal: '#5db8a6',           // Terminal status, active-connection dots
          amber: '#e8a55a',          // Category badges, inline highlights
        },

        // ── Claude Design System: Semantic ──
        success: {
          DEFAULT: '#5db872',        // Green status
          muted: '#4a9b5e',          // Dark-adapted
        },
        warning: {
          DEFAULT: '#d4a017',        // Warning callouts
          muted: '#b88a14',          // Dark-adapted
        },
        error: {
          DEFAULT: '#c64545',        // Validation errors
          muted: '#b03a3a',          // Dark-adapted
        },
      },

      fontFamily: {
        // Display: slab-serif for headlines (Copernicus / Tiempos Headline fallbacks)
        display: [
          'Tiempos Headline',
          'Cormorant Garamond',
          'EB Garamond',
          'Garamond',
          'Times New Roman',
          'serif',
        ],
        // Body: humanist sans (StyreneB / Inter)
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        // Code: JetBrains Mono
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },

      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',                   // Standard for buttons & inputs
        lg: '12px',                  // Content cards, pricing, code-window
        xl: '16px',                  // Hero illustration container
        pill: '9999px',              // Badge pills, NEW tags
        full: '9999px',
      },

      fontSize: {
        'display-xl': ['4rem', { lineHeight: '1.05', letterSpacing: '-0.025em', fontWeight: '400' }],
        'display-lg': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '400' }],
        'display-md': ['2.25rem', { lineHeight: '1.15', letterSpacing: '-0.01em', fontWeight: '400' }],
        'display-sm': ['1.75rem', { lineHeight: '1.2', letterSpacing: '-0.005em', fontWeight: '400' }],
        '2xs': ['0.65rem', { lineHeight: '0.9rem' }],
      },

      spacing: {
        xxs: '4px',
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '48px',
        section: '96px',
      },
    },
  },
}
