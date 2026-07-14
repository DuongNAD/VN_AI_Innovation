/**
 * PostCSS configuration.
 *
 * Enables the two plugins the styling pipeline relies on:
 * - `tailwindcss` processes the `@tailwind` directives in globals.css and
 *   generates the utility classes used across the app.
 * - `autoprefixer` adds vendor prefixes for broader browser support.
 *
 * @type {import('postcss-load-config').Config}
 */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;