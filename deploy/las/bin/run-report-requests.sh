#!/usr/bin/env bash

set -Eeuo pipefail
# Report operations handle production credentials through Compose. Never allow
# an inherited xtrace setting to echo them.
set +x
umask 077

if [[ $# -ne 1 ]]; then
	echo "Usage: $0 sha-<40-character-git-sha>" >&2
	exit 2
fi

release_tag="$1"
if [[ ! "$release_tag" =~ ^sha-[0-9a-f]{40}$ ]]; then
	echo "Refusing invalid immutable release tag." >&2
	exit 2
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd -- "$SCRIPT_DIR/../../.." && pwd)"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/yonaris}"
COMPOSE_FILE="${COMPOSE_FILE:-$SOURCE_ROOT/deploy/las/compose.yaml}"
ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"
RELEASE_FILE="$DEPLOY_ROOT/.release"
REQUEST_DIR="$SOURCE_ROOT/apps/worker/src/report-requests"
RECEIPT_DIR="$DEPLOY_ROOT/report-ops"

if [[ ! -f "$COMPOSE_FILE" || ! -r "$COMPOSE_FILE" ]]; then
	echo "Missing readable Compose file." >&2
	exit 1
fi
if [[ ! -f "$ENV_FILE" || ! -r "$ENV_FILE" ]]; then
	echo "Missing readable production environment file." >&2
	exit 1
fi
if [[ ! -f "$RELEASE_FILE" ]] || [[ "$(tr -d '[:space:]' <"$RELEASE_FILE")" != "$release_tag" ]]; then
	echo "Refusing report operations before the requested immutable release is healthy." >&2
	exit 1
fi

mkdir -p -- "$RECEIPT_DIR"
chmod 700 -- "$RECEIPT_DIR"
exec 8>"$DEPLOY_ROOT/.report-ops.lock"
if ! flock -n 8; then
	echo "Another Yonaris report operation is already running." >&2
	exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

compose=(docker compose --project-name yonaris --env-file "$ENV_FILE" --file "$COMPOSE_FILE")

shopt -s nullglob
request_files=("$REQUEST_DIR"/*.json)
shopt -u nullglob

if [[ ${#request_files[@]} -eq 0 ]]; then
	echo "No approved database report requests in this release."
	exit 0
fi
if [[ ${#request_files[@]} -ne 1 ]]; then
	echo "Exactly one approved report request is allowed per immutable release." >&2
	exit 1
fi

for request_file in "${request_files[@]}"; do
	request_name="$(basename -- "$request_file")"
	if [[ ! "$request_name" =~ ^[a-z0-9][a-z0-9._-]{0,95}\.json$ ]]; then
		echo "Refusing invalid report request filename." >&2
		exit 1
	fi
	if [[ -L "$request_file" || ! -f "$request_file" || ! -r "$request_file" ]]; then
		echo "Report request is not a readable regular file." >&2
		exit 1
	fi

	request_hash="$(sha256sum -- "$request_file" | awk '{print $1}')"
	if [[ ! "$request_hash" =~ ^[0-9a-f]{64}$ ]]; then
		echo "Could not calculate a valid report request digest." >&2
		exit 1
	fi

	receipt_file="$RECEIPT_DIR/${request_name%.json}.started"
	first_execution=false
	if (
		set -o noclobber
		printf '%s\n' "$request_hash" >"$receipt_file"
	) 2>/dev/null; then
		first_execution=true
		chmod 600 -- "$receipt_file"
	else
		stored_hash="$(tr -d '[:space:]' <"$receipt_file")"
		if [[ "$stored_hash" != "$request_hash" ]]; then
			echo "A report request receipt exists with different content; refusing replay." >&2
			exit 1
		fi
	fi

	container_request="./src/report-requests/$request_name"
	if [[ "$first_execution" == true ]]; then
		echo "Executing approved report request: $request_name"
		IMAGE_TAG="$release_tag" "${compose[@]}" --profile operations run --rm --no-deps -T \
			account-ops node ./node_modules/tsx/dist/cli.mjs \
			./src/run-database-report.ts --request-file "$container_request" --apply
	else
		echo "Report request already has a durable receipt; checking status only: $request_name"
		IMAGE_TAG="$release_tag" "${compose[@]}" --profile operations run --rm --no-deps -T \
			account-ops node ./node_modules/tsx/dist/cli.mjs \
			./src/run-database-report.ts --request-file "$container_request" --status-only
	fi
done
