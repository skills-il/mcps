# syntax=docker/dockerfile:1
#
# Build context is the REPO ROOT, not this directory, because the host depends
# on its 17 sibling packages via `file:../<pkg>`:
#
#   docker build -f mcp-http-host/Dockerfile -t skills-il-mcp-http-host .
#   docker run -p 8080:8080 -e MCP_ALLOWED_HOSTS=localhost:8080 skills-il-mcp-http-host
#
# Publishing/deploying this image is deliberately OUT of scope here; the
# consuming side owns its own registry and private networking.

# ---------- builder ----------
FROM node:22-slim AS builder
WORKDIR /app

COPY . .

# Each package vendors its own MCP SDK version, so each installs and builds
# independently. The host build then runs verify:adapters, which fails loudly
# if any upstream index.ts drifted from its generated adapter.
RUN set -eux; \
    for d in *-mcp; do \
      echo "building $d"; \
      (cd "$d" && npm install --no-audit --no-fund --loglevel=error && npm run build); \
    done; \
    (cd mcp-http-host && npm install --no-audit --no-fund --loglevel=error && npm run build)

# ---------- runtime ----------
FROM node:22-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app

COPY --from=builder --chown=node:node /app /app

# Drop build-only dependencies (typescript, tsx, @types/*).
RUN set -eux; \
    for d in *-mcp; do (cd "$d" && npm prune --omit=dev --loglevel=error); done; \
    (cd mcp-http-host && npm prune --omit=dev --loglevel=error); \
    npm cache clean --force

USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "mcp-http-host/dist/index.js"]
