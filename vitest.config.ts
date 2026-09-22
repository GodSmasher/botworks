import { defineConfig } from 'vitest/config'

// Single root config for every workspace. Tests live next to the code as
// `*.test.ts`; workspace packages resolve to their `src/index.ts` through the
// npm workspace links, so no build step is needed before running the suite.
export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
    environment: 'node',
    // Keep the runtime logger quiet; tests assert on return values, not logs.
    env: { LOG_LEVEL: 'error' },
  },
})
