export default function HomePage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>YC Companies MCP</h1>
      <p style={{ color: "#555", lineHeight: 1.6 }}>
        An MCP server that exposes Y Combinator company data — queryable by batch, category, and
        more. Connect it to any MCP-compatible AI assistant.
      </p>

      <h2 style={{ marginTop: "2.5rem" }}>Quick Start</h2>
      <p>Add the following to your MCP client configuration:</p>
      <pre
        style={{
          background: "#1e1e1e",
          color: "#d4d4d4",
          padding: "1.25rem",
          borderRadius: "0.5rem",
          overflowX: "auto",
          fontSize: "0.875rem",
        }}
      >
        {JSON.stringify(
          {
            mcpServers: {
              "yc-companies": {
                url: "https://api.yc-mcp.example.com/mcp",
              },
            },
          },
          null,
          2,
        )}
      </pre>

      <h2 style={{ marginTop: "2.5rem" }}>Available Tools</h2>
      <ul style={{ lineHeight: 2 }}>
        <li>
          <code>get_companies</code> — filter by <code>batch</code>, <code>category</code>, and{" "}
          <code>limit</code>
        </li>
        <li>
          <code>get_company</code> — fetch a single company by batch + slug
        </li>
        <li>
          <code>list_batches</code> — list all scraped batches
        </li>
      </ul>

      <h2 style={{ marginTop: "2.5rem" }}>REST API</h2>
      <ul style={{ lineHeight: 2 }}>
        <li>
          <code>GET /companies?batch=Spring+26&amp;category=B2B</code>
        </li>
        <li>
          <code>GET /companies/batches</code>
        </li>
        <li>
          <code>{"GET /companies/:batch/:slug"}</code>
        </li>
      </ul>
    </main>
  )
}
