/** YC batch seasons. Matches the URL parameter exactly (URL-encoded space handled in buildBatchUrl). */
export const YC_SEASONS = ["Winter", "Spring", "Summer", "Fall"] as const
export type YcSeason = (typeof YC_SEASONS)[number]

export const YC_BASE_URL = process.env["YC_BASE_URL"] ?? "https://www.ycombinator.com"

/** Build the YC directory URL for a given season + 2-digit year, e.g. "Spring 26". */
export function buildBatchUrl(season: YcSeason, year: string): string {
  const batch = buildBatchLabel(season, year)
  return `${YC_BASE_URL}/companies?batch=${encodeURIComponent(batch)}`
}

/**
 * Build the batch label as Algolia stores it, e.g. "Winter 2026".
 * Converts 2-digit year "26" → full "2026" (assumes 2000s).
 */
export function buildBatchLabel(season: YcSeason, year: string): string {
  const fullYear = year.length === 2 ? `20${year}` : year
  return `${season} ${fullYear}`
}

/** Default delay between page requests in milliseconds (be polite). */
export const DEFAULT_SCRAPE_DELAY_MS = Number(process.env["SCRAPE_DELAY_MS"] ?? 1500)

// ---------------------------------------------------------------------------
// Algolia (YC's public search API — credentials are baked into their JS bundle)
// ---------------------------------------------------------------------------

export const ALGOLIA_APP_ID = "45BWZJ1SGC"
/** Public search-only key embedded in the YC site's JS bundle. */
export const ALGOLIA_API_KEY =
  "NzllNTY5MzJiZGM2OTY2ZTQwMDEzOTNhYWZiZGRjODlhYzVkNjBmOGRjNzJiMWM4ZTU0ZDlhYTZjOTJiMjlhMWFuYWx5dGljc1RhZ3M9eWNkYyZyZXN0cmljdEluZGljZXM9WUNDb21wYW55X3Byb2R1Y3Rpb24lMkNZQ0NvbXBhbnlfQnlfTGF1bmNoX0RhdGVfcHJvZHVjdGlvbiZ0YWdGaWx0ZXJzPSU1QiUyMnljZGNfcHVibGljJTIyJTVE"
export const ALGOLIA_INDEX = "YCCompany_production"
export const ALGOLIA_HITS_PER_PAGE = 1000

/** Selectors used on individual company detail pages (for founder enrichment only). */
export const DETAIL_SELECTORS = {
  FOUNDER_NAME: '[class*="founder"] [class*="name"], [data-testid="founder-name"]',
  FOUNDER_LINKEDIN: 'a[href*="linkedin.com"]',
  FOUNDER_TWITTER: 'a[href*="twitter.com"], a[href*="x.com"]',
  FOUNDER_GITHUB: 'a[href*="github.com"]',
} as const
