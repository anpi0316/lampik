#!/usr/bin/env bash
# Собирает папку для флешки: локальные библиотеки + env.local.js
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/dist-usb}"
VENDOR="$ROOT/vendor"

mkdir -p "$VENDOR" "$OUT"

node "$ROOT/scripts/generate-env-local.js"

PHASER_URL="https://cdn.jsdelivr.net/npm/phaser@3.88.1/dist/phaser.min.js"
GSAP_URL="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"
DRAG_URL="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/Draggable.min.js"

for pair in "phaser.min.js:$PHASER_URL" "gsap.min.js:$GSAP_URL" "Draggable.min.js:$DRAG_URL"; do
  file="${pair%%:*}"
  url="${pair#*:}"
  dest="$VENDOR/$file"
  if [[ ! -f "$dest" ]]; then
    echo "Скачиваю $file …"
    curl -fsSL "$url" -o "$dest"
  fi
done

echo "Копирую в $OUT …"
rsync -a --delete \
  --exclude '.git' \
  --exclude '.DS_Store' \
  --exclude 'dist-usb' \
  --exclude '.env' \
  "$ROOT/" "$OUT/"

echo ""
echo "Готово. Скопируйте папку на флешку:"
echo "  $OUT"
echo "Откройте index.html двойным щелчком (Chrome/Safari)."