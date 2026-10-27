#!/usr/bin/env sh
# Резервная копия базы и ключа шифрования: deploy/backup.sh [папка]. Хранит последние 14 копий.
# Копия снимается через VACUUM INTO, поэтому игру останавливать не нужно.
set -eu
cd "$(dirname "$0")"
dest="${1:-./backups}"
stamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$dest"
docker compose exec -T kapital node -e "
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync('/data/kapital.sqlite');
  db.exec(\"VACUUM INTO '/data/backup.sqlite'\");
  db.close();
" 2>/dev/null
docker compose cp kapital:/data/backup.sqlite "$dest/kapital-$stamp.sqlite"
docker compose exec -T kapital rm -f /data/backup.sqlite
# ключ не меняется, но без него копия бесполезна
docker compose cp kapital:/data/secret.key "$dest/secret.key" 2>/dev/null || true
ls -1t "$dest"/kapital-*.sqlite | tail -n +15 | xargs -r rm -f
echo "Копия: $dest/kapital-$stamp.sqlite"
