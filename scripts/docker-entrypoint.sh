#!/bin/sh
# First-boot friendly entrypoint:
#   1. create/migrate the SQLite schema in /data
#   2. seed base configuration (idempotent upserts — never overwrites edits)
#   3. persist photo uploads in /data
#   4. start the standalone Next.js server
set -e

echo "[onlyview] database: $DATABASE_URL"
node prisma-cli/node_modules/prisma/build/index.js db push --skip-generate --schema prisma/schema.prisma

# Base settings/admin/photos; add SEED_DEMO=1 for a demo dataset
node prisma/seed.mjs

# Photo uploads must survive image updates → keep them in the /data volume
mkdir -p /data/uploads
if [ ! -L public/media/photos/uploads ]; then
  rm -rf public/media/photos/uploads
  ln -s /data/uploads public/media/photos/uploads
fi

echo "[onlyview] starting on port ${PORT:-3000}"
exec node server.js
