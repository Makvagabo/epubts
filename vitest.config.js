// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    outputFile: {
      junit: './test-results.xml',
    },
  }
})