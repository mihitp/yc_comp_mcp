import type { Company, FounderSocials } from "@yc-mcp/shared"
import {
  ALGOLIA_API_KEY,
  ALGOLIA_APP_ID,
  ALGOLIA_HITS_PER_PAGE,
  ALGOLIA_INDEX,
  DEFAULT_SCRAPE_DELAY_MS,
  DETAIL_SELECTORS,
  YC_BASE_URL,
  buildBatchLabel,
  type YcSeason,
} from "./constants.js"

// ---------------------------------------------------------------------------
// Algolia response types
// ---------------------------------------------------------------------------

interface AlgoliaHit {
  objectID: string
  id?: number
  name: string
  slug: string
  website?: string
  one_liner?: string
  long_description?: string
  batch: string
  industries?: string[]
  tags?: string[]
  small_logo_thumb_url?: string
  team_size?: number
  all_locations?: string
}

interface AlgoliaResult {
  hits: AlgoliaHit[]
  nbHits: number
  nbPages: number
  hitsPerPage: number
  page: number
}

interface AlgoliaResponse {
  results: AlgoliaResult[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function hitToCompany(hit: AlgoliaHit, scrapedAt: string): Company {
  return {
    slug: hit.slug,
    name: hit.name,
    batch: hit.batch,
    category: hit.industries?.[0] ?? hit.tags?.[0] ?? "Uncategorized",
    description: hit.one_liner ?? "",
    website: hit.website ?? undefined,
    founders: {},
    logoUrl: hit.small_logo_thumb_url ?? undefined,
    location: hit.all_locations || undefined,
    teamSize: hit.team_size != null && hit.team_size > 0 ? String(hit.team_size) : undefined,
    scrapedAt,
  }
}

// ---------------------------------------------------------------------------
// Algolia fetch strategy (primary — no browser needed)
// ---------------------------------------------------------------------------

async function fetchBatchFromAlgolia(batchLabel: string): Promise<AlgoliaHit[]> {
  const url = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/*/queries?x-algolia-application-id=${ALGOLIA_APP_ID}&x-algolia-api-key=${ALGOLIA_API_KEY}`
  const filter = `batch:"${batchLabel}"`
  const all: AlgoliaHit[] = []
  let page = 0

  while (true) {
    const body = {
      requests: [
        {
          indexName: ALGOLIA_INDEX,
          params: `filters=${encodeURIComponent(filter)}&hitsPerPage=${ALGOLIA_HITS_PER_PAGE}&page=${page}`,
        },
      ],
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      throw new Error(`Algolia request failed: ${res.status} ${res.statusText}`)
    }

    const json = (await res.json()) as AlgoliaResponse
    const result = json.results[0]
    if (!result) break

    all.push(...result.hits)

    if (page >= result.nbPages - 1) break
    page++
  }

  return all
}

// ---------------------------------------------------------------------------
// Detail page enrichment (Playwright — only when enrichDetails=true)
// ---------------------------------------------------------------------------

async function enrichWithFounders(companies: Company[], delayMs: number): Promise<Company[]> {
  const { chromium } = await import("playwright")

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  })
  const page = await context.newPage()

  try {
    const enriched: Company[] = []

    for (const company of companies) {
      await delay(delayMs)
      const detailUrl = `${YC_BASE_URL}/companies/${company.slug}`

      try {
        await page.goto(detailUrl, { waitUntil: "networkidle", timeout: 30_000 })
      } catch {
        enriched.push(company)
        continue
      }

      const founderNames = await page
        .locator(DETAIL_SELECTORS.FOUNDER_NAME)
        .allTextContents()
        .catch(() => [] as string[])

      const linkedinLinks = await page
        .locator(DETAIL_SELECTORS.FOUNDER_LINKEDIN)
        .evaluateAll((els) => els.map((el) => (el as HTMLAnchorElement).href))
        .catch(() => [] as string[])

      const twitterLinks = await page
        .locator(DETAIL_SELECTORS.FOUNDER_TWITTER)
        .evaluateAll((els) => els.map((el) => (el as HTMLAnchorElement).href))
        .catch(() => [] as string[])

      const githubLinks = await page
        .locator(DETAIL_SELECTORS.FOUNDER_GITHUB)
        .evaluateAll((els) => els.map((el) => (el as HTMLAnchorElement).href))
        .catch(() => [] as string[])

      const founders: Record<string, FounderSocials> = {}
      founderNames.forEach((name, idx) => {
        const trimmed = name.trim()
        if (!trimmed) return
        const socials: FounderSocials = {}
        if (linkedinLinks[idx]) socials.linkedin = linkedinLinks[idx]
        if (twitterLinks[idx]) socials.twitter = twitterLinks[idx]
        if (githubLinks[idx]) socials.github = githubLinks[idx]
        founders[trimmed] = socials
      })

      enriched.push({
        ...company,
        founders: Object.keys(founders).length > 0 ? founders : company.founders,
      })
    }

    return enriched
  } finally {
    await browser.close()
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ScrapeOptions {
  /** Whether to visit each company's detail page to collect founder socials. */
  enrichDetails?: boolean
  /** Delay between requests in ms when enriching (default: DEFAULT_SCRAPE_DELAY_MS). */
  delayMs?: number
  /** Called after each company is processed (useful for progress tracking). */
  onProgress?: (scraped: number, total: number) => void
}

/**
 * Scrape all companies for a given YC batch via Algolia (no browser for base data).
 *
 * @param season  e.g. "Winter" | "Spring" | "Summer" | "Fall"
 * @param year    Two-digit year string, e.g. "26" for 2026
 * @param options Scraping configuration
 */
export async function scrapeBatch(
  season: YcSeason,
  year: string,
  options: ScrapeOptions = {},
): Promise<Company[]> {
  const { enrichDetails = false, delayMs = DEFAULT_SCRAPE_DELAY_MS, onProgress } = options

  const batchLabel = buildBatchLabel(season, year)
  const hits = await fetchBatchFromAlgolia(batchLabel)
  const scrapedAt = new Date().toISOString()

  let companies = hits.map((hit) => hitToCompany(hit, scrapedAt))

  if (enrichDetails && companies.length > 0) {
    const total = companies.length
    let processed = 0

    const enriched: Company[] = []
    for (const company of companies) {
      const rich = await enrichWithFounders([company], delayMs)
      enriched.push(...rich)
      processed++
      onProgress?.(processed, total)
    }
    companies = enriched
  } else if (onProgress) {
    onProgress(companies.length, companies.length)
  }

  return companies
}
