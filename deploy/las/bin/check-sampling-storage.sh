#!/usr/bin/env bash

set -Eeuo pipefail
# Never let an inherited xtrace setting expose values sourced from the env file.
set +x

export LC_ALL=C

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/yonaris}"
COMPOSE_FILE="${COMPOSE_FILE:-$(cd -- "$SCRIPT_DIR/.." && pwd)/compose.yaml}"
ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"
BACKUP_DIR="${BACKUP_DIR:-$DEPLOY_ROOT/backups}"

usage() {
	cat <<'EOF'
Usage: check-sampling-storage.sh [--allow-missing-evidence-schema] [--help]

Run a read-only storage preflight for Sampling evidence on the LAS host. The
script uses the same DEPLOY_ROOT, ENV_FILE, COMPOSE_FILE, BACKUP_DIR, and
Docker Compose project contract as the backup/deploy scripts. PostgreSQL must
already be running; this script never starts a service.

The report includes:
  - total PostgreSQL database and evidence table storage
  - staged, attached, and total evidence logical bytes/counts
  - evidence created during the last 7 and 30 days
  - backup directory size
  - host deployment filesystem and PostgreSQL-volume free percentages
  - database-plus-backups bytes on local storage

Threshold environment variables (unsigned decimal integers):
  SAMPLING_STORAGE_MIN_FREE_PERCENT             default: 20
  SAMPLING_STORAGE_MIN_POSTGRES_FREE_PERCENT    default: MIN_FREE_PERCENT
  SAMPLING_STORAGE_MAX_DATABASE_BYTES           default: 0 (disabled)
  SAMPLING_STORAGE_MAX_EVIDENCE_BYTES           default: 0 (disabled)
  SAMPLING_STORAGE_MAX_STAGED_BYTES             default: 0 (disabled)
  SAMPLING_STORAGE_MAX_BACKUP_BYTES             default: 0 (disabled)
  SAMPLING_STORAGE_MAX_LOCAL_BYTES              default: 0 (disabled)
  SAMPLING_STORAGE_MAX_7D_GROWTH_BYTES          default: 0 (disabled)
  SAMPLING_STORAGE_MAX_30D_GROWTH_BYTES         default: 0 (disabled)

Options:
  --allow-missing-evidence-schema  Permit migration 0018 to be absent while
                                   still enforcing every available storage and
                                   filesystem threshold. Intended only for the
                                   pre-migration deployment check.
  --help                           Show this help.

A breached threshold exits 2. Configuration, Docker, SQL, du, or df failures
exit 1. No threshold breach exits 0. The script performs only SELECT queries
and read-only du/df inspection; it never deletes files, starts containers,
VACUUMs, or changes database data. Credentials are never printed.
EOF
}

allow_missing_evidence_schema=false
while [[ $# -gt 0 ]]; do
	case "$1" in
		--allow-missing-evidence-schema)
			allow_missing_evidence_schema=true
			shift
			;;
		-h | --help)
			usage
			exit 0
			;;
		*)
			echo "Unknown argument: $1" >&2
			usage >&2
			exit 1
			;;
	esac
done

for required_file in "$COMPOSE_FILE" "$ENV_FILE"; do
	if [[ ! -f "$required_file" ]]; then
		echo "Missing required file: $required_file" >&2
		exit 1
	fi
done

if [[ ! -d "$DEPLOY_ROOT" ]]; then
	echo "Missing deployment root: $DEPLOY_ROOT" >&2
	exit 1
fi

for required_command in docker du df awk; do
	if ! command -v "$required_command" >/dev/null 2>&1; then
		echo "Missing required command: $required_command" >&2
		exit 1
	fi
done

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${POSTGRES_USER:-}" || -z "${POSTGRES_DB:-}" ]]; then
	echo "POSTGRES_USER and POSTGRES_DB must be set in the environment file" >&2
	exit 1
fi

min_free_percent="${SAMPLING_STORAGE_MIN_FREE_PERCENT:-20}"
min_postgres_free_percent="${SAMPLING_STORAGE_MIN_POSTGRES_FREE_PERCENT:-$min_free_percent}"
max_database_bytes="${SAMPLING_STORAGE_MAX_DATABASE_BYTES:-0}"
max_evidence_bytes="${SAMPLING_STORAGE_MAX_EVIDENCE_BYTES:-0}"
max_staged_bytes="${SAMPLING_STORAGE_MAX_STAGED_BYTES:-0}"
max_backup_bytes="${SAMPLING_STORAGE_MAX_BACKUP_BYTES:-0}"
max_local_bytes="${SAMPLING_STORAGE_MAX_LOCAL_BYTES:-0}"
max_7d_growth_bytes="${SAMPLING_STORAGE_MAX_7D_GROWTH_BYTES:-0}"
max_30d_growth_bytes="${SAMPLING_STORAGE_MAX_30D_GROWTH_BYTES:-0}"

validate_uint() {
	local name="$1"
	local value="$2"
	if [[ ! "$value" =~ ^(0|[1-9][0-9]{0,17})$ ]]; then
		echo "$name must be an unsigned decimal integer with at most 18 digits" >&2
		exit 1
	fi
}

validate_percent() {
	local name="$1"
	local value="$2"
	validate_uint "$name" "$value"
	if ((value > 100)); then
		echo "$name must be between 0 and 100" >&2
		exit 1
	fi
}

validate_percent SAMPLING_STORAGE_MIN_FREE_PERCENT "$min_free_percent"
validate_percent SAMPLING_STORAGE_MIN_POSTGRES_FREE_PERCENT "$min_postgres_free_percent"
validate_uint SAMPLING_STORAGE_MAX_DATABASE_BYTES "$max_database_bytes"
validate_uint SAMPLING_STORAGE_MAX_EVIDENCE_BYTES "$max_evidence_bytes"
validate_uint SAMPLING_STORAGE_MAX_STAGED_BYTES "$max_staged_bytes"
validate_uint SAMPLING_STORAGE_MAX_BACKUP_BYTES "$max_backup_bytes"
validate_uint SAMPLING_STORAGE_MAX_LOCAL_BYTES "$max_local_bytes"
validate_uint SAMPLING_STORAGE_MAX_7D_GROWTH_BYTES "$max_7d_growth_bytes"
validate_uint SAMPLING_STORAGE_MAX_30D_GROWTH_BYTES "$max_30d_growth_bytes"

cd -- "$(dirname -- "$COMPOSE_FILE")"
compose=(docker compose --project-name yonaris --env-file "$ENV_FILE" --file "$COMPOSE_FILE")

schema_metrics_sql=$(cat <<'SQL'
SELECT
  pg_database_size(current_database())::bigint,
  coalesce(pg_total_relation_size(to_regclass('public.evidence_artifacts')), 0)::bigint,
  CASE
    WHEN to_regclass('public.evidence_artifacts') IS NULL THEN 'no-evidence-schema'
    ELSE 'ready'
  END;
SQL
)

schema_metrics="$("${compose[@]}" exec -T \
	-e 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=15000' \
	postgres psql \
	--no-psqlrc \
	--quiet \
	--tuples-only \
	--no-align \
	--field-separator $'\t' \
	--set ON_ERROR_STOP=1 \
	--username "$POSTGRES_USER" \
	--dbname "$POSTGRES_DB" \
	--command "$schema_metrics_sql")"

IFS=$'\t' read -r database_bytes evidence_relation_bytes evidence_schema <<<"$schema_metrics"
validate_uint database.total.bytes "$database_bytes"
validate_uint evidence.relation.bytes "$evidence_relation_bytes"

if [[ "$evidence_schema" == "ready" ]]; then
	evidence_metrics_sql=$(cat <<'SQL'
SELECT
  count(*) FILTER (WHERE status = 'staged'),
  coalesce(sum(byte_size) FILTER (WHERE status = 'staged'), 0)::bigint,
  count(*) FILTER (WHERE status = 'attached'),
  coalesce(sum(byte_size) FILTER (WHERE status = 'attached'), 0)::bigint,
  count(*),
  coalesce(sum(byte_size), 0)::bigint,
  count(*) FILTER (WHERE created_at >= now() - interval '7 days'),
  coalesce(sum(byte_size) FILTER (WHERE created_at >= now() - interval '7 days'), 0)::bigint,
  count(*) FILTER (WHERE created_at >= now() - interval '30 days'),
  coalesce(sum(byte_size) FILTER (WHERE created_at >= now() - interval '30 days'), 0)::bigint
FROM public.evidence_artifacts;
SQL
)
	evidence_metrics="$("${compose[@]}" exec -T \
		-e 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=15000' \
		postgres psql \
		--no-psqlrc \
		--quiet \
		--tuples-only \
		--no-align \
		--field-separator $'\t' \
		--set ON_ERROR_STOP=1 \
		--username "$POSTGRES_USER" \
		--dbname "$POSTGRES_DB" \
		--command "$evidence_metrics_sql")"

	IFS=$'\t' read -r \
		staged_count \
		staged_bytes \
		attached_count \
		attached_bytes \
		evidence_count \
		evidence_bytes \
		growth_7d_count \
		growth_7d_bytes \
		growth_30d_count \
		growth_30d_bytes <<<"$evidence_metrics"

	for metric_pair in \
		"evidence.staged.count:$staged_count" \
		"evidence.staged.bytes:$staged_bytes" \
		"evidence.attached.count:$attached_count" \
		"evidence.attached.bytes:$attached_bytes" \
		"evidence.total.count:$evidence_count" \
		"evidence.total.bytes:$evidence_bytes" \
		"evidence.created_7d.count:$growth_7d_count" \
		"evidence.created_7d.bytes:$growth_7d_bytes" \
		"evidence.created_30d.count:$growth_30d_count" \
		"evidence.created_30d.bytes:$growth_30d_bytes"; do
		validate_uint "${metric_pair%%:*}" "${metric_pair#*:}"
	done
elif [[ "$evidence_schema" == "no-evidence-schema" ]]; then
	staged_count=not_available
	staged_bytes=not_available
	attached_count=not_available
	attached_bytes=not_available
	evidence_count=not_available
	evidence_bytes=not_available
	growth_7d_count=not_available
	growth_7d_bytes=not_available
	growth_30d_count=not_available
	growth_30d_bytes=not_available
else
	echo "Unexpected evidence schema probe result" >&2
	exit 1
fi

if [[ -d "$BACKUP_DIR" ]]; then
	backup_kib="$(du -sk -- "$BACKUP_DIR" | awk '{print $1}')"
else
	backup_kib=0
fi
validate_uint backup.kib "$backup_kib"
backup_bytes=$((backup_kib * 1024))

read -r filesystem_total_kib filesystem_available_kib filesystem_used_percent <<<"$(
	df -Pk -- "$DEPLOY_ROOT" | awk 'NR == 2 { used = $5; sub(/%$/, "", used); print $2, $4, used }'
)"
validate_uint filesystem.total.kib "$filesystem_total_kib"
validate_uint filesystem.available.kib "$filesystem_available_kib"
validate_percent filesystem.used.percent "$filesystem_used_percent"
filesystem_free_percent=$((100 - filesystem_used_percent))
filesystem_total_bytes=$((filesystem_total_kib * 1024))
filesystem_available_bytes=$((filesystem_available_kib * 1024))

read -r postgres_filesystem_total_kib postgres_filesystem_available_kib postgres_filesystem_used_percent <<<"$(
	"${compose[@]}" exec -T postgres df -Pk /var/lib/postgresql/data |
		awk 'NR == 2 { used = $5; sub(/%$/, "", used); print $2, $4, used }'
)"
validate_uint postgres.filesystem.total.kib "$postgres_filesystem_total_kib"
validate_uint postgres.filesystem.available.kib "$postgres_filesystem_available_kib"
validate_percent postgres.filesystem.used.percent "$postgres_filesystem_used_percent"
postgres_filesystem_free_percent=$((100 - postgres_filesystem_used_percent))
postgres_filesystem_total_bytes=$((postgres_filesystem_total_kib * 1024))
postgres_filesystem_available_bytes=$((postgres_filesystem_available_kib * 1024))

local_database_and_backups_bytes=$((database_bytes + backup_bytes))

printf '%s\n' \
	"database.total.bytes=$database_bytes" \
	"evidence.schema=$evidence_schema" \
	"evidence.relation.bytes=$evidence_relation_bytes" \
	"evidence.staged.count=$staged_count" \
	"evidence.staged.bytes=$staged_bytes" \
	"evidence.attached.count=$attached_count" \
	"evidence.attached.bytes=$attached_bytes" \
	"evidence.total.count=$evidence_count" \
	"evidence.total.bytes=$evidence_bytes" \
	"evidence.created_7d.count=$growth_7d_count" \
	"evidence.created_7d.bytes=$growth_7d_bytes" \
	"evidence.created_30d.count=$growth_30d_count" \
	"evidence.created_30d.bytes=$growth_30d_bytes" \
	"backups.total.bytes=$backup_bytes" \
	"local.database_plus_backups.bytes=$local_database_and_backups_bytes" \
	"filesystem.total.bytes=$filesystem_total_bytes" \
	"filesystem.available.bytes=$filesystem_available_bytes" \
	"filesystem.free.percent=$filesystem_free_percent" \
	"postgres.filesystem.total.bytes=$postgres_filesystem_total_bytes" \
	"postgres.filesystem.available.bytes=$postgres_filesystem_available_bytes" \
	"postgres.filesystem.free.percent=$postgres_filesystem_free_percent"

warnings=()

if [[ "$evidence_schema" == "no-evidence-schema" ]] && \
	[[ "$allow_missing_evidence_schema" != true ]]; then
	warnings+=("evidence.schema is no-evidence-schema; migration 0018 is not applied")
elif [[ "$evidence_schema" == "no-evidence-schema" ]]; then
	printf '%s\n' \
		'NOTICE: evidence.schema is no-evidence-schema; explicitly allowed for this pre-migration check.' >&2
fi

warn_over() {
	local label="$1"
	local actual="$2"
	local maximum="$3"
	if ((maximum > 0 && actual > maximum)); then
		warnings+=("$label is $actual; configured maximum is $maximum")
	fi
}

warn_below() {
	local label="$1"
	local actual="$2"
	local minimum="$3"
	if ((actual < minimum)); then
		warnings+=("$label is $actual%; configured minimum is $minimum%")
	fi
}

warn_below filesystem.free.percent "$filesystem_free_percent" "$min_free_percent"
warn_below postgres.filesystem.free.percent "$postgres_filesystem_free_percent" "$min_postgres_free_percent"
warn_over database.total.bytes "$database_bytes" "$max_database_bytes"
warn_over backups.total.bytes "$backup_bytes" "$max_backup_bytes"
warn_over local.database_plus_backups.bytes "$local_database_and_backups_bytes" "$max_local_bytes"

if [[ "$evidence_schema" == "ready" ]]; then
	warn_over evidence.total.bytes "$evidence_bytes" "$max_evidence_bytes"
	warn_over evidence.staged.bytes "$staged_bytes" "$max_staged_bytes"
	warn_over evidence.created_7d.bytes "$growth_7d_bytes" "$max_7d_growth_bytes"
	warn_over evidence.created_30d.bytes "$growth_30d_bytes" "$max_30d_growth_bytes"
fi

if ((${#warnings[@]} > 0)); then
	printf 'status=ALERT\n'
	printf 'ALERT: %s\n' "${warnings[@]}" >&2
	exit 2
fi

printf 'status=OK\n'
