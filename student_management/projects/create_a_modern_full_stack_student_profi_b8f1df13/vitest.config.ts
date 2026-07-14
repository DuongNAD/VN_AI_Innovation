/**
 * Vitest configuration for the Student Profile System.
 *
 * The project has THREE test surfaces spread across TWO environments:
 *   1. Pure validation logic  (src/lib/validation.test.ts)        — node
 *   2. API route-handler tests (src/app/api/students/route.test.ts) — node
 *   3. Component a11y behavior (src/components/*.dom.test.tsx)      — jsdom
 *
 * ENVIRONMENT SELECTION: the default environment is `node`, which keeps the
 * pure-logic and route-handler suites fast (they need no DOM). The two
 * component suites end in `.dom.test.tsx`; `environmentMatchGlobs` routes just
 * those files to `jsdom` so React can render and the hand-written a11y
 * behaviors (focus trap, focus restore, validate-on-blur) can be exercised.
 *
 * PATH ALIAS: the `@` alias resolves to the `src` directory, mirroring the
 * `paths` mapping in tsconfig.json and Next.js. This lets the route handlers
 * and their tests import '@/lib/prisma' and '@/app/...' identically to how the
 * app does — critical so `vi.mock('@/lib/prisma')` intercepts the same module
 * specifier the handlers import.
 *
 * SETUP: `setupFiles` runs src/test/setup.ts before each test file, which
 * registers the @testing-library/jest-dom matchers used by the jsdom suites.
 * It is harmless for the node suites, which simply never use those matchers.
 *
 * INCLUDE: the glob set must cover BOTH `.test.ts` (validation, route) and
 * `.test.tsx` (component) files so every surface is discovered by
 * `npm run test` (vitest run). The `jsdom` package is installed per
 * package.json devDependencies, satisfying the jsdom environment requirement.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    // Expose describe/it/expect/vi globally so test files need no per-file
    // imports of the Vitest API (the suites still import them explicitly,
    // which is compatible with globals being enabled).
    globals: true,
    // Default environment for the pure-logic and route-handler suites.
    environment: 'node',
    // Route only the component behavior tests to jsdom so React can render.
    environmentMatchGlobs: [['src/**/*.dom.test.tsx', 'jsdom']],
    // Registers jest-dom matchers ahead of the jsdom component suites.
    setupFiles: ['./src/test/setup.ts'],
    // Discover both plain-TS and TSX test files across all three surfaces.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      // Mirror the tsconfig `@/*` -> `./src/*` mapping so imports resolve the
      // same way Next.js resolves them at build/runtime.
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});