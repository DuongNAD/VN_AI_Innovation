import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';

/**
 * Tailwind CSS v3 configuration for the Student Profile System.
 *
 * Defines the design tokens the App Router UI relies on: a deep-navy "brand"
 * color ramp, the emerald/amber semantic accents, the two custom font
 * families (wired to the CSS variables next/font publishes in layout.tsx),
 * and the single `fade-in-up` entrance animation used for staggered card
 * reveals.
 *
 * CONTENT GLOB: `./src/**\/*.{ts,tsx}` covers every place a Tailwind class can
 * appear (routes, components, and any string literals such as the GPA-theme
 * classes built at runtime), so none of the `brand-*`/`fade-in-up` utilities
 * are stripped by the production purge.
 */
const config: Config = {
  // Scan all TypeScript/TSX sources under src so no utility class used by an
  // app route or component is purged in the production build.
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep navy "brand" ramp (50 -> 950). Used for surfaces, gradients,
        // and accents throughout the dashboard UI.
        brand: {
          50: '#f2f5fb',
          100: '#e2e8f4',
          200: '#c6d2e8',
          300: '#9db1d6',
          400: '#6d89bf',
          500: '#4a68a6',
          600: '#39518a',
          700: '#2f4270',
          800: '#2a385e',
          900: '#26314f',
          950: '#141a2e',
        },
        // Semantic accents reuse Tailwind's default palettes so their full
        // shade ranges stay available for success/warning styling.
        emerald: colors.emerald,
        amber: colors.amber,
      },
      fontFamily: {
        // Body/UI font: Inter, injected as a CSS variable by next/font.
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        // Display font: Outfit, falling back to Inter then a generic sans.
        display: ['var(--font-outfit)', 'var(--font-inter)', 'sans-serif'],
      },
      keyframes: {
        // Subtle entrance used for staggered card reveals.
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        // `both` keeps the element in its start state before and its end state
        // after the animation runs.
        'fade-in-up': 'fade-in-up 0.4s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;