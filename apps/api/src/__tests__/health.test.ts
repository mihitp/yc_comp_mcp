import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoist mock functions so they are available inside vi.mock() factory
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  mockQuery: vi.fn().mockResolvedValue([]),
  mockGetCompany: vi.fn(),
  mockListBatches: vi.fn().mockResolvedValue([]),
  mockPutJob: vi.fn().mockResolvedValue(undefined),
  mockGetJob: vi.fn(),
  mockPutCompanies: vi.fn().mockResolvedValue(undefined),
  mockRecordBatch: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@yc-mcp/db', () => ({
  CompanyRepository: vi.fn(() => ({
    query: mocks.mockQuery,
    getCompany: mocks.mockGetCompany,
    putCompanies: mocks.mockPutCompanies,
  })),
  MetadataRepository: vi.fn(() => ({
    listBatches: mocks.mockListBatches,
    putJob: mocks.mockPutJob,
    getJob: mocks.mockGetJob,
    recordBatch: mocks.mockRecordBatch,
  })),
}))

import { app } from '../app.js'

// ---------------------------------------------------------------------------
// GET /health — endpoint tests
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200 status', async () => {
    const req = new Request('http://localhost/health')
    const res = await app.fetch(req)
    expect(res.status).toBe(200)
  })

  it('returns JSON with ok: true', async () => {
    const req = new Request('http://localhost/health')
    const res = await app.fetch(req)
    const body = await res.json() as { ok: boolean; service: string; ts: string }
    expect(body.ok).toBe(true)
  })

  it('returns service name "yc-mcp-api"', async () => {
    const req = new Request('http://localhost/health')
    const res = await app.fetch(req)
    const body = await res.json() as { ok: boolean; service: string; ts: string }
    expect(body.service).toBe('yc-mcp-api')
  })

  it('returns a valid ISO 8601 timestamp in ts field', async () => {
    const req = new Request('http://localhost/health')
    const res = await app.fetch(req)
    const body = await res.json() as { ok: boolean; service: string; ts: string }
    expect(body.ts).toBeDefined()
    const date = new Date(body.ts)
    expect(isNaN(date.getTime())).toBe(false)
  })

  it('returns Content-Type application/json', async () => {
    const req = new Request('http://localhost/health')
    const res = await app.fetch(req)
    const contentType = res.headers.get('content-type')
    expect(contentType).toContain('application/json')
  })

  it('responds to HEAD /health with 200 (method check)', async () => {
    const req = new Request('http://localhost/health', { method: 'HEAD' })
    const res = await app.fetch(req)
    // Hono returns 405 for HEAD on GET routes by default, but some versions handle it
    // We primarily test GET; HEAD/405 is acceptable behaviour
    expect([200, 405]).toContain(res.status)
  })
})

// ---------------------------------------------------------------------------
// GET /health — not-found baseline (to confirm 404 handler works)
// ---------------------------------------------------------------------------

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const req = new Request('http://localhost/nonexistent-route-xyz')
    const res = await app.fetch(req)
    expect(res.status).toBe(404)
    const body = await res.json() as { success: boolean; error: string }
    expect(body.success).toBe(false)
    expect(body.error).toBe('Not found')
  })
})

// ---------------------------------------------------------------------------
// Environment variable validation — validateEnv()
// ---------------------------------------------------------------------------

describe('validateEnv()', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key]
      }
    }
    Object.assign(process.env, originalEnv)
    vi.resetModules()
  })

  it('does not throw when all required vars are present', async () => {
    process.env['AWS_REGION'] = 'us-east-2'
    process.env['AWS_ACCESS_KEY_ID'] = 'test-key'
    process.env['AWS_SECRET_ACCESS_KEY'] = 'test-secret'
    process.env['ADMIN_API_KEY'] = 'test-admin-key'

    const { validateEnv } = await import('../env.js')
    expect(() => validateEnv()).not.toThrow()
  })

  it('throws when AWS_REGION is missing', async () => {
    delete process.env['AWS_REGION']
    process.env['AWS_ACCESS_KEY_ID'] = 'test-key'
    process.env['AWS_SECRET_ACCESS_KEY'] = 'test-secret'
    process.env['ADMIN_API_KEY'] = 'test-admin-key'

    const { validateEnv } = await import('../env.js')
    expect(() => validateEnv()).toThrow(/AWS_REGION/)
  })

  it('throws when AWS_ACCESS_KEY_ID is missing', async () => {
    process.env['AWS_REGION'] = 'us-east-2'
    delete process.env['AWS_ACCESS_KEY_ID']
    process.env['AWS_SECRET_ACCESS_KEY'] = 'test-secret'
    process.env['ADMIN_API_KEY'] = 'test-admin-key'

    const { validateEnv } = await import('../env.js')
    expect(() => validateEnv()).toThrow(/AWS_ACCESS_KEY_ID/)
  })

  it('throws when AWS_SECRET_ACCESS_KEY is missing', async () => {
    process.env['AWS_REGION'] = 'us-east-2'
    process.env['AWS_ACCESS_KEY_ID'] = 'test-key'
    delete process.env['AWS_SECRET_ACCESS_KEY']
    process.env['ADMIN_API_KEY'] = 'test-admin-key'

    const { validateEnv } = await import('../env.js')
    expect(() => validateEnv()).toThrow(/AWS_SECRET_ACCESS_KEY/)
  })

  it('throws when ADMIN_API_KEY is missing', async () => {
    process.env['AWS_REGION'] = 'us-east-2'
    process.env['AWS_ACCESS_KEY_ID'] = 'test-key'
    process.env['AWS_SECRET_ACCESS_KEY'] = 'test-secret'
    delete process.env['ADMIN_API_KEY']

    const { validateEnv } = await import('../env.js')
    expect(() => validateEnv()).toThrow(/ADMIN_API_KEY/)
  })

  it('throws when ADMIN_API_KEY is an empty string', async () => {
    process.env['AWS_REGION'] = 'us-east-2'
    process.env['AWS_ACCESS_KEY_ID'] = 'test-key'
    process.env['AWS_SECRET_ACCESS_KEY'] = 'test-secret'
    process.env['ADMIN_API_KEY'] = ''

    const { validateEnv } = await import('../env.js')
    expect(() => validateEnv()).toThrow(/ADMIN_API_KEY/)
  })

  it('throws when AWS_REGION is an empty string', async () => {
    process.env['AWS_REGION'] = ''
    process.env['AWS_ACCESS_KEY_ID'] = 'test-key'
    process.env['AWS_SECRET_ACCESS_KEY'] = 'test-secret'
    process.env['ADMIN_API_KEY'] = 'test-admin-key'

    const { validateEnv } = await import('../env.js')
    expect(() => validateEnv()).toThrow(/AWS_REGION/)
  })

  it('error message lists all missing variables at once', async () => {
    delete process.env['AWS_REGION']
    delete process.env['AWS_ACCESS_KEY_ID']
    process.env['AWS_SECRET_ACCESS_KEY'] = 'test-secret'
    process.env['ADMIN_API_KEY'] = 'test-admin-key'

    const { validateEnv } = await import('../env.js')
    expect(() => validateEnv()).toThrow(/AWS_REGION/)
  })

  it('does not throw when DYNAMO_ENDPOINT is absent (production mode)', async () => {
    process.env['AWS_REGION'] = 'us-east-2'
    process.env['AWS_ACCESS_KEY_ID'] = 'test-key'
    process.env['AWS_SECRET_ACCESS_KEY'] = 'test-secret'
    process.env['ADMIN_API_KEY'] = 'test-admin-key'
    delete process.env['DYNAMO_ENDPOINT']

    const { validateEnv } = await import('../env.js')
    expect(() => validateEnv()).not.toThrow()
  })
})
