import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Hoist mock functions
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  mockQuery: vi.fn().mockResolvedValue([]),
  mockGetCompany: vi.fn(),
  mockListBatches: vi.fn().mockResolvedValue([]),
}))

vi.mock('@yc-mcp/db', () => ({
  CompanyRepository: vi.fn(() => ({
    query: mocks.mockQuery,
    getCompany: mocks.mockGetCompany,
  })),
  MetadataRepository: vi.fn(() => ({
    listBatches: mocks.mockListBatches,
  })),
}))

// Import after mocks are set up
import { app } from '../app.js'
import type { Company } from '@yc-mcp/shared'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    slug: 'test-company',
    name: 'Test Company',
    batch: 'Spring 26',
    category: 'AI',
    description: 'A test company',
    founders: {},
    scrapedAt: '2024-01-15T10:00:00.000Z',
    ...overrides,
  }
}

function get(path: string): Request {
  return new Request(`http://localhost${path}`)
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.resetAllMocks()
  mocks.mockQuery.mockResolvedValue([])
  mocks.mockGetCompany.mockResolvedValue(undefined)
  mocks.mockListBatches.mockResolvedValue([])
})

// ---------------------------------------------------------------------------
// GET /companies
// ---------------------------------------------------------------------------

describe('GET /companies', () => {
  it('returns 400 when no batch or category provided', async () => {
    const res = await app.fetch(get('/companies'))
    expect(res.status).toBe(400)
    const body = await res.json() as { success: boolean; error: string }
    expect(body.success).toBe(false)
  })

  it('returns 400 for limit=0', async () => {
    const res = await app.fetch(get('/companies?batch=Spring+26&limit=0'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for limit above 500', async () => {
    const res = await app.fetch(get('/companies?batch=Spring+26&limit=501'))
    expect(res.status).toBe(400)
  })

  it('returns 200 with results for batch query', async () => {
    const companies = [makeCompany(), makeCompany({ slug: 'another-company' })]
    mocks.mockQuery.mockResolvedValue(companies)
    const res = await app.fetch(get('/companies?batch=Spring+26'))
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; data: Company[] }
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(2)
  })

  it('returns 200 with results for category query', async () => {
    const companies = [makeCompany({ category: 'Fintech' })]
    mocks.mockQuery.mockResolvedValue(companies)
    const res = await app.fetch(get('/companies?category=Fintech'))
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; data: Company[] }
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
  })

  it('passes parsed params to query', async () => {
    mocks.mockQuery.mockResolvedValue([])
    await app.fetch(get('/companies?batch=Spring+26&category=AI&limit=50'))
    expect(mocks.mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({ batch: 'Spring 26', category: 'AI', limit: 50 }),
    )
  })

  it('defaults limit to 100 when not specified', async () => {
    mocks.mockQuery.mockResolvedValue([])
    await app.fetch(get('/companies?batch=Spring+26'))
    expect(mocks.mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
    )
  })

  it('returns 200 with empty data when no results', async () => {
    mocks.mockQuery.mockResolvedValue([])
    const res = await app.fetch(get('/companies?batch=Spring+26'))
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; data: Company[] }
    expect(body.data).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// GET /companies/batches
// ---------------------------------------------------------------------------

describe('GET /companies/batches', () => {
  it('returns 200 with empty list', async () => {
    mocks.mockListBatches.mockResolvedValue([])
    const res = await app.fetch(get('/companies/batches'))
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; data: string[] }
    expect(body.success).toBe(true)
    expect(body.data).toEqual([])
  })

  it('returns 200 with batch list', async () => {
    mocks.mockListBatches.mockResolvedValue(['Spring 26', 'Winter 25'])
    const res = await app.fetch(get('/companies/batches'))
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; data: string[] }
    expect(body.data).toEqual(['Spring 26', 'Winter 25'])
  })
})

// ---------------------------------------------------------------------------
// GET /companies/:batch/:slug
// ---------------------------------------------------------------------------

describe('GET /companies/:batch/:slug', () => {
  it('returns 200 when company found', async () => {
    const company = makeCompany()
    mocks.mockGetCompany.mockResolvedValue(company)
    const res = await app.fetch(get('/companies/Spring%2026/test-company'))
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; data: Company }
    expect(body.success).toBe(true)
    expect(body.data.slug).toBe('test-company')
  })

  it('returns 404 when company not found', async () => {
    mocks.mockGetCompany.mockResolvedValue(undefined)
    const res = await app.fetch(get('/companies/Spring%2026/missing-company'))
    expect(res.status).toBe(404)
    const body = await res.json() as { success: boolean; error: string }
    expect(body.success).toBe(false)
    expect(body.error).toBe('Company not found')
  })

  it('passes batch and slug to getCompany', async () => {
    mocks.mockGetCompany.mockResolvedValue(undefined)
    await app.fetch(get('/companies/Spring%2026/openai'))
    expect(mocks.mockGetCompany).toHaveBeenCalledWith('Spring 26', 'openai')
  })
})
