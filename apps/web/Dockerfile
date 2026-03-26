FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* vars are baked at build time.
# Railway injects all dashboard env vars into the Docker build environment,
# so NEXT_PUBLIC_ADMIN_KEY and NEXT_PUBLIC_API_URL set in the Railway
# web service variables panel will be available here automatically.
RUN npm run build

# ---------------------------------------------------------------------------
# Runner — lean image with only the standalone output
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public 2>/dev/null || true

EXPOSE 3000

ENV HOSTNAME=0.0.0.0

# Next.js standalone server respects the PORT env var set by Railway
CMD ["node", "server.js"]
