/**
 * Standalone HTTP server for local development.
 * In production, use the Lambda handler (handler.ts) instead.
 */
import { serve } from "@hono/node-server"
import { app } from "./app.js"

const PORT = Number(process.env["PORT"] ?? 3001)

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[yc-mcp-api] Listening on http://localhost:${info.port}`)
})
