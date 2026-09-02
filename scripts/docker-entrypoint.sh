#!/bin/sh
# First-boot friendly entrypoint:
#   1. as root: own the /data volume (photo uploads), then drop to PUID:PGID
#   2. pin the app to its own PostgreSQL schema namespace (never touches the
#      legacy PHP tables living in `public`)
#   3. create/update the app tables (`prisma db push`, additive within the
#      app schema only) and run the idempotent base seed
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

if [ -z "$DATABASE_URL" ]; then
  echo "[onlyview] ERROR: DATABASE_URL is required, e.g."
  echo "  postgresql://user:password@host:5432/onlyview?schema=onlyview_app"
  exit 1
fi

# SAFETY: without an explicit schema, Prisma would manage `public` — where the
# legacy PHP tables live — and `db push` drops tables it doesn't know about.
# Pin the app to its own namespace unless one was chosen deliberately.
case "$DATABASE_URL" in
  *schema=*) : ;;
  *\?*) DATABASE_URL="${DATABASE_URL}&schema=onlyview_app" ;;
  *) DATABASE_URL="${DATABASE_URL}?schema=onlyview_app" ;;
esac
export DATABASE_URL

# Public address for the links the server hands out (emails, contract and
# portal links, redirects). NEXT_PUBLIC_* values are baked into the bundle when
# the image is built, so the one set here only reaches the app through SITE_URL.
if [ -z "$SITE_URL" ] && [ -n "$NEXT_PUBLIC_SITE_URL" ]; then
  SITE_URL="$NEXT_PUBLIC_SITE_URL"
fi
export SITE_URL
if [ -n "$SITE_URL" ]; then
  echo "[onlyview] public site URL: $SITE_URL"
else
  echo "[onlyview] no SITE_URL set — links will use https://onlyviewstbarth.com"
fi

echo "[onlyview] database: $(echo "$DATABASE_URL" | sed 's|//[^@]*@|//***@|')"
node prisma-cli/node_modules/prisma/build/index.js db push --skip-generate --schema prisma/schema.prisma

# Base settings/admin/photos; add SEED_DEMO=1 for a demo dataset
node prisma/seed.mjs

echo "[onlyview] starting on port ${PORT:-3000}"
exec node server.js
