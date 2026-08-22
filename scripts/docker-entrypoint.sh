#!/bin/sh
# First-boot friendly entrypoint:
#   1. as root: own the /data volume (bind mounts arrive root-owned on
#      Unraid & co.), wire the uploads symlink, then drop to PUID:PGID
#   2. create/migrate the SQLite schema in /data
#   3. seed base configuration (idempotent upserts — never overwrites edits)
#   4. start the standalone Next.js server
set -e

PUID="${PUID:-99}"
PGID="${PGID:-100}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p /data/uploads

  # Photo uploads must survive image updates → keep them in the /data volume
  if [ ! -L public/media/photos/uploads ]; then
    rm -rf public/media/photos/uploads
    ln -s /data/uploads public/media/photos/uploads
  fi

  chown -R "$PUID:$PGID" /data
  echo "[onlyview] running as $PUID:$PGID"
  exec su-exec "$PUID:$PGID" "$0" "$@"
fi

echo "[onlyview] database: $DATABASE_URL"
node prisma-cli/node_modules/prisma/build/index.js db push --skip-generate --schema prisma/schema.prisma

# Base settings/admin/photos; add SEED_DEMO=1 for a demo dataset
node prisma/seed.mjs

echo "[onlyview] starting on port ${PORT:-3000}"
exec node server.js
