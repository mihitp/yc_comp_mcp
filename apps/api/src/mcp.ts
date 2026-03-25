import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { CompanyRepository, MetadataRepository } from "@yc-mcp/db"
import { GetCompaniesParamsSchema, ok } from "@yc-mcp/shared"
import { z } from "zod"

const companyRepo = new CompanyRepository()
const metaRepo = new MetadataRepository()

export const mcpServer = new McpServer({
  name: "yc-companies",
  version: "0.1.0",
})

// ---------------------------------------------------------------------------
// Tool: get_companies
// ---------------------------------------------------------------------------

mcpServer.tool(
  "get_companies",
  "Retrieve YC companies filtered by batch and/or category. Returns company details including founders, website, and description.",
  {
    batch: z
      .string()
      .optional()
      .describe(
        'YC batch label, e.g. "Spring 26" or "Winter 25". Use list_batches to see available options.',
      ),
    category: z
      .string()
      .optional()
      .describe('Industry/category filter, e.g. "B2B" or "Healthcare".'),
    limit: z.number().int().min(1).max(200).optional().describe("Max results to return (1–200)."),
  },
  async ({ batch, category, limit }) => {
    const params = GetCompaniesParamsSchema.parse({ batch, category, limit })
    const companies = await companyRepo.query(params)
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(ok(companies), null, 2),
        },
      ],
    }
  },
)

// ---------------------------------------------------------------------------
// Tool: list_batches
// ---------------------------------------------------------------------------

mcpServer.tool(
  "list_batches",
  "List all YC batches that have been scraped and are available in the database.",
  {},
  async () => {
    const batches = await metaRepo.listBatches()
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(ok(batches), null, 2),
        },
      ],
    }
  },
)

// ---------------------------------------------------------------------------
// Tool: get_company
// ---------------------------------------------------------------------------

mcpServer.tool(
  "get_company",
  "Get a single YC company by its batch and slug (URL identifier).",
  {
    batch: z.string().describe('YC batch label, e.g. "Spring 26".'),
    slug: z.string().describe('Company URL slug, e.g. "stripe" or "airbnb".'),
  },
  async ({ batch, slug }) => {
    const company = await companyRepo.getCompany(batch, slug)
    return {
      content: [
        {
          type: "text",
          text: company
            ? JSON.stringify(ok(company), null, 2)
            : JSON.stringify({ ok: false, data: null, error: "Company not found" }),
        },
      ],
    }
  },
)
