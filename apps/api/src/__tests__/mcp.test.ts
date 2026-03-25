import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoist mock functions
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockGetCompany: vi.fn(),
  mockListBatches: vi.fn(),
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

import type { Company } from '@yc-mcp/shared'

// We test the tool callbacks by calling them through the MCP server's
// callTool method, which exercises the registered handler bodies.
import { mcpServer } from '../mcp.js'

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    slug: 'test-co',
    name: 'Test Co',
    batch: 'Spring 26',
    category: 'AI',
    description: 'A company',
    founders: {},
    scrapedAt: '2024-01-15T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.mockQuery.mockResolvedValue([])
  mocks.mockGetCompany.mockResolvedValue(undefined)
  mocks.mockListBatches.mockResolvedValue([])
})

// ---------------------------------------------------------------------------
// list_batches tool
// ---------------------------------------------------------------------------

describe('MCP tool: list_batches', () => {
  it('returns batches from the repository', async () => {
    mocks.mockListBatches.mockResolvedValue(['Spring 26', 'Winter 25'])

    // @ts-expect-error — _registeredTools is internal but accessible for testing
    const tool = mcpServer._registeredTools?.list_batches
    const result = await tool?.handler({})

    expect(mocks.mockListBatches).toHaveBeenCalled()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.success).toBe(true)
    expect(parsed.data).toEqual(['Spring 26', 'Winter 25'])
  })

  it('returns empty list when no batches', async () => {
    mocks.mockListBatches.mockResolvedValue([])

    // @ts-expect-error — internal access for testing
    const tool = mcpServer._registeredTools?.list_batches
    const result = await tool?.handler({})

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.data).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// get_companies tool
// ---------------------------------------------------------------------------

describe('MCP tool: get_companies', () => {
  it('returns companies for a batch', async () => {
    const companies = [makeCompany(), makeCompany({ slug: 'other-co' })]
    mocks.mockQuery.mockResolvedValue(companies)

    // @ts-expect-error — internal access for testing
    const tool = mcpServer._registeredTools?.get_companies
    const result = await tool?.handler({ batch: 'Spring 26' })

    expect(mocks.mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({ batch: 'Spring 26' }),
    )
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.success).toBe(true)
    expect(parsed.data).toHaveLength(2)
  })

  it('returns empty results when query returns nothing', async () => {
    mocks.mockQuery.mockResolvedValue([])

    // @ts-expect-error — internal access for testing
    const tool = mcpServer._registeredTools?.get_companies
    const result = await tool?.handler({ category: 'Fintech' })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.data).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// get_company tool
// ---------------------------------------------------------------------------

describe('MCP tool: get_company', () => {
  it('returns company data when found', async () => {
    const company = makeCompany({ slug: 'airbnb', batch: 'Winter 09' })
    mocks.mockGetCompany.mockResolvedValue(company)

    // @ts-expect-error — internal access for testing
    const tool = mcpServer._registeredTools?.get_company
    const result = await tool?.handler({ batch: 'Winter 09', slug: 'airbnb' })

    expect(mocks.mockGetCompany).toHaveBeenCalledWith('Winter 09', 'airbnb')
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.success).toBe(true)
    expect(parsed.data.slug).toBe('airbnb')
  })

  it('returns not-found response when company does not exist', async () => {
    mocks.mockGetCompany.mockResolvedValue(undefined)

    // @ts-expect-error — internal access for testing
    const tool = mcpServer._registeredTools?.get_company
    const result = await tool?.handler({ batch: 'Spring 26', slug: 'missing' })

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.ok).toBe(false)
    expect(parsed.error).toBe('Company not found')
  })
})
