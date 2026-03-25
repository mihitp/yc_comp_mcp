import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@yc-mcp/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@yc-mcp/db': path.resolve(__dirname, '../../packages/db/src/index.ts'),
      '@yc-mcp/scraper': path.resolve(__dirname, '../../packages/scraper/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/__tests__/**',
        // Entry-point bootstrapping files — no testable logic, just wiring
        'src/index.ts',
        'src/handler.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
})
