import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type NativeAttributeValue,
} from "@aws-sdk/lib-dynamodb"
import type { Company, GetCompaniesParams, ScrapeJob } from "@yc-mcp/shared"
import { getDocClient } from "./client.js"
import { INDEXES, METADATA_KEYS, TABLES } from "./tables.js"

// ---------------------------------------------------------------------------
// Company repository
// ---------------------------------------------------------------------------

/**
 * All DynamoDB interactions for companies live here.
 * Business logic never touches the SDK directly.
 */
export class CompanyRepository {
  private get client() {
    return getDocClient()
  }

  /** Upsert a company record. Safe to call multiple times (idempotent). */
  async putCompany(company: Company): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: TABLES.COMPANIES,
        Item: company as Record<string, NativeAttributeValue>,
      }),
    )
  }

  /** Upsert multiple companies in parallel (no DynamoDB batch limit concerns at <25 items). */
  async putCompanies(companies: Company[]): Promise<void> {
    await Promise.all(companies.map((c) => this.putCompany(c)))
  }

  /** Get a single company by its batch + slug (primary key). */
  async getCompany(batch: string, slug: string): Promise<Company | undefined> {
    const result = await this.client.send(
      new GetCommand({
        TableName: TABLES.COMPANIES,
        Key: { batch, slug },
      }),
    )
    return result.Item as Company | undefined
  }

  /** Get all companies in a batch. */
  async getByBatch(batch: string): Promise<Company[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: TABLES.COMPANIES,
        KeyConditionExpression: "#batch = :batch",
        ExpressionAttributeNames: { "#batch": "batch" },
        ExpressionAttributeValues: { ":batch": batch },
      }),
    )
    return (result.Items ?? []) as Company[]
  }

  /** Get companies by category, optionally filtered to a specific batch via the GSI. */
  async getByCategory(category: string, batch?: string): Promise<Company[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: TABLES.COMPANIES,
        IndexName: INDEXES.CATEGORY,
        KeyConditionExpression: batch
          ? "#category = :category AND #batch = :batch"
          : "#category = :category",
        ExpressionAttributeNames: {
          "#category": "category",
          ...(batch && { "#batch": "batch" }),
        },
        ExpressionAttributeValues: {
          ":category": category,
          ...(batch && { ":batch": batch }),
        },
      }),
    )
    return (result.Items ?? []) as Company[]
  }

  /** Route to the right query based on what params are provided. */
  async query(params: GetCompaniesParams): Promise<Company[]> {
    if (params.batch && params.category) {
      // Both: filter by category via GSI, then filter locally by batch
      const byCategory = await this.getByCategory(params.category, params.batch)
      return byCategory.slice(0, params.limit)
    }
    if (params.batch) {
      const results = await this.getByBatch(params.batch)
      return results.slice(0, params.limit)
    }
    if (params.category) {
      const results = await this.getByCategory(params.category)
      return results.slice(0, params.limit)
    }
    return []
  }

  /** Delete a company record (used for cleanup). */
  async deleteCompany(batch: string, slug: string): Promise<void> {
    await this.client.send(
      new DeleteCommand({
        TableName: TABLES.COMPANIES,
        Key: { batch, slug },
      }),
    )
  }
}

// ---------------------------------------------------------------------------
// Metadata repository (batches list + scrape jobs)
// ---------------------------------------------------------------------------

export class MetadataRepository {
  private get client() {
    return getDocClient()
  }

  /** Record a batch as having been scraped (idempotent). */
  async recordBatch(batch: string): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: TABLES.METADATA,
        Key: { pk: METADATA_KEYS.BATCHES, sk: batch },
        UpdateExpression: "SET #at = :at",
        ExpressionAttributeNames: { "#at": "recordedAt" },
        ExpressionAttributeValues: { ":at": new Date().toISOString() },
      }),
    )
  }

  /** List all scraped batches. */
  async listBatches(): Promise<string[]> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: TABLES.METADATA,
        KeyConditionExpression: "#pk = :pk",
        ExpressionAttributeNames: { "#pk": "pk" },
        ExpressionAttributeValues: { ":pk": METADATA_KEYS.BATCHES },
      }),
    )
    return ((result.Items ?? []) as Array<{ sk: string }>).map((i) => i.sk)
  }

  /** Upsert a scrape job record. */
  async putJob(job: ScrapeJob): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: TABLES.METADATA,
        Item: {
          pk: `${METADATA_KEYS.SCRAPE_JOB_PREFIX}${job.id}`,
          sk: job.id,
          ...job,
        } as Record<string, NativeAttributeValue>,
      }),
    )
  }

  /** Fetch a scrape job by ID. */
  async getJob(id: string): Promise<ScrapeJob | undefined> {
    const result = await this.client.send(
      new GetCommand({
        TableName: TABLES.METADATA,
        Key: { pk: `${METADATA_KEYS.SCRAPE_JOB_PREFIX}${id}`, sk: id },
      }),
    )
    return result.Item as ScrapeJob | undefined
  }
}
