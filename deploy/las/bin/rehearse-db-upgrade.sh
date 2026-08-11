#!/usr/bin/env bash

set -Eeuo pipefail
set +x
umask 077

usage() {
  cat <<'USAGE'
Usage:
  rehearse-db-upgrade.sh /absolute/path/to/yonaris.dump \
    --image ghcr.io/blackdcp/yonaris-db-migrate:sha-<40-character-git-sha>
  rehearse-db-upgrade.sh /absolute/path/to/yonaris.dump --local-pnpm

Options:
  --image IMAGE              Run the immutable db-migrate image under test.
  --local-pnpm               Run the checked-out packages/lib migrations.
  --checksum FILE            Use this SHA-256 manifest instead of DUMP.sha256.
  --allow-unverified-backup  Continue without a SHA-256 manifest (logged).
  --allow-mutable-image      Permit a non-immutable image tag for local testing.
  --keep                     Keep the isolated Docker resources for inspection.
  --help                     Show this help.

Environment:
  KEEP_REHEARSAL=true        Same as --keep.
  REHEARSAL_LOG_DIR=DIR      Log directory (default: a private directory in /tmp).

The script never reads the production env file or Compose project and never
accepts a database URL. It restores only into resources it creates and labels
for this unique rehearsal run.
USAGE
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

if [[ $# -eq 0 ]] || [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

backup_file="$1"
shift

runner_mode=""
migration_image=""
checksum_file=""
checksum_explicit=false
allow_unverified_backup=false
allow_mutable_image=false
keep_rehearsal="${KEEP_REHEARSAL:-false}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image)
      [[ $# -ge 2 ]] || fail "--image requires a value."
      [[ -z "$runner_mode" ]] || fail "Choose exactly one migration runner."
      runner_mode=image
      migration_image="$2"
      shift 2
      ;;
    --local-pnpm)
      [[ -z "$runner_mode" ]] || fail "Choose exactly one migration runner."
      runner_mode=local-pnpm
      shift
      ;;
    --checksum)
      [[ $# -ge 2 ]] || fail "--checksum requires a value."
      checksum_file="$2"
      checksum_explicit=true
      shift 2
      ;;
    --allow-unverified-backup)
      allow_unverified_backup=true
      shift
      ;;
    --allow-mutable-image)
      allow_mutable_image=true
      shift
      ;;
    --keep)
      keep_rehearsal=true
      shift
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown option: $1"
      ;;
  esac
done

[[ "$keep_rehearsal" == true || "$keep_rehearsal" == false ]] || \
  fail "KEEP_REHEARSAL must be true or false."
[[ -n "$runner_mode" ]] || fail "Choose --image IMAGE or --local-pnpm."

[[ "$backup_file" == /* ]] || fail "The backup path must be absolute."
[[ "$backup_file" != *$'\n'* && "$backup_file" != *$'\r'* ]] || \
  fail "The backup path must not contain control characters."
[[ -f "$backup_file" && -r "$backup_file" ]] || \
  fail "Backup is not a readable regular file: $backup_file"
backup_file="$(readlink -f -- "$backup_file")"

if [[ -z "$checksum_file" ]]; then
  checksum_file="$backup_file.sha256"
else
  [[ "$checksum_file" == /* ]] || fail "The checksum path must be absolute."
  [[ -f "$checksum_file" && -r "$checksum_file" ]] || \
    fail "Explicit checksum is not a readable regular file: $checksum_file"
  checksum_file="$(readlink -f -- "$checksum_file")"
fi

if [[ "$runner_mode" == image ]]; then
  [[ "$migration_image" =~ ^[A-Za-z0-9][A-Za-z0-9._/@:-]{0,254}$ ]] || \
    fail "Invalid migration image reference: $migration_image"
  if [[ "$allow_mutable_image" != true ]] && \
    [[ ! "$migration_image" =~ :sha-[0-9a-f]{40}$ ]] && \
    [[ ! "$migration_image" =~ @sha256:[0-9a-f]{64}$ ]] && \
    [[ ! "$migration_image" =~ ^sha256:[0-9a-f]{64}$ ]]; then
    fail "Migration image must use :sha-<40>, @sha256:<64>, or an image ID. Use --allow-mutable-image only for local testing."
  fi
fi

for command_name in awk date docker readlink sed sha256sum tee tr; do
  command -v "$command_name" >/dev/null 2>&1 || fail "Missing required command: $command_name"
done
if [[ "$runner_mode" == local-pnpm ]]; then
  command -v pnpm >/dev/null 2>&1 || fail "Missing required command: pnpm"
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd -- "$SCRIPT_DIR/../../.." && pwd)"
POSTGRES_READY_SCRIPT="$SCRIPT_DIR/wait-rehearsal-postgres.sh"
JOURNAL_FILE="$REPOSITORY_ROOT/packages/lib/src/db/migrations/meta/_journal.json"
MIGRATIONS_DIR="$REPOSITORY_ROOT/packages/lib/src/db/migrations"
[[ -f "$POSTGRES_READY_SCRIPT" && -r "$POSTGRES_READY_SCRIPT" ]] || \
  fail "Missing rehearsal PostgreSQL readiness helper: $POSTGRES_READY_SCRIPT"
[[ -f "$JOURNAL_FILE" ]] || fail "Missing migration journal: $JOURNAL_FILE"

expected_migration_count="$(awk '/"tag"[[:space:]]*:/ { count++ } END { print count + 0 }' "$JOURNAL_FILE")"
expected_latest_tag="$(awk -F'"' '/"tag"[[:space:]]*:/ { tag=$4 } END { print tag }' "$JOURNAL_FILE")"
expected_latest_when="$(awk '
  /"when"[[:space:]]*:/ {
    value=$0
    sub(/.*"when"[[:space:]]*:[[:space:]]*/, "", value)
    sub(/[^0-9].*/, "", value)
    when=value
  }
  END { print when }
' "$JOURNAL_FILE")"

[[ "$expected_migration_count" =~ ^[1-9][0-9]*$ ]] || fail "Migration journal has no entries."
[[ "$expected_latest_tag" =~ ^[0-9]{4}_[A-Za-z0-9_-]+$ ]] || \
  fail "Invalid latest migration tag in journal: $expected_latest_tag"
[[ "$expected_latest_when" =~ ^[0-9]+$ ]] || fail "Invalid latest migration timestamp."
expected_latest_file="$MIGRATIONS_DIR/$expected_latest_tag.sql"
[[ -f "$expected_latest_file" ]] || fail "Missing latest migration file: $expected_latest_file"
expected_latest_hash="$(sha256sum -- "$expected_latest_file" | awk '{ print tolower($1) }')"
[[ "$expected_latest_hash" =~ ^[0-9a-f]{64}$ ]] || fail "Could not hash latest migration."

run_id="$(date -u +%Y%m%dT%H%M%SZ)-$$-${RANDOM}"
[[ "$run_id" =~ ^[0-9TZ-]+$ ]] || fail "Generated an unsafe rehearsal id."
resource_label="com.yonaris.db-upgrade-rehearsal"
db_container="yonaris-upgrade-rehearsal-db-$run_id"
migration_container="yonaris-upgrade-rehearsal-migrate-$run_id"
db_volume="yonaris-upgrade-rehearsal-data-$run_id"
db_network="yonaris-upgrade-rehearsal-net-$run_id"

for resource_name in "$db_container" "$migration_container" "$db_volume" "$db_network"; do
  [[ "$resource_name" =~ ^yonaris-upgrade-rehearsal-[a-z]+-[0-9TZ-]+$ ]] || \
    fail "Generated an unsafe Docker resource name: $resource_name"
done

log_dir="${REHEARSAL_LOG_DIR:-${TMPDIR:-/tmp}/yonaris-db-upgrade-rehearsals}"
[[ "$log_dir" == /* ]] || fail "REHEARSAL_LOG_DIR must be absolute."
mkdir -p -- "$log_dir"
log_file="$log_dir/$run_id.log"
exec > >(tee -a "$log_file") 2>&1

db_created=false
migration_created=false
volume_created=false
network_created=false

label_matches_container() {
  local container_name="$1"
  [[ "$(docker inspect --format "{{ index .Config.Labels \"$resource_label\" }}" "$container_name" 2>/dev/null || true)" == "$run_id" ]]
}

label_matches_volume() {
  [[ "$(docker volume inspect --format "{{ index .Labels \"$resource_label\" }}" "$db_volume" 2>/dev/null || true)" == "$run_id" ]]
}

label_matches_network() {
  [[ "$(docker network inspect --format "{{ index .Labels \"$resource_label\" }}" "$db_network" 2>/dev/null || true)" == "$run_id" ]]
}

cleanup() {
  local original_status=$?
  local cleanup_failed=false
  trap - EXIT INT TERM
  set +e

  if [[ "$keep_rehearsal" == true ]]; then
    echo "KEEP_REHEARSAL=true: preserving isolated resources for run $run_id."
    echo "Database container: $db_container"
    echo "Migration container: $migration_container"
    echo "Volume: $db_volume"
    echo "Network: $db_network"
    echo "Remove them later with exact-name docker rm/network rm/volume rm commands after checking label $resource_label=$run_id."
  else
    if [[ "$migration_created" == true ]] && docker container inspect "$migration_container" >/dev/null 2>&1; then
      if label_matches_container "$migration_container"; then
        docker container rm -f "$migration_container" >/dev/null || cleanup_failed=true
      else
        echo "Refusing to remove migration container with a mismatched safety label: $migration_container" >&2
        cleanup_failed=true
      fi
    fi
    if [[ "$db_created" == true ]] && docker container inspect "$db_container" >/dev/null 2>&1; then
      if label_matches_container "$db_container"; then
        docker container rm -f "$db_container" >/dev/null || cleanup_failed=true
      else
        echo "Refusing to remove database container with a mismatched safety label: $db_container" >&2
        cleanup_failed=true
      fi
    fi
    if [[ "$network_created" == true ]] && docker network inspect "$db_network" >/dev/null 2>&1; then
      if label_matches_network; then
        docker network rm "$db_network" >/dev/null || cleanup_failed=true
      else
        echo "Refusing to remove network with a mismatched safety label: $db_network" >&2
        cleanup_failed=true
      fi
    fi
    if [[ "$volume_created" == true ]] && docker volume inspect "$db_volume" >/dev/null 2>&1; then
      if label_matches_volume; then
        docker volume rm "$db_volume" >/dev/null || cleanup_failed=true
      else
        echo "Refusing to remove volume with a mismatched safety label: $db_volume" >&2
        cleanup_failed=true
      fi
    fi
    echo "Isolated rehearsal cleanup finished."
  fi

  echo "Rehearsal log: $log_file"
  if [[ "$original_status" -eq 0 && "$cleanup_failed" == true ]]; then
    original_status=1
  fi
  exit "$original_status"
}

trap cleanup EXIT
trap 'exit 130' INT TERM

echo "Yonaris database upgrade rehearsal: $run_id"
echo "Backup: $backup_file"
echo "Runner: $runner_mode${migration_image:+ ($migration_image)}"
echo "Expected latest migration: $expected_latest_tag ($expected_latest_when)"
echo "Safety: no Compose project or production environment file will be read."

actual_backup_hash="$(sha256sum -- "$backup_file" | awk '{ print tolower($1) }')"
[[ "$actual_backup_hash" =~ ^[0-9a-f]{64}$ ]] || fail "Could not hash the backup."
if [[ -f "$checksum_file" ]]; then
  expected_backup_hash="$(awk 'NR == 1 { print tolower($1) }' "$checksum_file")"
  [[ "$expected_backup_hash" =~ ^[0-9a-f]{64}$ ]] || \
    fail "Invalid SHA-256 manifest: $checksum_file"
  [[ "$actual_backup_hash" == "$expected_backup_hash" ]] || \
    fail "Backup SHA-256 does not match $checksum_file"
  echo "Backup SHA-256 verified: $actual_backup_hash"
elif [[ "$checksum_explicit" == true ]]; then
  fail "Explicit checksum disappeared before verification: $checksum_file"
elif [[ "$allow_unverified_backup" == true ]]; then
  echo "WARNING: no checksum manifest; calculated backup SHA-256 is $actual_backup_hash"
else
  fail "Missing checksum manifest: $checksum_file (use --allow-unverified-backup only for an intentional local test)."
fi

docker info >/dev/null
for resource_name in "$db_container" "$migration_container"; do
  if docker container inspect "$resource_name" >/dev/null 2>&1; then
    fail "Refusing an existing Docker container name: $resource_name"
  fi
done
if docker volume inspect "$db_volume" >/dev/null 2>&1; then
  fail "Refusing an existing Docker volume name: $db_volume"
fi
if docker network inspect "$db_network" >/dev/null 2>&1; then
  fail "Refusing an existing Docker network name: $db_network"
fi

docker network create \
  --label "$resource_label=$run_id" \
  "$db_network" >/dev/null
network_created=true
docker volume create \
  --label "$resource_label=$run_id" \
  "$db_volume" >/dev/null
volume_created=true

db_user=yonaris_rehearsal
db_name=yonaris_rehearsal
db_password="rehearsal_${run_id}"

docker run --detach \
  --name "$db_container" \
  --label "$resource_label=$run_id" \
  --network "$db_network" \
  --publish 127.0.0.1::5432 \
  --mount "type=volume,src=$db_volume,dst=/var/lib/postgresql/data" \
  --env "POSTGRES_USER=$db_user" \
  --env "POSTGRES_PASSWORD=$db_password" \
  --env "POSTGRES_DB=$db_name" \
  --env "POSTGRES_INITDB_ARGS=--data-checksums" \
  postgres:16-alpine >/dev/null
db_created=true

bash "$POSTGRES_READY_SCRIPT" "$db_container"

published_endpoint="$(docker port "$db_container" 5432/tcp | awk '/^127[.]0[.]0[.]1:/ { print; exit }')"
[[ "$published_endpoint" =~ ^127\.0\.0\.1:[0-9]+$ ]] || \
  fail "PostgreSQL was not published on a unique localhost port."
host_port="${published_endpoint##*:}"
echo "Isolated PostgreSQL ready on $published_endpoint (container $db_container)."

echo "Validating custom-format archive."
docker exec -i "$db_container" pg_restore --list <"$backup_file" >/dev/null

echo "Restoring backup into the isolated database."
docker exec -i "$db_container" pg_restore \
  --username "$db_user" \
  --dbname "$db_name" \
  --exit-on-error \
  --single-transaction \
  --no-owner \
  --no-acl \
  --verbose <"$backup_file"

psql_scalar() {
  local sql="$1"
  docker exec "$db_container" psql \
    --username "$db_user" \
    --dbname "$db_name" \
    --no-psqlrc \
    --tuples-only \
    --no-align \
    --set ON_ERROR_STOP=1 \
    --command "$sql" | tr -d '[:space:]'
}

public_relation_count="$(psql_scalar "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r', 'p');")"
[[ "$public_relation_count" =~ ^[1-9][0-9]*$ ]] || \
  fail "Restored backup contains no public tables."

migration_table="$(psql_scalar "select coalesce(to_regclass('drizzle.__drizzle_migrations')::text, '');")"
[[ "$migration_table" == "drizzle.__drizzle_migrations" ]] || \
  fail "Restored backup has no Drizzle migration history; refusing to infer an upgrade path."
pre_migration_count="$(psql_scalar 'select count(*) from drizzle.__drizzle_migrations;')"
pre_latest_when="$(psql_scalar 'select coalesce(max(created_at), 0) from drizzle.__drizzle_migrations;')"
[[ "$pre_migration_count" =~ ^[0-9]+$ && "$pre_latest_when" =~ ^[0-9]+$ ]] || \
  fail "Could not read restored migration history."
if (( pre_migration_count > expected_migration_count )); then
  fail "Backup has more migrations ($pre_migration_count) than this checkout ($expected_migration_count); refusing a downgrade rehearsal."
fi
if (( pre_latest_when > expected_latest_when )); then
  fail "Backup migration timestamp $pre_latest_when is newer than this checkout ($expected_latest_when); refusing a downgrade rehearsal."
fi
echo "Restore verified: $public_relation_count public tables, $pre_migration_count recorded migrations (latest $pre_latest_when)."

network_database_url="postgresql://$db_user:$db_password@$db_container:5432/$db_name"
host_database_url="postgresql://$db_user:$db_password@127.0.0.1:$host_port/$db_name"

echo "Running current migrations against the restored backup."
if [[ "$runner_mode" == image ]]; then
  migration_created=true
  docker run \
    --name "$migration_container" \
    --label "$resource_label=$run_id" \
    --network "$db_network" \
    --env "DATABASE_URL=$network_database_url" \
    "$migration_image"
else
  DATABASE_URL="$host_database_url" \
    pnpm -C "$REPOSITORY_ROOT/packages/lib" exec drizzle-kit migrate
fi

post_migration_count="$(psql_scalar 'select count(*) from drizzle.__drizzle_migrations;')"
post_latest_when="$(psql_scalar 'select coalesce(max(created_at), 0) from drizzle.__drizzle_migrations;')"
post_latest_hash="$(psql_scalar "select lower(hash) from drizzle.__drizzle_migrations where created_at = $expected_latest_when order by id desc limit 1;")"

[[ "$post_migration_count" == "$expected_migration_count" ]] || \
  fail "Migration history count mismatch: expected $expected_migration_count, got $post_migration_count."
[[ "$post_latest_when" == "$expected_latest_when" ]] || \
  fail "Latest migration timestamp mismatch: expected $expected_latest_when, got $post_latest_when."
[[ "$post_latest_hash" == "$expected_latest_hash" ]] || \
  fail "Latest migration hash mismatch for $expected_latest_tag."

docker exec "$db_container" psql \
  --username "$db_user" \
  --dbname "$db_name" \
  --no-psqlrc \
  --set ON_ERROR_STOP=1 \
  --command 'analyze;' >/dev/null

echo "PASS: restored backup upgraded to $expected_latest_tag with $post_migration_count verified migrations."
