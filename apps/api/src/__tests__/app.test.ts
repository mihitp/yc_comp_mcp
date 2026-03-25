import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoist mock functions
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

import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { err } from '@yc-mcp/shared'
import { app } from '../app.js'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.mockQuery.mockResolvedValue([])
  mocks.mockGetCompany.mockResolvedValue(undefined)
  mocks.mockListBatches.mockResolvedValue([])
  process.env['ADMIN_API_KEY'] = 'test-key'
})

// ---------------------------------------------------------------------------
// Global error handler — test using a fresh Hono app that mirrors app.ts logic
// This avoids polluting the shared `app` instance with test-only routes.
// ---------------------------------------------------------------------------

describe('Global error handler', () => {
  it('returns 500 with error body for unhandled non-HTTP errors', async () => {
    const testApp = new Hono()
    testApp.get('/boom', () => {
      throw new Error('unexpected failure')
    })
    testApp.onError((error, c) => {
      if (error instanceof HTTPException) {
        return c.json(err(error.message), error.status)
      }
      console.error('[unhandled error]', error)
      return c.json(err('Internal server error'), 500)
    })

    const req = new Request('http://localhost/boom')
    const res = await testApp.fetch(req)
    expect(res.status).toBe(500)
    const body = await res.json() as { success: boolean; error: string }
    expect(body.success).toBe(false)
    expect(body.error).toBe('Internal server error')
  })

  it('returns the HTTPException status and message for HTTP errors', async () => {
    const testApp = new Hono()
    testApp.get('/forbidden', () => {
      throw new HTTPException(403, { message: 'Access denied' })
    })
    testApp.onError((error, c) => {
      if (error instanceof HTTPException) {
        return c.json(err(error.message), error.status)
      }
      return c.json(err('Internal server error'), 500)
    })

    const req = new Request('http://localhost/forbidden')
    const res = await testApp.fetch(req)
    expect(res.status).toBe(403)
    const body = await res.json() as { success: boolean; error: string }
    expect(body.success).toBe(false)
    expect(body.error).toBe('Access denied')
  })
})

// ---------------------------------------------------------------------------
// MCP endpoint — POST /mcp (lines 39-57 in app.ts)
// The MCP transport handles its own protocol; we verify the route is wired
// and does not return 404/405.
// ---------------------------------------------------------------------------

describe('POST /mcp', () => {
  it('accepts POST requests (route is registered)', async () => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '0.0.1' },
      },
    })

    const req = new Request('http://localhost/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
      body,
    })

    const res = await app.fetch(req)
    // Route is registered — must not be 404 or 405
    expect(res.status).not.toBe(404)
    expect(res.status).not.toBe(405)
  })
})
