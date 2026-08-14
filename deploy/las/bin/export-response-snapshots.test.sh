#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_UNDER_TEST="$SCRIPT_DIR/export-response-snapshots.sh"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

SNAPSHOT_ROOT="$TEST_ROOT/live"
EXTERNAL_ROOT="$TEST_ROOT/external"
MOCK_BIN="$TEST_ROOT/bin"
mkdir -p "$SNAPSHOT_ROOT" "$EXTERNAL_ROOT" "$MOCK_BIN"

if python3 --version >/dev/null 2>&1; then
	TEST_PYTHON_BIN="$(command -v python3)"
elif [[ -x /c/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe ]]; then
	TEST_PYTHON_BIN=/c/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe
else
	echo "Python 3 is required for the export test." >&2
	exit 1
fi
cat >"$MOCK_BIN/python3" <<'EOF'
#!/usr/bin/env bash
exec "$TEST_PYTHON_BIN" "$@"
EOF
chmod +x "$MOCK_BIN/python3"
export PATH="$MOCK_BIN:$PATH" TEST_PYTHON_BIN

python3 - "$SNAPSHOT_ROOT" <<'PY'
import gzip
import hashlib
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1]) / "stepfun" / "2026" / "08" / "run-1" / "r1"
root.mkdir(parents=True)
html = b"<!doctype html><html><body>Archived answer</body></html>"
payload = {
    "schemaVersion": "response-snapshot.v1",
    "runId": "run-1",
    "brandId": "stepfun",
    "observedAt": "2026-08-15T01:00:00.000Z",
}
json_bytes = (json.dumps(payload, separators=(",", ":")) + "\n").encode()
html_gzip = gzip.compress(html, mtime=0)
json_gzip = gzip.compress(json_bytes, mtime=0)
(root / "snapshot.html.gz").write_bytes(html_gzip)
(root / "snapshot.json.gz").write_bytes(json_gzip)
manifest = {
    "schemaVersion": "response-snapshot-manifest.v1",
    "runId": "run-1",
    "artifacts": {
        "html": {"fileName": "snapshot.html.gz", "sha256": hashlib.sha256(html).hexdigest(), "bytes": len(html), "gzipBytes": len(html_gzip)},
        "json": {"fileName": "snapshot.json.gz", "sha256": hashlib.sha256(json_bytes).hexdigest(), "bytes": len(json_bytes), "gzipBytes": len(json_gzip)},
    },
}
(root / "manifest.json").write_text(json.dumps(manifest, separators=(",", ":")) + "\n", encoding="utf-8")
PY

cat >"$MOCK_BIN/stat" <<'EOF'
#!/usr/bin/env bash
if [[ "$2" == "%d" ]]; then
	case "${*: -1}" in
		"$MOCK_SNAPSHOT_ROOT") printf '101\n' ;;
		"$MOCK_EXTERNAL_ROOT") printf '%s\n' "${MOCK_EXTERNAL_DEVICE:-202}" ;;
		*) exec /usr/bin/stat "$@" ;;
	esac
else
	exec /usr/bin/stat "$@"
fi
EOF
chmod +x "$MOCK_BIN/stat"

destination="$EXTERNAL_ROOT/stepfun-2026-08"
receipt="$(env PATH="$MOCK_BIN:$PATH" MOCK_SNAPSHOT_ROOT="$SNAPSHOT_ROOT" MOCK_EXTERNAL_ROOT="$EXTERNAL_ROOT" \
	RESPONSE_SNAPSHOT_HOST_ROOT="$SNAPSHOT_ROOT" bash "$SCRIPT_UNDER_TEST" \
	--brand stepfun --from 2026-08-15 --to 2026-08-15 --destination "$destination")"
grep -Fq '"snapshotCount":1' <<<"$receipt"
test -f "$destination/export-receipt.json"
test -f "$destination/stepfun/2026/08/run-1/r1/snapshot.html.gz"

set +e
env PATH="$MOCK_BIN:$PATH" MOCK_SNAPSHOT_ROOT="$SNAPSHOT_ROOT" MOCK_EXTERNAL_ROOT="$EXTERNAL_ROOT" \
	MOCK_EXTERNAL_DEVICE=101 RESPONSE_SNAPSHOT_HOST_ROOT="$SNAPSHOT_ROOT" bash "$SCRIPT_UNDER_TEST" \
	--brand stepfun --from 2026-08-15 --to 2026-08-15 --destination "$EXTERNAL_ROOT/same-disk" \
	>"$TEST_ROOT/same.out" 2>"$TEST_ROOT/same.err"
same_status=$?
set -e
if [[ "$same_status" -eq 0 ]]; then
	echo "Same-filesystem export was accepted." >&2
	exit 1
fi
grep -Fq 'same-disk copy is not disaster recovery' "$TEST_ROOT/same.err"

python3 - "$SNAPSHOT_ROOT/stepfun/2026/08/run-1/r1/snapshot.html.gz" <<'PY'
import pathlib
import sys
path = pathlib.Path(sys.argv[1])
path.write_bytes(path.read_bytes() + b"tampered")
PY
set +e
env PATH="$MOCK_BIN:$PATH" MOCK_SNAPSHOT_ROOT="$SNAPSHOT_ROOT" MOCK_EXTERNAL_ROOT="$EXTERNAL_ROOT" \
	RESPONSE_SNAPSHOT_HOST_ROOT="$SNAPSHOT_ROOT" bash "$SCRIPT_UNDER_TEST" \
	--brand stepfun --from 2026-08-15 --to 2026-08-15 --destination "$EXTERNAL_ROOT/tampered" \
	>"$TEST_ROOT/tampered.out" 2>"$TEST_ROOT/tampered.err"
tampered_status=$?
set -e
if [[ "$tampered_status" -eq 0 ]]; then
	echo "Tampered export was accepted." >&2
	exit 1
fi

echo "export response snapshot tests passed"
