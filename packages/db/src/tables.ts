/**
 * DynamoDB table and index names.
 * Centralised here so they can be imported from env or changed without hunting through code.
 */
export const TABLES = {
  COMPANIES: process.env["DYNAMO_TABLE_NAME"] ?? "yc-companies",
  METADATA: process.env["DYNAMO_METADATA_TABLE_NAME"] ?? "yc-metadata",
} as const

export const INDEXES = {
  /** GSI: PK=category, SK=batch — for filtering by category */
  CATEGORY: "category-index",
} as const

/** Special PK used in the metadata table to store the list of scraped batches */
export const METADATA_KEYS = {
  BATCHES: "BATCHES",
  CATEGORIES: "CATEGORIES",
  SCRAPE_JOB_PREFIX: "JOB#",
} as const
