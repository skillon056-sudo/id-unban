#!/bin/bash
# Zero-downtime deploy on the VPS: build beside the live site, then swap.
set -euo pipefail
cd /var/www/id-unban

rm -rf .next-new
NEXT_DIST_DIR=.next-new npm run build

# Carry the previous build's static assets over, without overwriting new ones:
# pages already open in a visitor's browser still reference the old hashes.
if [ -d .next/static ]; then
  # --update=none: keep the new build's files. Plain -n exits non-zero on newer
  # coreutils when it skips anything, which would abort the swap under set -e.
  cp -r --update=none .next/static/. .next-new/static/
fi

rm -rf .next-old
mv .next .next-old
mv .next-new .next
pm2 restart id-unban --update-env >/dev/null

echo "deployed $(cat .next/BUILD_ID)"
