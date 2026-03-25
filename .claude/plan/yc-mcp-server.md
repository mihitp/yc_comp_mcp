# Implementation Plan: YC Company MCP Server

## Task Type
- [x] Fullstack (Monorepo — TypeScript throughout)

---

## Overview

Build a public YC Company directory MCP server with:
1. **Scraper** — Playwright-based crawler for ycombinator.com/companies
2. **Database** — AWS DynamoDB (serverless, pay-per-request)
3. **MCP Server** — HTTP-based MCP + REST API via AWS Lambda + API Gateway
4. **Admin Dashboard** — Next.js admin panel to trigger scrapes
5. **Public Website** — Next.js docs site + interactive company explorer

---

## Technical Solution

### Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Language | TypeScript (Node.js 20) | Unified types across all packages |
| Monorepo | Turborepo | Fast builds, shared packages, simple config |
| Scraper | Playwright | YC site is a React SPA needing JS rendering |
| Database | AWS DynamoDB | Serverless, no infra to manage, cheap at this scale |
| API/MCP | AWS Lambda + API Gateway | Serverless, fast Node cold starts (~100ms) |
| MCP SDK | `@modelcontextprotocol/sdk` | Official TypeScript MCP SDK |
| REST API | Hono.js | Tiny, fast, works natively on Lambda |
| Frontend | Next.js 15 (App Router) | Docs site + admin dashboard in one app |
| Validation | Zod | Runtime validation + generates shared TypeScript types |
| IaC | AWS CDK (TypeScript) | Same language as app code |
| CI/CD | GitHub Actions | Free, OIDC-based AWS auth |

---

## Monorepo Structure

```
yc_comp_mcp/
├── apps/
│   ├── web/                    # Next.js — public docs + admin dashboard
│   └── api/                    # Hono.js — MCP server + REST API (runs on Lambda)
├── packages/
│   ├── shared/                 # Zod schemas, shared TypeScript types
│   ├── scraper/                # Playwright scraper (runs as Lambda worker)
│   ├── db/                     # DynamoDB client wrapper
│   └── infra/                  # AWS CDK stack
├── turbo.json
├── package.json                # Root workspace
└── .env.example
```

---

## Shared Types (`packages/shared`)

```typescript
// packages/shared/src/schemas.ts
import { z } from "zod"

export const FounderSchema = z.object({
  linkedin: z.string().url().optional(),
  twitter: z.string().url().optional(),
  github: z.string().url().optional(),
})

export const CompanySchema = z.object({
  slug: z.string(),
  name: z.string(),
  batch: z.string(),           // "Spring 2026"
  category: z.string(),
  description: z.string(),
  website: z.string().url(),
  founders: z.record(z.string(), FounderSchema),
  scrapedAt: z.string().datetime(),
})

export type Founder = z.infer<typeof FounderSchema>
export type Company = z.infer<typeof CompanySchema>

export const GetCompaniesParamsSchema = z.object({
  batch: z.string().optional(),
  category: z.string().optional(),
}).refine(d => d.batch || d.category, "Must provide batch or category")

export type GetCompaniesParams = z.infer<typeof GetCompaniesParamsSchema>
```

---

## Implementation Steps

### Phase 1: Monorepo Setup (Day 1)

#### 1.1 Initialize Turborepo
```bash
npx create-turbo@latest yc_comp_mcp
# Choose: npm workspaces, TypeScript
```

#### 1.2 Configure workspaces in root `package.json`
```json
{
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "test": "turbo test"
  }
}
```

#### 1.3 Create shared package
```bash
mkdir -p packages/shared/src
# Add: schemas.ts, index.ts
# All other packages import from "@yc-mcp/shared"
```

---

### Phase 2: Scraper (Days 2-4)

**Goal**: Reliably scrape YC companies by batch, validate counts

#### 2.1 Scraper Core (`packages/scraper/src/scraper.ts`)
```typescript
// Pseudo-code
export class YCScraper {
  private browser: Browser

  buildUrl(season: "Winter" | "Spring" | "Summer" | "Fall", year: number): string {
    return `https://www.ycombinator.com/companies?batch=${season}%20${year}`
  }

  async scrapeBatch(season: string, year: number): Promise<Company[]> {
    const page = await this.browser.newPage()
    await page.goto(this.buildUrl(season, year))

    // Wait for React to finish rendering company cards
    await page.waitForSelector("[data-company-card]")

    // Use Playwright locators (modern API — no DOM string execution)
    const cards = page.locator("[data-company-card]")
    const count = await cards.count()

    const rawCompanies = []
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i)
      rawCompanies.push({
        name: await card.locator(".company-name").textContent(),
        slug: await card.getAttribute("data-slug"),
        category: await card.locator(".category-tag").textContent(),
      })
    }

    // Enrich each with detail page (founders + socials)
    const companies = []
    for (const raw of rawCompanies) {
      companies.push(await this.scrapeDetail(raw.slug))
      await page.waitForTimeout(1000 + Math.random() * 1000) // 1-2s jitter
    }
    return companies
  }

  async scrapeDetail(slug: string): Promise<Company> {
    // Visit /companies/{slug}
    // Use locators to extract founders list + each founder's social links
    // Validate with CompanySchema.parse(data) — throws on bad data
  }
}
```

#### 2.2 TDD — Write Tests First (`packages/scraper/src/__tests__/scraper.test.ts`)
```typescript
describe("YCScraper", () => {
  it("scrapes Spring 2026 batch — expects 43 companies", async () => {
    const companies = await scraper.scrapeBatch("Spring", 26)
    expect(companies).toHaveLength(43)
  })

  it("scrapes Winter 2026 batch — expects 199 companies", async () => {
    const companies = await scraper.scrapeBatch("Winter", 26)
    expect(companies).toHaveLength(199)
  })

  it("every company passes Zod schema validation", async () => {
    const companies = await scraper.scrapeBatch("Spring", 26)
    companies.forEach(c => {
      expect(() => CompanySchema.parse(c)).not.toThrow()
    })
  })
})
```

---

### Phase 3: Database Layer (Days 4-5)

**Goal**: Store and query companies in DynamoDB

#### 3.1 DynamoDB Table Design
```
Table: yc-companies
  PK: batch       (e.g., "Spring 2026")
  SK: slug        (e.g., "openai")

GSI: category-index
  PK: category    (e.g., "AI")
  SK: batch       (e.g., "Spring 2026")

Table: yc-metadata
  PK: "BATCHES"
  SK: batch name
```

#### 3.2 Repository (`packages/db/src/repository.ts`)
```typescript
export class CompanyRepository {
  async putCompany(company: Company): Promise<void>
  async getByBatch(batch: string): Promise<Company[]>
  async getByCategory(category: string, batch?: string): Promise<Company[]>
  async getByBatchAndCategory(params: GetCompaniesParams): Promise<Company[]>
  async listBatches(): Promise<string[]>
  async listCategories(): Promise<string[]>
}
```

---

### Phase 4: MCP Server + REST API (Days 6-8)

**Goal**: Expose data via MCP protocol and REST

#### 4.1 MCP Server (`apps/api/src/mcp.ts`)
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

const server = new McpServer({ name: "yc-companies", version: "1.0.0" })

server.tool(
  "get_companies",
  "Get YC companies by batch and/or category",
  {
    batch: z.string().optional().describe("e.g. 'Spring 2026'"),
    category: z.string().optional().describe("e.g. 'AI'"),
  },
  async ({ batch, category }) => {
    const companies = await repo.getByBatchAndCategory({ batch, category })
    return {
      content: [{ type: "text", text: JSON.stringify(companies, null, 2) }]
    }
  }
)

server.tool(
  "list_batches",
  "List all available YC batches",
  {},
  async () => {
    const batches = await repo.listBatches()
    return {
      content: [{ type: "text", text: JSON.stringify(batches) }]
    }
  }
)
```

#### 4.2 REST API Routes
```
GET  /companies?batch=Spring+2026&category=AI
GET  /companies/:slug
GET  /batches
GET  /categories
POST /admin/scrape        { season, year }  — requires ADMIN_API_KEY header
GET  /admin/jobs/:id      — scrape job status
```

#### 4.3 Lambda Handler (`apps/api/src/handler.ts`)
```typescript
import { handle } from "hono/aws-lambda"

// MCP requests  → POST /mcp
// REST requests → GET /companies, GET /batches, etc.
export const handler = handle(app)
```

---

### Phase 5: Admin Dashboard (Days 9-10)

**Goal**: Trigger scrapes for new/unreleased batches

#### 5.1 Next.js Admin Pages (`apps/web/app/admin/`)
```
/admin          → List all batches + scrape job history
/admin/scrape   → Form: select season + year → trigger scrape
```

#### 5.2 Scrape Job Flow
```
Admin submits form → POST /admin/scrape
  → API validates ADMIN_API_KEY
  → Sends message to SQS queue: { season, year }
  → Scraper Lambda picks up SQS message
  → Runs Playwright scrape (up to 10 min)
  → Upserts companies into DynamoDB
  → Updates job status in yc-metadata table

Admin polls GET /admin/jobs/:id to show live progress bar
```

#### 5.3 Auth
- `Authorization: Bearer ${ADMIN_API_KEY}` header check
- Key stored in AWS Secrets Manager

---

### Phase 6: Public Docs Website (Days 11-14)

**Goal**: Public-facing docs + interactive explorer

#### 6.1 Pages
```
/              Hero — what is this, why use it
/docs          How to add MCP to Claude Desktop / Cursor / Windsurf
/explorer      Interactive: pick batch + category → see company cards
/api           REST API reference (generated from Zod schemas via zod-to-json-schema)
```

#### 6.2 MCP Config Snippet (on /docs page)
```json
{
  "mcpServers": {
    "yc-companies": {
      "url": "https://api.ycmcp.com/mcp",
      "transport": "http"
    }
  }
}
```

#### 6.3 Deploy
- Next.js hosted on Vercel (free tier, zero config, auto-deploys from GitHub)
- API Lambda stays on AWS
- Custom domains: `ycmcp.com` (frontend) + `api.ycmcp.com` (API Gateway)

---

### Phase 7: Infrastructure as Code (Parallel with Dev)

#### 7.1 AWS CDK Stack (`packages/infra/src/stack.ts`)
```typescript
// DynamoDB table + GSI
const table = new dynamodb.Table(this, "Companies", {
  partitionKey: { name: "batch", type: dynamodb.AttributeType.STRING },
  sortKey: { name: "slug", type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
})
table.addGlobalSecondaryIndex({
  indexName: "category-index",
  partitionKey: { name: "category", type: dynamodb.AttributeType.STRING },
  sortKey: { name: "batch", type: dynamodb.AttributeType.STRING },
})

// API Lambda (fast, lightweight)
const apiLambda = new NodejsFunction(this, "Api", {
  entry: "apps/api/src/handler.ts",
  runtime: lambda.Runtime.NODEJS_20_X,
  memorySize: 512,
  timeout: Duration.seconds(30),
})

// Scraper Lambda (needs memory for Playwright)
const scraperLambda = new NodejsFunction(this, "Scraper", {
  entry: "packages/scraper/src/lambda.ts",
  runtime: lambda.Runtime.NODEJS_20_X,
  memorySize: 2048,
  timeout: Duration.minutes(10),
})

// SQS queue → triggers scraper
const queue = new sqs.Queue(this, "ScrapeQueue")
scraperLambda.addEventSource(new SqsEventSource(queue))

// Grant DynamoDB access
table.grantReadData(apiLambda)
table.grantWriteData(scraperLambda)
```

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `packages/shared/src/schemas.ts` | Create | Zod schemas + TS types (single source of truth) |
| `packages/scraper/src/scraper.ts` | Create | Playwright scraper using locator API |
| `packages/scraper/src/__tests__/scraper.test.ts` | Create | TDD tests (43 Spring + 199 Winter) |
| `packages/db/src/repository.ts` | Create | DynamoDB repository pattern |
| `apps/api/src/mcp.ts` | Create | MCP server tools |
| `apps/api/src/routes.ts` | Create | Hono REST routes |
| `apps/api/src/handler.ts` | Create | Lambda entrypoint |
| `apps/web/app/` | Create | Next.js pages (docs + admin) |
| `packages/infra/src/stack.ts` | Create | AWS CDK stack |
| `.github/workflows/deploy.yml` | Create | CI/CD pipeline |

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| YC blocks scraper | Realistic user-agent + 1-2s jitter; cache aggressively in DynamoDB |
| YC changes DOM structure | Zod validation catches schema drift; scheduled test Lambda alerts on failure |
| Playwright cold start on Lambda | Lambda container image with Playwright pre-installed; keep warm with EventBridge ping |
| DynamoDB cost spike | PAY_PER_REQUEST billing + CloudWatch billing alerts at $5 |
| Admin auth bypass | API key header + rate limit (1 scrape/batch/hour) |
| YC TOS concerns | Low-frequency scraping, attribution on site, no raw data resale |

---

## Milestones

| Milestone | Day | Deliverable |
|-----------|-----|-------------|
| Monorepo + shared types | 1 | `packages/shared` compiles cleanly |
| Scraper MVP | 3 | CLI: prints 43 Spring 2026 companies as JSON |
| DB layer | 5 | Companies upserted into local DynamoDB |
| MCP server (local) | 7 | Claude Desktop queries via local server |
| AWS deploy | 9 | Live at `api.ycmcp.com/mcp` |
| Admin dashboard | 10 | Can trigger new batch scrape from UI |
| Public website | 14 | Docs live at `ycmcp.com` |

---

## SESSION_ID
- CODEX_SESSION: N/A
- GEMINI_SESSION: N/A
