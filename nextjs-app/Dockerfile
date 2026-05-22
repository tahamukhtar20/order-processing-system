# Build context: repo root (docker-compose sets context: .)
FROM node:20-alpine AS deps
WORKDIR /app
# Copy all workspace manifests so npm can resolve the workspace graph
COPY package.json package-lock.json ./
COPY temporal-worker/package.json ./temporal-worker/
COPY nextjs-app/package.json ./nextjs-app/
RUN npm ci --ignore-scripts

# ── builder ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules

# Copy nextjs-app source and the shared types it depends on via @worker-types alias
COPY nextjs-app/ ./nextjs-app/
COPY temporal-worker/src/shared/ ./temporal-worker/src/shared/

ENV TEMPORAL_ADDRESS=temporal:7233
ENV NEXT_TELEMETRY_DISABLED=1

RUN cd nextjs-app && npm run build

# ── runner ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# standalone output bundles server.js + required node_modules
COPY --from=builder --chown=nextjs:nodejs /app/nextjs-app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/nextjs-app/.next/static ./nextjs-app/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/nextjs-app/public ./nextjs-app/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "nextjs-app/server.js"]
