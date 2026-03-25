import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { HTTPException } from "hono/http-exception"
import { err } from "@yc-mcp/shared"
import { companiesRouter } from "./routes/companies.js"
import { adminRouter } from "./routes/admin.js"
import { mcpServer } from "./mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"

export const app = new Hono()

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use("*", logger())
app.use(
  "*",
  cors({
    origin: (origin) => origin, // echo origin — tighten in production
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "x-admin-key"],
  }),
)

// ---------------------------------------------------------------------------
// REST routes
// ---------------------------------------------------------------------------

app.route("/companies", companiesRouter)
app.route("/admin", adminRouter)

// ---------------------------------------------------------------------------
// MCP endpoint (HTTP Streamable transport)
// ---------------------------------------------------------------------------

app.post("/mcp", async (c) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  })
  await mcpServer.connect(transport)

  const body = await c.req.text()
  const response = await transport.handleRequest(
    new Request(c.req.url, {
      method: "POST",
      headers: c.req.raw.headers,
      body,
    }),
  )

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  })
})

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get("/health", (c) => c.json({ ok: true, service: "yc-mcp-api", ts: new Date().toISOString() }))

// ---------------------------------------------------------------------------
// 404 + global error handler
// ---------------------------------------------------------------------------

app.notFound((c) => c.json(err("Not found"), 404))

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json(err(error.message), error.status)
  }
  console.error("[unhandled error]", error)
  return c.json(err("Internal server error"), 500)
})
