import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    alias: {
      '@': resolve(__dirname, './src'),
    },
    testTimeout: 30000,
    pool: 'forks',
    fileParallelism: false,
  },
});