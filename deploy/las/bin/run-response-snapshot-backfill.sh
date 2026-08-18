#!/usr/bin/env bash

set -Eeuo pipefail
set +x
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd -- "$SCRIPT_DIR/../../.." && pwd)"

if [[ "${1:-}" == "--validate-source-provenance" ]]; then
	if [[ $# -ne 3 ]]; then
		echo "Usage: $0 --validate-source-provenance <reviewed-backfill-request.json> <current-40-character-git-sha>" >&2
		exit 2
	fi
	request_file="$2"
	current_sha="$3"
	if [[ ! "$current_sha" =~ ^[0-9a-f]{40}$ ]]; then
		echo "Refusing invalid current source SHA." >&2
		exit 2
	fi
	request_dir="$SOURCE_ROOT/deploy/las/response-snapshot-backfills/requests"
	request_root="$(realpath -e -- "$request_dir")"
	resolved_request="$(realpath -e -- "$request_file")"
	if [[ -L "$request_file" || ! -f "$resolved_request" || "$(dirname -- "$resolved_request")" != "$request_root" ]]; then
		echo "Backfill request must be a direct checked-in file in the approved directory." >&2
		exit 1
	fi
	request_name="$(basename -- "$resolved_request")"
	if [[ ! "$request_name" =~ ^[a-z0-9][a-z0-9._-]{0,95}\.json$ ]]; then
		echo "Backfill request filename is invalid." >&2
		exit 1
	fi
	source_sha="$(python3 - "$resolved_request" <<'PY'
import json
import pathlib
import re
import sys

request = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
source_sha = request.get("sourceCommitSha")
if not isinstance(source_sha, str) or not re.fullmatch(r"[0-9a-f]{40}", source_sha):
    raise SystemExit("Backfill source SHA is invalid")
print(source_sha)
PY
)"
	if [[ "$(git -C "$SOURCE_ROOT" rev-parse HEAD)" != "$current_sha" ]]; then
		echo "Backfill release checkout does not match the current workflow SHA." >&2
		exit 1
	fi
	if ! git -C "$SOURCE_ROOT" merge-base --is-ancestor "$source_sha" "$current_sha"; then
		echo "Backfill source SHA is not an ancestor of the current release." >&2
		exit 1
	fi
	request_relative="deploy/las/response-snapshot-backfills/requests/$request_name"
	mapfile -t changed_entries < <(git -C "$SOURCE_ROOT" diff --name-status --no-renames "$source_sha" "$current_sha" --)
	if [[ ${#changed_entries[@]} -ne 1 || "${changed_entries[0]}" != $'A\t'"$request_relative" ]]; then
		echo "Backfill release range must add only the exact reviewed request file." >&2
		exit 1
	fi
	mapfile -t touched_paths < <(
		git -C "$SOURCE_ROOT" log --format= --name-only "$source_sha..$current_sha" -- |
			sed '/^$/d' |
			sort -u
	)
	if [[ ${#touched_paths[@]} -ne 1 || "${touched_paths[0]}" != "$request_relative" ]]; then
		echo "Backfill release history must touch only the exact reviewed request file." >&2
		exit 1
	fi
	if ! git -C "$SOURCE_ROOT" show "$current_sha:$request_relative" | cmp -s - "$resolved_request"; then
		echo "Backfill request does not match the immutable current release." >&2
		exit 1
	fi
	exit 0
fi

if [[ $# -ne 2 ]]; then
	echo "Usage: $0 sha-<40-character-git-sha> <reviewed-backfill-request.json>" >&2
	exit 2
fi
release_tag="$1"
request_file="$2"
if [[ ! "$release_tag" =~ ^sha-[0-9a-f]{40}$ ]]; then
	echo "Refusing invalid immutable release tag." >&2
	exit 2
fi

DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/yonaris}"
COMPOSE_FILE="${COMPOSE_FILE:-$SOURCE_ROOT/deploy/las/compose.yaml}"
ENV_FILE="${ENV_FILE:-$DEPLOY_ROOT/.env}"
RELEASE_FILE="$DEPLOY_ROOT/.release"
REQUEST_DIR="$SOURCE_ROOT/deploy/las/response-snapshot-backfills/requests"
RECEIPT_DIR="$DEPLOY_ROOT/operation-receipts/response-snapshot-backfills"

for required_file in "$COMPOSE_FILE" "$ENV_FILE" "$RELEASE_FILE" "$request_file"; do
	if [[ -L "$required_file" || ! -f "$required_file" || ! -r "$required_file" ]]; then
		echo "Missing or unsafe response snapshot backfill prerequisite." >&2
		exit 1
	fi
done
if [[ "$(tr -d '[:space:]' <"$RELEASE_FILE")" != "$release_tag" ]]; then
	echo "Refusing backfill before the requested immutable release is healthy." >&2
	exit 1
fi
request_root="$(realpath -e -- "$REQUEST_DIR")"
resolved_request="$(realpath -e -- "$request_file")"
if [[ "$(dirname -- "$resolved_request")" != "$request_root" ]]; then
	echo "Backfill request must be a direct checked-in file in the approved directory." >&2
	exit 1
fi
request_name="$(basename -- "$resolved_request")"
if [[ ! "$request_name" =~ ^[a-z0-9][a-z0-9._-]{0,95}\.json$ ]]; then
	echo "Backfill request filename is invalid." >&2
	exit 1
fi

read -r request_id source_sha expected_fingerprint < <(python3 - "$resolved_request" <<'PY'
import json
import pathlib
import re
import sys

request = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
common = {"schemaVersion", "operation", "requestId", "brandId", "fromObservedAt", "toObservedAtExclusive", "channelsExact", "runIds", "expectedRunCount", "expectedRunFingerprint", "sourceCommitSha"}
brand_id = request.get("brandId")
required = common if brand_id == "stepfun" else common | {"sourceFailureCode"} if brand_id == "ppio" else set()
if set(request) != required or request.get("schemaVersion") != 1 or request.get("operation") != "backfill-response-snapshots":
    raise SystemExit("Backfill request does not match the reviewed contract")
if brand_id == "ppio" and request.get("sourceFailureCode") != "snapshot_contract_invalid":
    raise SystemExit("PPIO backfill requires sourceFailureCode snapshot_contract_invalid")
request_id = request.get("requestId")
source_sha = request.get("sourceCommitSha")
fingerprint = request.get("expectedRunFingerprint")
if not isinstance(request_id, str) or not re.fullmatch(r"[a-z0-9][a-z0-9._-]{0,99}", request_id):
    raise SystemExit("Backfill requestId is invalid")
if not isinstance(source_sha, str) or not re.fullmatch(r"[0-9a-f]{40}", source_sha):
    raise SystemExit("Backfill source SHA is invalid")
if not isinstance(fingerprint, str) or not re.fullmatch(r"[0-9a-f]{64}", fingerprint):
    raise SystemExit("Backfill fingerprint is invalid")
print(request_id, source_sha, fingerprint)
PY
)

exec 8>"$DEPLOY_ROOT/.response-snapshot-backfill.lock"
if ! flock -n 8; then
	echo "Another response snapshot backfill is running." >&2
	exit 1
fi
install -d -m 0700 -- "$RECEIPT_DIR"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
compose=(docker compose --project-name yonaris --env-file "$ENV_FILE" --file "$COMPOSE_FILE")
container_request="/tmp/$(basename -- "$resolved_request")"

run_mode() {
	local mode="$1"
	local output_file
	output_file="$(mktemp)"
	trap 'rm -f -- "$output_file"' RETURN
	args=(--request-file "$container_request" --source-sha "$source_sha")
	if [[ "$mode" == apply ]]; then args+=(--apply); fi
	set +e
	IMAGE_TAG="$release_tag" "${compose[@]}" run --rm --no-deps -T --entrypoint node \
		-v "$resolved_request:$container_request:ro" worker \
		./node_modules/tsx/dist/cli.mjs ./src/backfill-response-snapshots.ts "${args[@]}" >"$output_file" 2>&1
	command_status=$?
	set -e
	python3 - "$mode" "$command_status" "$output_file" "$request_id" "$expected_fingerprint" <<'PY'
import json
import pathlib
import sys

mode, status, output_file, request_id, fingerprint = sys.argv[1:]
lines = pathlib.Path(output_file).read_text(encoding="utf-8").splitlines()
objects = [line for line in lines if line.startswith("{") and line.endswith("}")]
if not objects:
    raise SystemExit("Backfill returned unexpected output; raw output was withheld")
payload = json.loads(objects[-1])
if int(status) != 0 or payload.get("ok") is not True or payload.get("requestId") != request_id or payload.get("runFingerprint") != fingerprint:
    code = payload.get("code") if isinstance(payload.get("code"), str) else "operation_failed"
    raise SystemExit(f"Backfill {mode} failed: code={code}")
if mode == "dry-run" and payload.get("status") != "dry_run":
    raise SystemExit("Backfill dry-run returned an invalid lifecycle")
if mode == "apply" and payload.get("status") != "applied":
    raise SystemExit("Backfill apply returned an invalid lifecycle")
allowed = {"ok", "status", "requestId", "brandId", "total", "runFingerprint", "existing", "wouldCreate", "wouldRebuild", "currentStatuses", "created", "alreadyReady", "pending", "failed"}
print(json.dumps({key: payload[key] for key in sorted(payload) if key in allowed}, sort_keys=True, separators=(",", ":")))
PY
}

dry_run_receipt="$(run_mode dry-run)"
printf 'response snapshot backfill dry-run: %s\n' "$dry_run_receipt"
apply_receipt="$(run_mode apply)"
receipt_file="$RECEIPT_DIR/$request_id-$expected_fingerprint.json"
receipt_candidate="$receipt_file.tmp.$$"
printf '%s\n' "$apply_receipt" >"$receipt_candidate"
chmod 0600 "$receipt_candidate"
python3 - "$receipt_candidate" <<'PY'
import os
import pathlib
import sys
with pathlib.Path(sys.argv[1]).open("r+b") as handle:
    os.fsync(handle.fileno())
PY
mv -f -- "$receipt_candidate" "$receipt_file"
printf 'response snapshot backfill apply: %s\n' "$apply_receipt"
