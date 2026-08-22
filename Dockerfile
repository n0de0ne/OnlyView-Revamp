# Villa ONLY VIEW — production image
# Multi-stage build → Next.js standalone server (~250 MB final image).
#
#   docker build -t onlyview .
#   docker run -p 3000:3000 -v /path/to/appdata:/data onlyview
#
# The SQLite database and photo uploads live in the /data volume.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Public URL baked into static pages/OG tags (override for another domain)
ARG NEXT_PUBLIC_SITE_URL=https://onlyviewstbarth.com
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
# No database at build time: pages fall back to bundled defaults/manifest
ENV DATABASE_URL="file:/tmp/build.db"
RUN npx prisma generate && npx next build

# Standalone Prisma CLI install (own dependency tree, used by the entrypoint
# for first-boot `db push` — kept separate from the traced app node_modules)
FROM node:22-alpine AS prismacli
WORKDIR /cli
RUN npm init -y >/dev/null 2>&1 && npm install --omit=dev prisma@^6.16.0 bcryptjs@^3.0.2

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL="file:/data/onlyview.db"

# Standalone server + assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma schema + seed + CLI (first-boot `db push` + idempotent seeding)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/data/photos.json ./src/data/photos.json
COPY --from=prismacli /cli/node_modules ./prisma-cli/node_modules
# seed.mjs runs with plain node; bcryptjs isn't in the traced standalone tree
COPY --from=prismacli /cli/node_modules/bcryptjs ./node_modules/bcryptjs

COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
# su-exec: start as root to own the /data bind mount, then drop to PUID:PGID
RUN apk add --no-cache su-exec && chmod +x /docker-entrypoint.sh && mkdir -p /data

EXPOSE 3000
VOLUME /data

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3000/api/availability >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
