#!/usr/bin/env bash

set -Eeuo pipefail
set +x
umask 077
export LC_ALL=C

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/yonaris}"
COMPOSE_FILE="${COMPOSE_FILE:-$(cd -- "$SCRIPT_DIR/.." && pwd)/compose.yaml}"
ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"
round_trip=false

if [[ "${1:-}" == "--round-trip" && $# -eq 1 ]]; then
	round_trip=true
elif [[ $# -ne 0 ]]; then
	echo "Usage: $0 [--round-trip]" >&2
	exit 2
fi
if [[ ! -f "$ENV_FILE" || ! -f "$COMPOSE_FILE" ]]; then
	echo "Response snapshot preflight requires the environment and Compose files." >&2
	exit 1
fi

requested_image_tag="${IMAGE_TAG:-}"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
if [[ -n "$requested_image_tag" ]]; then
	export IMAGE_TAG="$requested_image_tag"
fi

enabled="${RESPONSE_SNAPSHOT_ENABLED:-false}"
if [[ "$enabled" != true && "$enabled" != false ]]; then
	echo "RESPONSE_SNAPSHOT_ENABLED must be true or false." >&2
	exit 1
fi
if [[ "$enabled" == false ]]; then
	printf 'response_snapshot_storage.status=disabled\n'
	exit 0
fi

storage_root="${RESPONSE_SNAPSHOT_HOST_ROOT:-}"
container_root="${RESPONSE_SNAPSHOT_ROOT:-}"
if [[ "$storage_root" != /* || "$storage_root" == / || "$storage_root" == *$'\r'* || "$storage_root" == *$'\n'* ]]; then
	echo "RESPONSE_SNAPSHOT_HOST_ROOT must be a safe non-root absolute path." >&2
	exit 1
fi
case "$storage_root/" in
	/opt/yonaris/releases/*)
		echo "Response snapshot storage cannot be placed under immutable releases." >&2
		exit 1
		;;
esac
if [[ "$container_root" != /var/lib/yonaris/response-snapshots/v1 ]]; then
	echo "RESPONSE_SNAPSHOT_ROOT must use the fixed v1 container path." >&2
	exit 1
fi
for fixed in \
	"RESPONSE_SNAPSHOT_RETENTION_DAYS:90" \
	"RESPONSE_SNAPSHOT_WARN_USED_PERCENT:70" \
	"RESPONSE_SNAPSHOT_STOP_USED_PERCENT:80" \
	"RESPONSE_SNAPSHOT_OUTBOX_TTL_HOURS:24"; do
	name="${fixed%%:*}"
	expected="${fixed#*:}"
	if [[ "${!name:-}" != "$expected" ]]; then
		echo "$name must be fixed at $expected in response snapshot v1." >&2
		exit 1
	fi
done

cursor="$storage_root"
while [[ "$cursor" != / ]]; do
	if [[ -L "$cursor" ]]; then
		echo "Response snapshot storage cannot contain symlink path components." >&2
		exit 1
	fi
	cursor="$(dirname -- "$cursor")"
done
if [[ ! -d "$storage_root" || -L "$storage_root" ]]; then
	echo "Response snapshot storage root is missing or unsafe." >&2
	exit 1
fi
if [[ "$(stat -c %u:%g -- "$storage_root")" != 1001:1001 || "$(stat -c %a -- "$storage_root")" != 750 ]]; then
	echo "Response snapshot storage must be owned by 1001:1001 with mode 0750." >&2
	exit 1
fi

used_percent="$(df -Pk -- "$storage_root" | awk 'NR == 2 { value=$5; sub(/%$/, "", value); print value }')"
if [[ ! "$used_percent" =~ ^(0|[1-9][0-9]?)$ ]] || ((used_percent > 100)); then
	echo "Response snapshot filesystem capacity could not be verified." >&2
	exit 1
fi
if ((used_percent >= 80)); then
	echo "Response snapshot filesystem has reached the fixed 80% stop threshold." >&2
	exit 2
fi

printf 'response_snapshot_storage.used_percent=%s\n' "$used_percent"
if ((used_percent >= 70)); then
	printf 'response_snapshot_storage.capacity=warning\n'
else
	printf 'response_snapshot_storage.capacity=normal\n'
fi

if [[ "$round_trip" == true ]]; then
	compose=(docker compose --project-name yonaris --env-file "$ENV_FILE" --file "$COMPOSE_FILE")
	probe_name=".round-trip-$RANDOM-$$"
	probe_value="snapshot-probe-$RANDOM-$RANDOM"
	cleanup_probe() {
		"${compose[@]}" run --rm --no-deps -T --entrypoint sh \
			-e "SNAPSHOT_PROBE_NAME=$probe_name" worker -ceu \
			'case "$SNAPSHOT_PROBE_NAME" in .round-trip-[0-9]*-[0-9]*) ;; *) exit 2;; esac; rm -f -- "$RESPONSE_SNAPSHOT_ROOT/$SNAPSHOT_PROBE_NAME"' \
			>/dev/null 2>&1 || true
	}
	trap cleanup_probe EXIT
	"${compose[@]}" run --rm --no-deps -T --entrypoint sh \
		-e "SNAPSHOT_PROBE_NAME=$probe_name" -e "SNAPSHOT_PROBE_VALUE=$probe_value" web -ceu \
		'case "$SNAPSHOT_PROBE_NAME" in .round-trip-[0-9]*-[0-9]*) ;; *) exit 2;; esac; test ! -e "$RESPONSE_SNAPSHOT_ROOT/$SNAPSHOT_PROBE_NAME"; umask 077; printf "%s" "$SNAPSHOT_PROBE_VALUE" >"$RESPONSE_SNAPSHOT_ROOT/$SNAPSHOT_PROBE_NAME"'
	"${compose[@]}" run --rm --no-deps -T --entrypoint sh \
		-e "SNAPSHOT_PROBE_NAME=$probe_name" -e "SNAPSHOT_PROBE_VALUE=$probe_value" worker -ceu \
		'case "$SNAPSHOT_PROBE_NAME" in .round-trip-[0-9]*-[0-9]*) ;; *) exit 2;; esac; test "$(cat -- "$RESPONSE_SNAPSHOT_ROOT/$SNAPSHOT_PROBE_NAME")" = "$SNAPSHOT_PROBE_VALUE"; rm -- "$RESPONSE_SNAPSHOT_ROOT/$SNAPSHOT_PROBE_NAME"'
	trap - EXIT
	printf 'response_snapshot_storage.round_trip=verified\n'
fi

printf 'response_snapshot_storage.status=OK\n'
