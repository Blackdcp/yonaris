#!/usr/bin/env bash

set -Eeuo pipefail
set +x
umask 077
export LC_ALL=C

usage() {
	cat <<'EOF'
Usage: export-response-snapshots.sh --brand BRAND --from YYYY-MM-DD --to YYYY-MM-DD --destination ABSOLUTE_PATH

Copy a verified UTC date range to a new directory on a different filesystem.
This is an operator export path, not the customer ZIP download endpoint.
EOF
}

brand=""
from_date=""
to_date=""
destination=""
while [[ $# -gt 0 ]]; do
	case "$1" in
		--brand) brand="${2:-}"; shift 2 ;;
		--from) from_date="${2:-}"; shift 2 ;;
		--to) to_date="${2:-}"; shift 2 ;;
		--destination) destination="${2:-}"; shift 2 ;;
		-h | --help) usage; exit 0 ;;
		*) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
	esac
done

storage_root="${RESPONSE_SNAPSHOT_HOST_ROOT:-/var/lib/yonaris/response-snapshots/v1}"
if [[ ! "$brand" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ || ${#brand} -gt 300 ]]; then
	echo "Brand is invalid." >&2
	exit 2
fi
for date_value in "$from_date" "$to_date"; do
	if [[ ! "$date_value" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
		echo "Export dates must use YYYY-MM-DD." >&2
		exit 2
	fi
done
if [[ "$storage_root" != /* || "$storage_root" == / || ! -d "$storage_root" || -L "$storage_root" ]]; then
	echo "Live response snapshot root is missing or unsafe." >&2
	exit 1
fi
if [[ "$destination" != /* || "$destination" == / || "$destination" == *$'\r'* || "$destination" == *$'\n'* ]]; then
	echo "Destination must be a non-root absolute path." >&2
	exit 2
fi
if [[ -e "$destination" ]]; then
	echo "Destination must not already exist." >&2
	exit 1
fi
destination_parent="$(dirname -- "$destination")"
if [[ ! -d "$destination_parent" || -L "$destination_parent" ]]; then
	echo "Destination parent must be an existing real directory." >&2
	exit 1
fi
resolved_root="$(readlink -f -- "$storage_root")"
resolved_destination="$(readlink -m -- "$destination")"
case "$resolved_destination/" in
	"$resolved_root"/*)
		echo "Destination cannot be inside the live response snapshot root." >&2
		exit 1
		;;
esac
if [[ "$(stat -c %d -- "$storage_root")" == "$(stat -c %d -- "$destination_parent")" ]]; then
	echo "Destination must be on a different filesystem; a same-disk copy is not disaster recovery." >&2
	exit 1
fi

python3 - "$storage_root" "$brand" "$from_date" "$to_date" "$destination" <<'PY'
import datetime as dt
import gzip
import hashlib
import json
import os
import pathlib
import re
import shutil
import sys

root = pathlib.Path(sys.argv[1])
brand = sys.argv[2]
start = dt.datetime.fromisoformat(sys.argv[3] + "T00:00:00+00:00")
end = dt.datetime.fromisoformat(sys.argv[4] + "T00:00:00+00:00") + dt.timedelta(days=1)
destination = pathlib.Path(sys.argv[5])
if start >= end:
    raise SystemExit("Invalid export date range")

safe = [re.compile(r"^\d{4}$"), re.compile(r"^(0[1-9]|1[0-2])$"), re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$"), re.compile(r"^r[1-9]\d{0,4}$")]
files = ("snapshot.html.gz", "snapshot.json.gz", "manifest.json")
max_compressed = 10 * 1024 * 1024
max_uncompressed = 16 * 1024 * 1024
inventory = []

def regular(path):
    value = path.lstat()
    if not value or not path.is_file() or path.is_symlink():
        raise RuntimeError("Archive contains an unsafe artifact")
    return value

def children(path, pattern):
    if not path.exists():
        return []
    result = []
    for child in sorted(path.iterdir(), key=lambda item: item.name):
        if child.is_symlink() or not child.is_dir() or not pattern.fullmatch(child.name):
            raise RuntimeError("Archive contains an unsafe directory entry")
        result.append(child)
    return result

def read_gzip(path):
    stat = regular(path)
    if stat.st_size <= 0 or stat.st_size > max_compressed:
        raise RuntimeError("Archive contains an oversized compressed artifact")
    with gzip.open(path, "rb") as handle:
        value = handle.read(max_uncompressed + 1)
    if len(value) > max_uncompressed:
        raise RuntimeError("Archive contains an oversized uncompressed artifact")
    return value

brand_root = root / brand
for year in children(brand_root, safe[0]):
    for month in children(year, safe[1]):
        for run in children(month, safe[2]):
            for revision in children(run, safe[3]):
                manifest_path = revision / files[2]
                json_path = revision / files[1]
                html_path = revision / files[0]
                for path in (manifest_path, json_path, html_path):
                    regular(path)
                manifest_bytes = manifest_path.read_bytes()
                manifest = json.loads(manifest_bytes)
                snapshot_json_bytes = read_gzip(json_path)
                html_bytes = read_gzip(html_path)
                snapshot = json.loads(snapshot_json_bytes)
                if manifest.get("schemaVersion") != "response-snapshot-manifest.v1" or manifest.get("runId") != run.name:
                    raise RuntimeError("Archive manifest identity is invalid")
                if snapshot.get("schemaVersion") != "response-snapshot.v1" or snapshot.get("runId") != run.name or snapshot.get("brandId") != brand:
                    raise RuntimeError("Archive JSON identity is invalid")
                observed = dt.datetime.fromisoformat(str(snapshot.get("observedAt", "")).replace("Z", "+00:00"))
                if observed.tzinfo is None:
                    raise RuntimeError("Archive timestamp has no timezone")
                if not start <= observed.astimezone(dt.timezone.utc) < end:
                    continue
                artifacts = manifest.get("artifacts", {})
                for key, content, path in (("html", html_bytes, html_path), ("json", snapshot_json_bytes, json_path)):
                    expected = artifacts.get(key, {})
                    if expected.get("fileName") != path.name or expected.get("bytes") != len(content) or expected.get("gzipBytes") != path.stat().st_size or expected.get("sha256") != hashlib.sha256(content).hexdigest():
                        raise RuntimeError("Archive artifact failed manifest verification")
                relative = revision.relative_to(root)
                target = destination / relative
                target.mkdir(parents=True, mode=0o700, exist_ok=False)
                copied = []
                for source in (html_path, json_path, manifest_path):
                    target_file = target / source.name
                    shutil.copyfile(source, target_file, follow_symlinks=False)
                    os.chmod(target_file, 0o600)
                    with target_file.open("r+b") as handle:
                        os.fsync(handle.fileno())
                    if hashlib.sha256(source.read_bytes()).digest() != hashlib.sha256(target_file.read_bytes()).digest():
                        raise RuntimeError("Copied artifact failed verification")
                    copied.append((source.name, target_file.stat().st_size))
                inventory.append({"key": str(relative).replace(os.sep, "/"), "files": copied})

if not inventory:
    raise RuntimeError("No verified response snapshots matched the requested range")
inventory_json = json.dumps(inventory, ensure_ascii=True, sort_keys=True, separators=(",", ":")).encode()
receipt = {
    "schemaVersion": 1,
    "brandId": brand,
    "fromUtcDate": sys.argv[3],
    "toUtcDateInclusive": sys.argv[4],
    "snapshotCount": len(inventory),
    "storedBytes": sum(size for item in inventory for _, size in item["files"]),
    "inventorySha256": hashlib.sha256(inventory_json).hexdigest(),
    "durability": "external_filesystem",
    "createdAt": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
}
receipt_path = destination / "export-receipt.json"
receipt_path.write_text(json.dumps(receipt, ensure_ascii=True, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
os.chmod(receipt_path, 0o600)
with receipt_path.open("r+b") as handle:
    os.fsync(handle.fileno())
if os.name == "posix":
    directory_fd = os.open(destination, os.O_RDONLY)
    try:
        os.fsync(directory_fd)
    finally:
        os.close(directory_fd)
print(json.dumps(receipt, ensure_ascii=True, sort_keys=True, separators=(",", ":")))
PY
