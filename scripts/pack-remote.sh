#!/usr/bin/env bash
# Собирает dist-remote/ — только файлы для удалённого хостинга (.deployignore).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/dist-remote}"
IGNORE="$ROOT/.deployignore"

if [[ ! -f "$IGNORE" ]]; then
  echo "Нет .deployignore в $ROOT"
  exit 1
fi

mkdir -p "$OUT"
rsync -a --delete --exclude-from="$IGNORE" "$ROOT/" "$OUT/"

echo ""
echo "Пакет для хостинга: $OUT"
echo "Не включено (см. DEPLOY.md): vendor/, env.local.js, scripts/, dist-*"
echo "На сервере обязательно: .env, assets/, video/"