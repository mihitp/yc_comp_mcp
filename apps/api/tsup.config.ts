import { defineConfig } from "tsup"

export default defineConfig([
  // Lambda handler bundle
  {
    entry: { handler: "src/handler.ts" },
    format: ["cjs"],
    dts: false,
    clean: true,
    sourcemap: true,
    external: ["@aws-sdk/client-dynamodb", "@aws-sdk/lib-dynamodb", "@yc-mcp/scraper", "playwright", "playwright-core"],
    platform: "node",
    target: "node20",
    noExternal: ["hono", "@modelcontextprotocol/sdk", "@yc-mcp/shared", "@yc-mcp/db"],
  },
  // Standalone HTTP server (local dev)
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: false,
    sourcemap: true,
    external: ["@aws-sdk/client-dynamodb", "@aws-sdk/lib-dynamodb", "@yc-mcp/scraper", "playwright", "playwright-core"],
    platform: "node",
    target: "node20",
  },
])
