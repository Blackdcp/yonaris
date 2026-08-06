#!/usr/bin/env bash

set -Eeuo pipefail

if [[ $# -lt 2 ]] || [[ $# -gt 3 ]]; then
  echo "Usage: $0 /absolute/path/to/database.dump /absolute/path/to/manifest.txt [--verify-only]" >&2
  exit 2
fi

dump_file="$1"
manifest_file="$2"
verify_only=false
if [[ "${3:-}" == "--verify-only" ]]; then
  verify_only=true
elif [[ -n "${3:-}" ]]; then
  echo "Unknown option: $3" >&2
  exit 2
fi
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/yonaris}"
COMPOSE_FILE="${COMPOSE_FILE:-$(cd -- "$SCRIPT_DIR/.." && pwd)/compose.yaml}"
ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"

for file in "$dump_file" "$manifest_file" "$COMPOSE_FILE" "$ENV_FILE"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing required file: $file" >&2
    exit 1
  fi
done

cd -- "$(dirname -- "$COMPOSE_FILE")"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

compose=(docker compose --project-name yonaris --env-file "$ENV_FILE" --file "$COMPOSE_FILE")

"${compose[@]}" up -d postgres

database_ready=false
for _ in $(seq 1 30); do
  if "${compose[@]}" exec -T postgres pg_isready --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" >/dev/null 2>&1; then
    database_ready=true
    break
  fi
  sleep 2
done

if [[ "$database_ready" != true ]]; then
  echo "PostgreSQL did not become ready." >&2
  exit 1
fi

if [[ "$verify_only" != true ]]; then
  public_table_count="$(
    "${compose[@]}" exec -T postgres psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align \
      --command "select count(*) from pg_tables where schemaname = 'public'" </dev/null
  )"

  if [[ "$public_table_count" != 0 ]]; then
    echo "Refusing initial restore: the public schema already has $public_table_count tables." >&2
    exit 1
  fi

  "${compose[@]}" exec -T postgres pg_restore \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --exit-on-error \
    --no-owner \
    --no-acl <"$dump_file"
fi

manifest_table_count="$(awk '
  /^\[row_counts\]$/ { in_counts = 1; next }
  in_counts && /^[a-z_]+=[0-9]+$/ { count++ }
  END { print count + 0 }
' "$manifest_file")"

if [[ "$manifest_table_count" -eq 0 ]]; then
  echo "The manifest did not contain row counts." >&2
  exit 1
fi

in_row_counts=false
checked_tables=0
while IFS='=' read -r table expected; do
  if [[ "$table" == "[row_counts]" ]]; then
    in_row_counts=true
    continue
  fi
  if [[ "$in_row_counts" != true ]] || [[ -z "$table" ]]; then
    continue
  fi
  if [[ ! "$table" =~ ^[a-z_]+$ ]] || [[ ! "$expected" =~ ^[0-9]+$ ]]; then
    echo "Invalid row-count manifest entry: $table=$expected" >&2
    exit 1
  fi

  actual="$(
    "${compose[@]}" exec -T postgres psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align \
      --command "select count(*) from public.$table" </dev/null
  )"
  if [[ "$actual" != "$expected" ]]; then
    echo "Row-count mismatch for $table: expected $expected, got $actual" >&2
    exit 1
  fi
  printf '%s=%s\n' "$table" "$actual"
  checked_tables=$((checked_tables + 1))
done <"$manifest_file"

if [[ "$checked_tables" -ne "$manifest_table_count" ]]; then
  echo "Verified $checked_tables tables, but the manifest contains $manifest_table_count." >&2
  exit 1
fi

echo "Initial Yonaris restore verified across $checked_tables tables."
