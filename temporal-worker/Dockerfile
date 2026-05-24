# Build context: repo root (docker-compose sets context: .)
FROM node:20-slim AS deps
WORKDIR /app
# Copy all workspace manifests so npm can resolve the workspace graph
COPY package.json package-lock.json ./
COPY temporal-worker/package.json ./temporal-worker/
COPY nextjs-app/package.json ./nextjs-app/
RUN npm ci --ignore-scripts

# ── build ─────────────────────────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY temporal-worker/ ./temporal-worker/
RUN cd temporal-worker && npm run build

# ── runner ────────────────────────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

RUN groupadd --system --gid 1001 nodejs && \
    useradd  --system --uid 1001 --gid nodejs worker

# Copy hoisted node_modules (all workspace deps are hoisted to root)
COPY --from=deps --chown=worker:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=worker:nodejs /app/temporal-worker/dist ./temporal-worker/dist
COPY --chown=worker:nodejs temporal-worker/package.json ./temporal-worker/

USER worker

CMD ["node", "temporal-worker/dist/worker.js"]
