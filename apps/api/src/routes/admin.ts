import { Hono } from "hono"
import { CompanyRepository, MetadataRepository } from "@yc-mcp/db"
import { err, ok, ScrapeJobSchema } from "@yc-mcp/shared"
import { z } from "zod"

const companyRepo = new CompanyRepository()
const metaRepo = new MetadataRepository()

/** Shared middleware: validate the admin API key. */
function requireAdminKey(c: Parameters<Parameters<Hono["use"]>[0]>[0], next: () => Promise<void>) {
  const key = c.req.header("x-admin-key") ?? c.req.query("adminKey")
  const expected = process.env["ADMIN_API_KEY"]

  if (!expected || key !== expected) {
    return c.json(err("Unauthorized"), 401)
  }
  return next()
}

export const adminRouter = new Hono()

adminRouter.use("/*", requireAdminKey)

// ---------------------------------------------------------------------------
// POST /admin/scrape — kick off a scrape job for a batch
// ---------------------------------------------------------------------------

const ScrapeRequestSchema = z.object({
  season: z.enum(["Winter", "Spring", "Summer", "Fall"]),
  year: z.string().regex(/^\d{2}$/, "year must be a 2-digit string, e.g. '26'"),
  enrichDetails: z.boolean().default(false),
})

adminRouter.post("/scrape", async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = ScrapeRequestSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(err(parsed.error.message), 400)
  }

  const { season, year, enrichDetails } = parsed.data
  const jobId = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  const yearNum = parseInt(year, 10)

  // Persist the job record immediately so callers can poll its status
  const job = ScrapeJobSchema.parse({
    id: jobId,
    season,
    year: yearNum,
    status: "pending",
    totalCompanies: 0,
    processedCompanies: 0,
    createdAt,
    updatedAt: new Date().toISOString(),
  })
  await metaRepo.putJob(job)

  // Invoke the scraper asynchronously — in Lambda this would trigger a separate
  // async invocation; here we fire-and-forget in the background.
  void runScrapeJob(jobId, season, year, enrichDetails)

  return c.json(ok({ jobId, status: "pending" }), 202)
})

// ---------------------------------------------------------------------------
// GET /admin/scrape/:jobId — poll job status
// ---------------------------------------------------------------------------

adminRouter.get("/scrape/:jobId", async (c) => {
  const { jobId } = c.req.param()
  const job = await metaRepo.getJob(jobId)
  if (!job) {
    return c.json(err("Job not found"), 404)
  }
  return c.json(ok(job))
})

// ---------------------------------------------------------------------------
// GET /admin/batches — list all scraped batches
// ---------------------------------------------------------------------------

adminRouter.get("/batches", async (c) => {
  const batches = await metaRepo.listBatches()
  return c.json(ok(batches))
})

// ---------------------------------------------------------------------------
// Background scrape runner (imported lazily to avoid bundling Playwright into
// the main Lambda bundle when it isn't needed)
// ---------------------------------------------------------------------------

async function runScrapeJob(
  jobId: string,
  season: "Winter" | "Spring" | "Summer" | "Fall",
  year: string,
  enrichDetails: boolean,
): Promise<void> {
  const createdAt = new Date().toISOString()
  const yearNum = parseInt(year, 10)
  try {
    // Dynamic import so Playwright is only loaded in scraper environments
    const { scrapeBatch } = await import("@yc-mcp/scraper")

    await metaRepo.putJob(
      ScrapeJobSchema.parse({
        id: jobId,
        season,
        year: yearNum,
        status: "running",
        totalCompanies: 0,
        processedCompanies: 0,
        createdAt,
        updatedAt: new Date().toISOString(),
      }),
    )

    const companies = await scrapeBatch(season, year, {
      enrichDetails,
      onProgress: (scraped, total) => {
        void metaRepo.putJob(
          ScrapeJobSchema.parse({
            id: jobId,
            season,
            year: yearNum,
            status: "running",
            totalCompanies: total,
            processedCompanies: scraped,
            createdAt,
            updatedAt: new Date().toISOString(),
          }),
        )
      },
    })

    await companyRepo.putCompanies(companies)
    await metaRepo.recordBatch(`${season} ${year}`)

    await metaRepo.putJob(
      ScrapeJobSchema.parse({
        id: jobId,
        season,
        year: yearNum,
        status: "completed",
        totalCompanies: companies.length,
        processedCompanies: companies.length,
        createdAt,
        updatedAt: new Date().toISOString(),
      }),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await metaRepo.putJob(
      ScrapeJobSchema.parse({
        id: jobId,
        season,
        year: yearNum,
        status: "failed",
        totalCompanies: 0,
        processedCompanies: 0,
        error: message,
        createdAt,
        updatedAt: new Date().toISOString(),
      }),
    )
  }
}
