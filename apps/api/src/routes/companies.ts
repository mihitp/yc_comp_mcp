import { Hono } from "hono"
import { CompanyRepository, MetadataRepository } from "@yc-mcp/db"
import { err, GetCompaniesParamsSchema, ok } from "@yc-mcp/shared"
import { z } from "zod"

const companyRepo = new CompanyRepository()
const metaRepo = new MetadataRepository()

export const companiesRouter = new Hono()

// GET /companies?batch=Spring+26&category=B2B&limit=50
companiesRouter.get("/", async (c) => {
  const raw = {
    batch: c.req.query("batch"),
    category: c.req.query("category"),
    limit: c.req.query("limit") ? Number(c.req.query("limit")) : undefined,
  }

  const parsed = GetCompaniesParamsSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json(err(parsed.error.message), 400)
  }

  const companies = await companyRepo.query(parsed.data)
  return c.json(ok(companies))
})

// GET /companies/batches
companiesRouter.get("/batches", async (c) => {
  const batches = await metaRepo.listBatches()
  return c.json(ok(batches))
})

// GET /companies/:batch/:slug
companiesRouter.get("/:batch/:slug", async (c) => {
  const { batch, slug } = c.req.param()
  const company = await companyRepo.getCompany(batch, slug)
  if (!company) {
    return c.json(err("Company not found"), 404)
  }
  return c.json(ok(company))
})
