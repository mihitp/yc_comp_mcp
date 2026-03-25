import { describe, it, expect, beforeEach } from 'vitest'
import { mockClient } from 'aws-sdk-client-mock'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb'
import type { Company, ScrapeJob } from '@yc-mcp/shared'
import { CompanyRepository, MetadataRepository } from '../repository.js'

// ---------------------------------------------------------------------------
// Setup mock
// ---------------------------------------------------------------------------

const ddbMock = mockClient(DynamoDBDocumentClient)

beforeEach(() => {
  ddbMock.reset()
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeCompany = (overrides: Partial<Company> = {}): Company => ({
  slug: 'test-company',
  name: 'Test Company',
  batch: 'Spring 26',
  category: 'AI',
  description: 'A test company',
  founders: {},
  scrapedAt: '2024-01-15T10:00:00.000Z',
  ...overrides,
})

const makeJob = (overrides: Partial<ScrapeJob> = {}): ScrapeJob => ({
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  season: 'Spring',
  year: 26,
  status: 'pending',
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: '2024-01-15T10:00:00.000Z',
  ...overrides,
})

// ---------------------------------------------------------------------------
// CompanyRepository
// ---------------------------------------------------------------------------

describe('CompanyRepository', () => {
  let repo: CompanyRepository

  beforeEach(() => {
    repo = new CompanyRepository()
  })

  describe('putCompany', () => {
    it('sends a PutCommand with the correct item', async () => {
      ddbMock.on(PutCommand).resolves({})
      const company = makeCompany()
      await repo.putCompany(company)

      const calls = ddbMock.commandCalls(PutCommand)
      expect(calls).toHaveLength(1)
      expect(calls[0]?.args[0].input.Item).toMatchObject({
        slug: 'test-company',
        name: 'Test Company',
        batch: 'Spring 26',
      })
    })

    it('uses the COMPANIES table', async () => {
      ddbMock.on(PutCommand).resolves({})
      await repo.putCompany(makeCompany())

      const calls = ddbMock.commandCalls(PutCommand)
      expect(calls[0]?.args[0].input.TableName).toBe('yc-companies')
    })

    it('resolves without error', async () => {
      ddbMock.on(PutCommand).resolves({})
      await expect(repo.putCompany(makeCompany())).resolves.toBeUndefined()
    })

    it('propagates DynamoDB errors', async () => {
      ddbMock.on(PutCommand).rejects(new Error('DynamoDB error'))
      await expect(repo.putCompany(makeCompany())).rejects.toThrow('DynamoDB error')
    })
  })

  describe('putCompanies', () => {
    it('sends one PutCommand per company', async () => {
      ddbMock.on(PutCommand).resolves({})
      const companies = [
        makeCompany({ slug: 'a' }),
        makeCompany({ slug: 'b' }),
        makeCompany({ slug: 'c' }),
      ]
      await repo.putCompanies(companies)

      const calls = ddbMock.commandCalls(PutCommand)
      expect(calls).toHaveLength(3)
    })

    it('resolves for an empty array', async () => {
      await expect(repo.putCompanies([])).resolves.toBeUndefined()
      // No DynamoDB calls for empty array
      expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0)
    })
  })

  describe('getCompany', () => {
    it('returns the company when found', async () => {
      const company = makeCompany()
      ddbMock.on(GetCommand).resolves({ Item: company })
      const result = await repo.getCompany('Spring 26', 'test-company')
      expect(result).toEqual(company)
    })

    it('returns undefined when not found', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined })
      const result = await repo.getCompany('Spring 26', 'missing-company')
      expect(result).toBeUndefined()
    })

    it('sends GetCommand with correct key', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined })
      await repo.getCompany('Spring 26', 'test-company')

      const calls = ddbMock.commandCalls(GetCommand)
      expect(calls[0]?.args[0].input.Key).toEqual({ batch: 'Spring 26', slug: 'test-company' })
    })

    it('propagates DynamoDB errors', async () => {
      ddbMock.on(GetCommand).rejects(new Error('Read error'))
      await expect(repo.getCompany('Spring 26', 'test')).rejects.toThrow('Read error')
    })
  })

  describe('getByBatch', () => {
    it('returns companies for a batch', async () => {
      const companies = [makeCompany({ slug: 'a' }), makeCompany({ slug: 'b' })]
      ddbMock.on(QueryCommand).resolves({ Items: companies })
      const result = await repo.getByBatch('Spring 26')
      expect(result).toHaveLength(2)
      expect(result[0]?.slug).toBe('a')
    })

    it('returns empty array when no items', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })
      const result = await repo.getByBatch('Spring 26')
      expect(result).toEqual([])
    })

    it('returns empty array when Items is undefined', async () => {
      ddbMock.on(QueryCommand).resolves({})
      const result = await repo.getByBatch('Spring 26')
      expect(result).toEqual([])
    })

    it('sends QueryCommand with correct expression', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })
      await repo.getByBatch('Spring 26')

      const calls = ddbMock.commandCalls(QueryCommand)
      expect(calls[0]?.args[0].input.ExpressionAttributeValues).toMatchObject({
        ':batch': 'Spring 26',
      })
    })
  })

  describe('getByCategory', () => {
    it('returns companies for a category', async () => {
      const companies = [makeCompany({ category: 'AI' })]
      ddbMock.on(QueryCommand).resolves({ Items: companies })
      const result = await repo.getByCategory('AI')
      expect(result).toHaveLength(1)
    })

    it('uses GSI category-index', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })
      await repo.getByCategory('AI')

      const calls = ddbMock.commandCalls(QueryCommand)
      expect(calls[0]?.args[0].input.IndexName).toBe('category-index')
    })

    it('includes batch in expression when batch provided', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })
      await repo.getByCategory('AI', 'Spring 26')

      const calls = ddbMock.commandCalls(QueryCommand)
      const input = calls[0]?.args[0].input
      expect(input?.ExpressionAttributeValues).toMatchObject({
        ':category': 'AI',
        ':batch': 'Spring 26',
      })
    })

    it('does not include batch expression when batch not provided', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })
      await repo.getByCategory('AI')

      const calls = ddbMock.commandCalls(QueryCommand)
      const input = calls[0]?.args[0].input
      expect(input?.ExpressionAttributeValues?.[':batch']).toBeUndefined()
    })
  })

  describe('query', () => {
    it('queries by batch when only batch provided', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [makeCompany()] })
      const result = await repo.query({ batch: 'Spring 26', limit: 100 })
      expect(result).toHaveLength(1)
    })

    it('queries by category when only category provided', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [makeCompany()] })
      const result = await repo.query({ category: 'AI', limit: 100 })
      expect(result).toHaveLength(1)
    })

    it('respects limit when querying by batch', async () => {
      const many = Array.from({ length: 10 }, (_, i) => makeCompany({ slug: `company-${i}` }))
      ddbMock.on(QueryCommand).resolves({ Items: many })
      const result = await repo.query({ batch: 'Spring 26', limit: 3 })
      expect(result).toHaveLength(3)
    })

    it('respects limit when querying by category', async () => {
      const many = Array.from({ length: 10 }, (_, i) => makeCompany({ slug: `company-${i}` }))
      ddbMock.on(QueryCommand).resolves({ Items: many })
      const result = await repo.query({ category: 'AI', limit: 5 })
      expect(result).toHaveLength(5)
    })

    it('returns empty array when neither batch nor category', async () => {
      // This case hits the final return [] in query()
      const result = await repo.query({ limit: 100 } as Parameters<typeof repo.query>[0])
      expect(result).toEqual([])
      expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(0)
    })

    it('queries both when batch and category provided', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [makeCompany()] })
      const result = await repo.query({ batch: 'Spring 26', category: 'AI', limit: 100 })
      expect(result).toHaveLength(1)
    })
  })

  describe('deleteCompany', () => {
    it('sends DeleteCommand with correct key', async () => {
      ddbMock.on(DeleteCommand).resolves({})
      await repo.deleteCompany('Spring 26', 'test-company')

      const calls = ddbMock.commandCalls(DeleteCommand)
      expect(calls).toHaveLength(1)
      expect(calls[0]?.args[0].input.Key).toEqual({ batch: 'Spring 26', slug: 'test-company' })
    })

    it('resolves without error', async () => {
      ddbMock.on(DeleteCommand).resolves({})
      await expect(repo.deleteCompany('Spring 26', 'test-company')).resolves.toBeUndefined()
    })

    it('propagates DynamoDB errors', async () => {
      ddbMock.on(DeleteCommand).rejects(new Error('Delete error'))
      await expect(repo.deleteCompany('Spring 26', 'test')).rejects.toThrow('Delete error')
    })
  })
})

// ---------------------------------------------------------------------------
// MetadataRepository
// ---------------------------------------------------------------------------

describe('MetadataRepository', () => {
  let repo: MetadataRepository

  beforeEach(() => {
    repo = new MetadataRepository()
  })

  describe('recordBatch', () => {
    it('sends UpdateCommand with correct key', async () => {
      ddbMock.on(UpdateCommand).resolves({})
      await repo.recordBatch('Spring 26')

      const calls = ddbMock.commandCalls(UpdateCommand)
      expect(calls).toHaveLength(1)
      expect(calls[0]?.args[0].input.Key).toEqual({ pk: 'BATCHES', sk: 'Spring 26' })
    })

    it('uses the METADATA table', async () => {
      ddbMock.on(UpdateCommand).resolves({})
      await repo.recordBatch('Spring 26')

      const calls = ddbMock.commandCalls(UpdateCommand)
      expect(calls[0]?.args[0].input.TableName).toBe('yc-metadata')
    })

    it('resolves without error', async () => {
      ddbMock.on(UpdateCommand).resolves({})
      await expect(repo.recordBatch('Winter 25')).resolves.toBeUndefined()
    })
  })

  describe('listBatches', () => {
    it('returns list of batch names', async () => {
      ddbMock.on(QueryCommand).resolves({
        Items: [
          { pk: 'BATCHES', sk: 'Spring 26' },
          { pk: 'BATCHES', sk: 'Winter 25' },
        ],
      })
      const result = await repo.listBatches()
      expect(result).toEqual(['Spring 26', 'Winter 25'])
    })

    it('returns empty array when no batches', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })
      const result = await repo.listBatches()
      expect(result).toEqual([])
    })

    it('returns empty array when Items is undefined', async () => {
      ddbMock.on(QueryCommand).resolves({})
      const result = await repo.listBatches()
      expect(result).toEqual([])
    })

    it('queries by BATCHES pk', async () => {
      ddbMock.on(QueryCommand).resolves({ Items: [] })
      await repo.listBatches()

      const calls = ddbMock.commandCalls(QueryCommand)
      expect(calls[0]?.args[0].input.ExpressionAttributeValues).toMatchObject({
        ':pk': 'BATCHES',
      })
    })
  })

  describe('putJob', () => {
    it('sends PutCommand with JOB# prefix on pk', async () => {
      ddbMock.on(PutCommand).resolves({})
      const job = makeJob()
      await repo.putJob(job)

      const calls = ddbMock.commandCalls(PutCommand)
      expect(calls).toHaveLength(1)
      expect(calls[0]?.args[0].input.Item?.pk).toBe(`JOB#${job.id}`)
    })

    it('sets sk to job id', async () => {
      ddbMock.on(PutCommand).resolves({})
      const job = makeJob()
      await repo.putJob(job)

      const calls = ddbMock.commandCalls(PutCommand)
      expect(calls[0]?.args[0].input.Item?.sk).toBe(job.id)
    })

    it('spreads job fields into item', async () => {
      ddbMock.on(PutCommand).resolves({})
      const job = makeJob({ status: 'running' })
      await repo.putJob(job)

      const calls = ddbMock.commandCalls(PutCommand)
      expect(calls[0]?.args[0].input.Item?.status).toBe('running')
    })

    it('uses the METADATA table', async () => {
      ddbMock.on(PutCommand).resolves({})
      await repo.putJob(makeJob())

      const calls = ddbMock.commandCalls(PutCommand)
      expect(calls[0]?.args[0].input.TableName).toBe('yc-metadata')
    })
  })

  describe('getJob', () => {
    it('returns the job when found', async () => {
      const job = makeJob()
      ddbMock.on(GetCommand).resolves({ Item: job })
      const result = await repo.getJob(job.id)
      expect(result).toEqual(job)
    })

    it('returns undefined when not found', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined })
      const result = await repo.getJob('nonexistent-id')
      expect(result).toBeUndefined()
    })

    it('queries with JOB# prefix key', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined })
      const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      await repo.getJob(id)

      const calls = ddbMock.commandCalls(GetCommand)
      expect(calls[0]?.args[0].input.Key).toEqual({
        pk: `JOB#${id}`,
        sk: id,
      })
    })
  })
})
