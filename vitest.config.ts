import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ['tests/**/*.spec.{ts,tsx}'],
    testTimeout: 30_000,
  },
})
