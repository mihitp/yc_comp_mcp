import { z } from "zod"

// ---------------------------------------------------------------------------
// Founder socials
// ---------------------------------------------------------------------------

export const FounderSocialsSchema = z.object({
  linkedin: z.string().url().optional(),
  twitter: z.string().url().optional(),
  github: z.string().url().optional(),
  email: z.string().email().optional(),
})

export type FounderSocials = z.infer<typeof FounderSocialsSchema>

// ---------------------------------------------------------------------------
// Company
// ---------------------------------------------------------------------------

export const CompanySchema = z.object({
  /** URL slug, e.g. "openai" */
  slug: z.string().min(1),
  name: z.string().min(1),
  /** e.g. "Spring 26" */
  batch: z.string().min(1),
  /** e.g. "AI", "Fintech" — taken from first YC category tag */
  category: z.string().default("Uncategorized"),
  description: z.string().default(""),
  website: z.string().url().optional(),
  /** Map of founder display name → their social links */
  founders: z.record(z.string(), FounderSocialsSchema).default({}),
  logoUrl: z.string().url().optional(),
  location: z.string().optional(),
  teamSize: z.string().optional(),
  /** ISO-8601 datetime of when this record was scraped */
  scrapedAt: z.string().datetime(),
})

export type Company = z.infer<typeof CompanySchema>

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------

export const GetCompaniesParamsSchema = z
  .object({
    batch: z.string().optional(),
    category: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
    nextToken: z.string().optional(),
  })
  .refine((data) => data.batch !== undefined || data.category !== undefined, {
    message: "At least one of 'batch' or 'category' is required",
  })

export type GetCompaniesParams = z.infer<typeof GetCompaniesParamsSchema>

// ---------------------------------------------------------------------------
// Scrape jobs
// ---------------------------------------------------------------------------

export const ScrapeSeason = z.enum(["Winter", "Spring", "Summer", "Fall"])
export type ScrapeSeason = z.infer<typeof ScrapeSeason>

export const ScrapeJobSchema = z.object({
  id: z.string().uuid(),
  season: ScrapeSeason,
  /** 2-digit year, e.g. 26 for 2026 */
  year: z.number().int().min(0).max(99),
  status: z.enum(["pending", "running", "completed", "failed"]),
  totalCompanies: z.number().int().optional(),
  processedCompanies: z.number().int().optional(),
  error: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type ScrapeJob = z.infer<typeof ScrapeJobSchema>

// ---------------------------------------------------------------------------
// API response envelope
// ---------------------------------------------------------------------------

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.nullable(),
    error: z.string().nullable(),
    meta: z
      .object({
        total: z.number().optional(),
        nextToken: z.string().optional(),
      })
      .optional(),
  })

export type ApiResponse<T> = {
  success: boolean
  data: T | null
  error: string | null
  meta?: {
    total?: number
    nextToken?: string
  }
}

export function ok<T>(data: T, meta?: ApiResponse<T>["meta"]): ApiResponse<T> {
  return meta !== undefined
    ? { success: true, data, error: null, meta }
    : { success: true, data, error: null }
}

export function err<T>(message: string): ApiResponse<T> {
  return { success: false, data: null, error: message }
}
