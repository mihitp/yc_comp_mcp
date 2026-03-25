import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Hoist mock functions so they are available inside vi.mock() factory
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  mockPutJob: vi.fn().mockResolvedValue(undefined),
  mockGetJob: vi.fn(),
  mockListBatches: vi.fn().mockResolvedValue([]),
  mockPutCompanies: vi.fn().mockResolvedValue(undefined),
  mockRecordBatch: vi.fn().mockResolvedValue(undefined),
  mockScrapeBatch: vi.fn().mockResolvedValue([]),
}))

vi.mock('@yc-mcp/db', () => ({
  CompanyRepository: vi.fn(() => ({
    putCompanies: mocks.mockPutCompanies,
  })),
  MetadataRepository: vi.fn(() => ({
    putJob: mocks.mockPutJob,
    getJob: mocks.mockGetJob,
    listBatches: mocks.mockListBatches,
    recordBatch: mocks.mockRecordBatch,
  })),
}))

vi.mock('@yc-mcp/scraper', () => ({
  scrapeBatch: mocks.mockScrapeBatch,
}))

// Import after mocks are set up
import { app } from '../app.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_KEY = 'test-admin-key'

function makeRequest(
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: unknown } = {},
): Request {
  const url = `http://localhost${path}`
  const { method = 'GET', headers = {}, body } = options
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function adminRequest(
  path: string,
  options: { method?: string; body?: unknown; useQueryParam?: boolean } = {},
): Request {
  const { method = 'GET', body, useQueryParam = false } = options
  const url = useQueryParam
    ? `http://localhost${path}?adminKey=${ADMIN_KEY}`
    : `http://localhost${path}`
  return new Request(url, {
    method,
    headers: useQueryParam
      ? { 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks()
  mocks.mockPutJob.mockResolvedValue(undefined)
  mocks.mockGetJob.mockResolvedValue(undefined)
  mocks.mockListBatches.mockResolvedValue([])
  mocks.mockPutCompanies.mockResolvedValue(undefined)
  mocks.mockRecordBatch.mockResolvedValue(undefined)
  mocks.mockScrapeBatch.mockResolvedValue([])
  process.env['ADMIN_API_KEY'] = ADMIN_KEY
})

// ---------------------------------------------------------------------------
// Authentication tests
// ---------------------------------------------------------------------------

describe('Admin authentication', () => {
  it('returns 401 without auth header', async () => {
    const req = makeRequest('/admin/batches')
    const res = await app.fetch(req)
    expect(res.status).toBe(401)
    const body = await res.json() as { success: boolean; error: string }
    expect(body.success).toBe(false)
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 with wrong API key', async () => {
    const req = makeRequest('/admin/batches', {
      headers: { 'x-admin-key': 'wrong-key' },
    })
    const res = await app.fetch(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 with wrong query param key', async () => {
    const req = makeRequest('/admin/batches?adminKey=wrong-key')
    const res = await app.fetch(req)
    expect(res.status).toBe(401)
  })

  it('accepts x-admin-key header', async () => {
    const req = makeRequest('/admin/batches', {
      headers: { 'x-admin-key': ADMIN_KEY },
    })
    const res = await app.fetch(req)
    expect(res.status).toBe(200)
  })

  it('accepts adminKey query param', async () => {
    const req = makeRequest(`/admin/batches?adminKey=${ADMIN_KEY}`)
    const res = await app.fetch(req)
    expect(res.status).toBe(200)
  })

  it('returns 401 when ADMIN_API_KEY env var is not set', async () => {
    delete process.env['ADMIN_API_KEY']
    const req = makeRequest('/admin/batches', {
      headers: { 'x-admin-key': ADMIN_KEY },
    })
    const res = await app.fetch(req)
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// POST /admin/scrape — input validation
// ---------------------------------------------------------------------------

describe('POST /admin/scrape — input validation', () => {
  it('returns 400 for invalid season "Autumn"', async () => {
    const req = adminRequest('/admin/scrape', {
      method: 'POST',
      body: { season: 'Autumn', year: '26' },
    })
    const res = await app.fetch(req)
    expect(res.status).toBe(400)
    const body = await res.json() as { success: boolean; error: string }
    expect(body.success).toBe(false)
  })

  it('returns 400 for invalid year 2026 (must be 2-digit string)', async () => {
    const req = adminRequest('/admin/scrape', {
      method: 'POST',
      body: { season: 'Spring', year: '2026' },
    })
    const res = await app.fetch(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing season', async () => {
    const req = adminRequest('/admin/scrape', {
      method: 'POST',
      body: { year: '26' },
    })
    const res = await app.fetch(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing year', async () => {
    const req = adminRequest('/admin/scrape', {
      method: 'POST',
      body: { season: 'Spring' },
    })
    const res = await app.fetch(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid JSON body', async () => {
    const url = `http://localhost/admin/scrape`
    const req = new Request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': ADMIN_KEY,
      },
      body: 'not valid json {{{',
    })
    const res = await app.fetch(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for null body', async () => {
    const req = adminRequest('/admin/scrape', {
      method: 'POST',
      body: null,
    })
    const res = await app.fetch(req)
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// POST /admin/scrape — success (RED before fix, GREEN after fix)
// ---------------------------------------------------------------------------

describe('POST /admin/scrape — success', () => {
  it('returns 202 with jobId on valid request', async () => {
    const req = adminRequest('/admin/scrape', {
      method: 'POST',
      body: { season: 'Spring', year: '26' },
    })
    const res = await app.fetch(req)
    expect(res.status).toBe(202)
    const body = await res.json() as { success: boolean; data: { jobId: string; status: string } }
    expect(body.success).toBe(true)
    expect(body.data.jobId).toBeDefined()
    expect(body.data.status).toBe('pending')
  })

  it('jobId is a valid UUID', async () => {
    const req = adminRequest('/admin/scrape', {
      method: 'POST',
      body: { season: 'Winter', year: '25' },
    })
    const res = await app.fetch(req)
    expect(res.status).toBe(202)
    const body = await res.json() as { success: boolean; data: { jobId: string } }
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    expect(body.data.jobId).toMatch(uuidRegex)
  })

  it('calls putJob with a valid ScrapeJob', async () => {
    const req = adminRequest('/admin/scrape', {
      method: 'POST',
      body: { season: 'Fall', year: '24', enrichDetails: true },
    })
    const res = await app.fetch(req)
    expect(res.status).toBe(202)
    expect(mocks.mockPutJob).toHaveBeenCalled()
    const jobArg = mocks.mockPutJob.mock.calls[0]?.[0] as {
      id: string
      season: string
      year: number
      status: string
    }
    expect(jobArg.season).toBe('Fall')
    expect(jobArg.year).toBe(24)
    expect(jobArg.status).toBe('pending')
  })

  it('runs scrape asynchronously (does not block response)', async () => {
    // scrapeBatch returns a delayed promise; the 202 response should come immediately
    mocks.mockScrapeBatch.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 1000)),
    )
    const req = adminRequest('/admin/scrape', {
      method: 'POST',
      body: { season: 'Spring', year: '26' },
    })
    const start = Date.now()
    const res = await app.fetch(req)
    const elapsed = Date.now() - start
    expect(res.status).toBe(202)
    expect(elapsed).toBeLessThan(500)
  })
})

// ---------------------------------------------------------------------------
// GET /admin/scrape/:jobId
// ---------------------------------------------------------------------------

describe('GET /admin/scrape/:jobId', () => {
  it('returns 404 when job not found', async () => {
    mocks.mockGetJob.mockResolvedValue(undefined)
    const req = adminRequest('/admin/scrape/nonexistent-id')
    const res = await app.fetch(req)
    expect(res.status).toBe(404)
    const body = await res.json() as { success: boolean; error: string }
    expect(body.success).toBe(false)
    expect(body.error).toBe('Job not found')
  })

  it('returns job when found', async () => {
    const job = {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      season: 'Spring',
      year: 26,
      status: 'running',
      createdAt: '2024-01-15T10:00:00.000Z',
      updatedAt: '2024-01-15T10:00:00.000Z',
    }
    mocks.mockGetJob.mockResolvedValue(job)
    const req = adminRequest('/admin/scrape/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    const res = await app.fetch(req)
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; data: typeof job }
    expect(body.success).toBe(true)
    expect(body.data).toEqual(job)
  })

  it('passes the jobId to getJob', async () => {
    mocks.mockGetJob.mockResolvedValue(undefined)
    const jobId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const req = adminRequest(`/admin/scrape/${jobId}`)
    await app.fetch(req)
    expect(mocks.mockGetJob).toHaveBeenCalledWith(jobId)
  })
})

// ---------------------------------------------------------------------------
// POST /admin/scrape — background job completion and error paths
// These tests trigger runScrapeJob's internal branches by waiting for the
// async fire-and-forget to settle before asserting on putJob call args.
// ---------------------------------------------------------------------------

describe('POST /admin/scrape — background job paths', () => {
  it('transitions job to "running" and then "completed" after successful scrape', async () => {
    const companies = [
      { slug: 'co1', name: 'Co1', batch: 'Spring 26', category: 'AI', description: 'D', founders: {}, scrapedAt: new Date().toISOString() },
    ]
    mocks.mockScrapeBatch.mockResolvedValue(companies)

    const req = adminRequest('/admin/scrape', {
      method: 'POST',
      body: { season: 'Spring', year: '26' },
    })
    await app.fetch(req)

    // Allow microtasks/promises to flush so the background job completes
    await new Promise((r) => setTimeout(r, 50))

    const allCalls = mocks.mockPutJob.mock.calls.map(
      (c) => (c[0] as { status: string }).status,
    )
    expect(allCalls).toContain('pending')
    expect(allCalls).toContain('running')
    expect(allCalls).toContain('completed')
    expect(mocks.mockRecordBatch).toHaveBeenCalledWith('Spring 26')
    expect(mocks.mockPutCompanies).toHaveBeenCalledWith(companies)
  })

  it('triggers onProgress callback during scrape', async () => {
    mocks.mockScrapeBatch.mockImplementation(
      async (_season: string, _year: string, opts: { onProgress?: (scraped: number, total: number) => void }) => {
        opts.onProgress?.(5, 10)
        return []
      },
    )

    const req = adminRequest('/admin/scrape', {
      method: 'POST',
      body: { season: 'Winter', year: '25' },
    })
    await app.fetch(req)
    await new Promise((r) => setTimeout(r, 50))

    const statusCalls = mocks.mockPutJob.mock.calls.map(
      (c) => (c[0] as { status: string; processedCompanies?: number }).status,
    )
    // The onProgress call emits a "running" putJob
    expect(statusCalls.filter((s) => s === 'running').length).toBeGreaterThanOrEqual(1)
  })

  it('transitions job to "failed" when scrapeBatch throws', async () => {
    mocks.mockScrapeBatch.mockRejectedValue(new Error('Algolia API unreachable'))

    const req = adminRequest('/admin/scrape', {
      method: 'POST',
      body: { season: 'Fall', year: '24' },
    })
    await app.fetch(req)
    await new Promise((r) => setTimeout(r, 50))

    const allCalls = mocks.mockPutJob.mock.calls.map(
      (c) => (c[0] as { status: string }).status,
    )
    expect(allCalls).toContain('failed')
  })

  it('stores the error message in the failed job record', async () => {
    mocks.mockScrapeBatch.mockRejectedValue(new Error('Network timeout'))

    const req = adminRequest('/admin/scrape', {
      method: 'POST',
      body: { season: 'Summer', year: '23' },
    })
    await app.fetch(req)
    await new Promise((r) => setTimeout(r, 50))

    const failedCall = mocks.mockPutJob.mock.calls.find(
      (c) => (c[0] as { status: string }).status === 'failed',
    )
    expect(failedCall).toBeDefined()
    expect((failedCall![0] as { error: string }).error).toBe('Network timeout')
  })

  it('stores the string representation when a non-Error is thrown', async () => {
    mocks.mockScrapeBatch.mockRejectedValue('string error value')

    const req = adminRequest('/admin/scrape', {
      method: 'POST',
      body: { season: 'Spring', year: '22' },
    })
    await app.fetch(req)
    await new Promise((r) => setTimeout(r, 50))

    const failedCall = mocks.mockPutJob.mock.calls.find(
      (c) => (c[0] as { status: string }).status === 'failed',
    )
    expect(failedCall).toBeDefined()
    expect((failedCall![0] as { error: string }).error).toBe('string error value')
  })
})

// ---------------------------------------------------------------------------
// GET /admin/batches
// ---------------------------------------------------------------------------

describe('GET /admin/batches', () => {
  it('returns empty list when no batches', async () => {
    mocks.mockListBatches.mockResolvedValue([])
    const req = adminRequest('/admin/batches')
    const res = await app.fetch(req)
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; data: string[] }
    expect(body.success).toBe(true)
    expect(body.data).toEqual([])
  })

  it('returns batch list', async () => {
    mocks.mockListBatches.mockResolvedValue(['Spring 26', 'Winter 25', 'Fall 24'])
    const req = adminRequest('/admin/batches')
    const res = await app.fetch(req)
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; data: string[] }
    expect(body.success).toBe(true)
    expect(body.data).toEqual(['Spring 26', 'Winter 25', 'Fall 24'])
  })
})
