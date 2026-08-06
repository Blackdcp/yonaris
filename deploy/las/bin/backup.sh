#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/yonaris}"
COMPOSE_FILE="${COMPOSE_FILE:-$(cd -- "$SCRIPT_DIR/.." && pwd)/compose.yaml}"
ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"
BACKUP_DIR="${BACKUP_DIR:-$DEPLOY_ROOT/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing production environment file: $ENV_FILE" >&2
  exit 1
fi

cd -- "$(dirname -- "$COMPOSE_FILE")"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_DIR/yonaris-$timestamp.dump"

compose=(docker compose --project-name yonaris --env-file "$ENV_FILE" --file "$COMPOSE_FILE")

"${compose[@]}" up -d postgres >/dev/null
"${compose[@]}" exec -T postgres pg_dump \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --format custom \
  --no-owner \
  --no-acl >"$backup_file"

sha256sum "$backup_file" >"$backup_file.sha256"

find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'yonaris-*.dump' -o -name 'yonaris-*.dump.sha256' \) \
  -mtime "+$BACKUP_RETENTION_DAYS" -delete

echo "$backup_file"
