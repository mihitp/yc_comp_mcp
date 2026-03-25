import { describe, it, expect } from 'vitest'
import {
  CompanySchema,
  ScrapeJobSchema,
  GetCompaniesParamsSchema,
  ScrapeSeason,
  ApiResponseSchema,
  ok,
  err,
} from '../schemas.js'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// CompanySchema
// ---------------------------------------------------------------------------

describe('CompanySchema', () => {
  const validCompany = {
    slug: 'openai',
    name: 'OpenAI',
    batch: 'Winter 24',
    scrapedAt: '2024-01-15T10:00:00.000Z',
  }

  it('parses a valid company with required fields', () => {
    const result = CompanySchema.safeParse(validCompany)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.slug).toBe('openai')
      expect(result.data.name).toBe('OpenAI')
      expect(result.data.batch).toBe('Winter 24')
    }
  })

  it('applies default value for category', () => {
    const result = CompanySchema.safeParse(validCompany)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.category).toBe('Uncategorized')
    }
  })

  it('applies default value for description', () => {
    const result = CompanySchema.safeParse(validCompany)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBe('')
    }
  })

  it('applies default empty object for founders', () => {
    const result = CompanySchema.safeParse(validCompany)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.founders).toEqual({})
    }
  })

  it('rejects missing slug', () => {
    const { slug: _slug, ...rest } = validCompany
    const result = CompanySchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects empty slug', () => {
    const result = CompanySchema.safeParse({ ...validCompany, slug: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing name', () => {
    const { name: _name, ...rest } = validCompany
    const result = CompanySchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing batch', () => {
    const { batch: _batch, ...rest } = validCompany
    const result = CompanySchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing scrapedAt', () => {
    const { scrapedAt: _scrapedAt, ...rest } = validCompany
    const result = CompanySchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects non-datetime scrapedAt', () => {
    const result = CompanySchema.safeParse({ ...validCompany, scrapedAt: '2024-01-15' })
    expect(result.success).toBe(false)
  })

  it('accepts optional website as valid URL', () => {
    const result = CompanySchema.safeParse({ ...validCompany, website: 'https://openai.com' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid website URL', () => {
    const result = CompanySchema.safeParse({ ...validCompany, website: 'not-a-url' })
    expect(result.success).toBe(false)
  })

  it('accepts optional logoUrl as valid URL', () => {
    const result = CompanySchema.safeParse({ ...validCompany, logoUrl: 'https://cdn.example.com/logo.png' })
    expect(result.success).toBe(true)
  })

  it('parses founders with social links', () => {
    const result = CompanySchema.safeParse({
      ...validCompany,
      founders: {
        'Sam Altman': {
          twitter: 'https://twitter.com/sama',
          linkedin: 'https://linkedin.com/in/sama',
        },
      },
    })
    expect(result.success).toBe(true)
  })

  it('rejects null input', () => {
    const result = CompanySchema.safeParse(null)
    expect(result.success).toBe(false)
  })

  it('rejects undefined input', () => {
    const result = CompanySchema.safeParse(undefined)
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ScrapeJobSchema
// ---------------------------------------------------------------------------

describe('ScrapeJobSchema', () => {
  const validJob = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    season: 'Winter' as const,
    year: 24,
    status: 'pending' as const,
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z',
  }

  it('parses a valid scrape job', () => {
    const result = ScrapeJobSchema.safeParse(validJob)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      expect(result.data.season).toBe('Winter')
      expect(result.data.year).toBe(24)
      expect(result.data.status).toBe('pending')
    }
  })

  it('requires id to be a UUID', () => {
    const result = ScrapeJobSchema.safeParse({ ...validJob, id: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects non-UUID id like batch-timestamp format', () => {
    const result = ScrapeJobSchema.safeParse({
      ...validJob,
      id: 'spring-26-1700000000000',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid seasons', () => {
    for (const season of ['Winter', 'Spring', 'Summer', 'Fall'] as const) {
      const result = ScrapeJobSchema.safeParse({ ...validJob, season })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid season "Autumn"', () => {
    const result = ScrapeJobSchema.safeParse({ ...validJob, season: 'Autumn' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid season "autumn" (case sensitive)', () => {
    const result = ScrapeJobSchema.safeParse({ ...validJob, season: 'autumn' })
    expect(result.success).toBe(false)
  })

  it('accepts all valid statuses', () => {
    for (const status of ['pending', 'running', 'completed', 'failed'] as const) {
      const result = ScrapeJobSchema.safeParse({ ...validJob, status })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid status "done"', () => {
    const result = ScrapeJobSchema.safeParse({ ...validJob, status: 'done' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid status "error"', () => {
    const result = ScrapeJobSchema.safeParse({ ...validJob, status: 'error' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid status "success"', () => {
    const result = ScrapeJobSchema.safeParse({ ...validJob, status: 'success' })
    expect(result.success).toBe(false)
  })

  it('requires createdAt', () => {
    const { createdAt: _createdAt, ...rest } = validJob
    const result = ScrapeJobSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('requires updatedAt', () => {
    const { updatedAt: _updatedAt, ...rest } = validJob
    const result = ScrapeJobSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects non-datetime createdAt', () => {
    const result = ScrapeJobSchema.safeParse({ ...validJob, createdAt: '2024-01-15' })
    expect(result.success).toBe(false)
  })

  it('rejects year as string', () => {
    const result = ScrapeJobSchema.safeParse({ ...validJob, year: '26' })
    expect(result.success).toBe(false)
  })

  it('rejects year > 99', () => {
    const result = ScrapeJobSchema.safeParse({ ...validJob, year: 2026 })
    expect(result.success).toBe(false)
  })

  it('rejects year < 0', () => {
    const result = ScrapeJobSchema.safeParse({ ...validJob, year: -1 })
    expect(result.success).toBe(false)
  })

  it('accepts year at boundary 0', () => {
    const result = ScrapeJobSchema.safeParse({ ...validJob, year: 0 })
    expect(result.success).toBe(true)
  })

  it('accepts year at boundary 99', () => {
    const result = ScrapeJobSchema.safeParse({ ...validJob, year: 99 })
    expect(result.success).toBe(true)
  })

  it('accepts optional processedCompanies', () => {
    const result = ScrapeJobSchema.safeParse({ ...validJob, processedCompanies: 42 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.processedCompanies).toBe(42)
    }
  })

  it('accepts optional error field', () => {
    const result = ScrapeJobSchema.safeParse({ ...validJob, error: 'Something went wrong' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.error).toBe('Something went wrong')
    }
  })

  it('rejects null input', () => {
    const result = ScrapeJobSchema.safeParse(null)
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ScrapeSeason enum
// ---------------------------------------------------------------------------

describe('ScrapeSeason', () => {
  it('validates Winter', () => {
    expect(ScrapeSeason.safeParse('Winter').success).toBe(true)
  })

  it('validates Spring', () => {
    expect(ScrapeSeason.safeParse('Spring').success).toBe(true)
  })

  it('validates Summer', () => {
    expect(ScrapeSeason.safeParse('Summer').success).toBe(true)
  })

  it('validates Fall', () => {
    expect(ScrapeSeason.safeParse('Fall').success).toBe(true)
  })

  it('rejects Autumn', () => {
    expect(ScrapeSeason.safeParse('Autumn').success).toBe(false)
  })

  it('rejects lowercase winter', () => {
    expect(ScrapeSeason.safeParse('winter').success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// GetCompaniesParamsSchema
// ---------------------------------------------------------------------------

describe('GetCompaniesParamsSchema', () => {
  it('accepts batch only', () => {
    const result = GetCompaniesParamsSchema.safeParse({ batch: 'Spring 26' })
    expect(result.success).toBe(true)
  })

  it('accepts category only', () => {
    const result = GetCompaniesParamsSchema.safeParse({ category: 'AI' })
    expect(result.success).toBe(true)
  })

  it('accepts both batch and category', () => {
    const result = GetCompaniesParamsSchema.safeParse({ batch: 'Spring 26', category: 'AI' })
    expect(result.success).toBe(true)
  })

  it('rejects when neither batch nor category provided', () => {
    const result = GetCompaniesParamsSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('defaults limit to 100', () => {
    const result = GetCompaniesParamsSchema.safeParse({ batch: 'Spring 26' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(100)
    }
  })

  it('coerces string limit to number', () => {
    const result = GetCompaniesParamsSchema.safeParse({ batch: 'Spring 26', limit: '50' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(50)
    }
  })

  it('rejects limit of 0', () => {
    const result = GetCompaniesParamsSchema.safeParse({ batch: 'Spring 26', limit: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects limit above 500', () => {
    const result = GetCompaniesParamsSchema.safeParse({ batch: 'Spring 26', limit: 501 })
    expect(result.success).toBe(false)
  })

  it('accepts limit at boundary 1', () => {
    const result = GetCompaniesParamsSchema.safeParse({ batch: 'Spring 26', limit: 1 })
    expect(result.success).toBe(true)
  })

  it('accepts limit at boundary 500', () => {
    const result = GetCompaniesParamsSchema.safeParse({ batch: 'Spring 26', limit: 500 })
    expect(result.success).toBe(true)
  })

  it('accepts optional nextToken', () => {
    const result = GetCompaniesParamsSchema.safeParse({ batch: 'Spring 26', nextToken: 'abc123' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.nextToken).toBe('abc123')
    }
  })
})

// ---------------------------------------------------------------------------
// ok() and err() helpers
// ---------------------------------------------------------------------------

describe('ok()', () => {
  it('returns success=true with data', () => {
    const result = ok({ id: 1, name: 'test' })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ id: 1, name: 'test' })
    expect(result.error).toBeNull()
  })

  it('returns without meta when meta not provided', () => {
    const result = ok('hello')
    expect(result.meta).toBeUndefined()
  })

  it('includes meta when provided', () => {
    const result = ok(['a', 'b'], { total: 2 })
    expect(result.success).toBe(true)
    expect(result.meta).toEqual({ total: 2 })
  })

  it('accepts null data', () => {
    const result = ok(null)
    expect(result.success).toBe(true)
    expect(result.data).toBeNull()
  })

  it('accepts array data', () => {
    const result = ok([1, 2, 3])
    expect(result.data).toEqual([1, 2, 3])
  })

  it('accepts nextToken in meta', () => {
    const result = ok([], { total: 100, nextToken: 'token123' })
    expect(result.meta?.nextToken).toBe('token123')
  })
})

describe('err()', () => {
  it('returns success=false with error message', () => {
    const result = err('Something went wrong')
    expect(result.success).toBe(false)
    expect(result.error).toBe('Something went wrong')
    expect(result.data).toBeNull()
  })

  it('returns null data', () => {
    const result = err<string[]>('error')
    expect(result.data).toBeNull()
  })

  it('handles empty error string', () => {
    const result = err('')
    expect(result.success).toBe(false)
    expect(result.error).toBe('')
  })

  it('handles special characters in error message', () => {
    const result = err('Error: <script>alert("xss")</script> & "quotes" \'here\'')
    expect(result.error).toBe('Error: <script>alert("xss")</script> & "quotes" \'here\'')
  })
})

// ---------------------------------------------------------------------------
// ApiResponseSchema
// ---------------------------------------------------------------------------

describe('ApiResponseSchema', () => {
  it('validates a success response with string data', () => {
    const schema = ApiResponseSchema(z.string())
    const result = schema.safeParse({ success: true, data: 'hello', error: null })
    expect(result.success).toBe(true)
  })

  it('validates a failure response with null data', () => {
    const schema = ApiResponseSchema(z.string())
    const result = schema.safeParse({ success: false, data: null, error: 'Something went wrong' })
    expect(result.success).toBe(true)
  })

  it('validates response with meta', () => {
    const schema = ApiResponseSchema(z.array(z.string()))
    const result = schema.safeParse({
      success: true,
      data: ['a', 'b'],
      error: null,
      meta: { total: 2, nextToken: 'abc' },
    })
    expect(result.success).toBe(true)
  })

  it('validates response with partial meta', () => {
    const schema = ApiResponseSchema(z.number())
    const result = schema.safeParse({ success: true, data: 42, error: null, meta: { total: 42 } })
    expect(result.success).toBe(true)
  })

  it('rejects missing success field', () => {
    const schema = ApiResponseSchema(z.string())
    const result = schema.safeParse({ data: 'hello', error: null })
    expect(result.success).toBe(false)
  })

  it('validates with object data schema', () => {
    const schema = ApiResponseSchema(z.object({ id: z.string(), name: z.string() }))
    const result = schema.safeParse({
      success: true,
      data: { id: '1', name: 'Test' },
      error: null,
    })
    expect(result.success).toBe(true)
  })
})
