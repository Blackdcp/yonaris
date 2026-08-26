#!/usr/bin/env bash
#
# Regenerate the better-auth Drizzle schema from the auth server config.
#
# Usage:  pnpm run generate:auth-schema   (from packages/lib)
#    or:  bash packages/lib/scripts/generate-auth-schema.sh  (from repo root)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT="${AUTH_SCHEMA_OUTPUT:-$PKG_DIR/src/db/schema-auth.ts}"
TMP_ROOT="${AUTH_SCHEMA_TMP_ROOT:-$PKG_DIR}"
PNPM_BIN="${PNPM_BIN:-pnpm}"

mkdir -p "$TMP_ROOT"
TMP_DIR="$(mktemp -d "$TMP_ROOT/.yonaris-auth-schema.XXXXXX")"
AUTH_CONFIG="$TMP_DIR/auth-config.ts"
CLI_OUTPUT="$TMP_DIR/schema-auth.cli.ts"
PROCESSED_OUTPUT="$TMP_DIR/schema-auth.processed.ts"

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

# The CLI needs a file that exports `auth`. Compute a portable relative
# import so tests can isolate the temporary root without changing the source.
AUTH_SERVER_IMPORT="$(node -e '
const path = require("node:path");
const [helper, server] = process.argv.slice(1);
let relative = path.relative(path.dirname(helper), server).replaceAll("\\", "/").replace(/\.ts$/, "");
if (!relative.startsWith(".")) relative = `./${relative}`;
process.stdout.write(relative);
' "$AUTH_CONFIG" "$PKG_DIR/src/auth/server.ts")"
printf '%s\n' "import { createAuth } from \"$AUTH_SERVER_IMPORT\";
export const auth = createAuth();
export default auth;" > "$AUTH_CONFIG"

cd "$PKG_DIR"
echo "[generate-auth-schema] Running better-auth CLI..."
"$PNPM_BIN" exec better-auth generate \
  --yes \
  --config "$AUTH_CONFIG" \
  --output "$CLI_OUTPUT" \
  2>&1

if [ ! -s "$CLI_OUTPUT" ]; then
  echo "[generate-auth-schema] ERROR: CLI produced empty output" >&2
  exit 1
fi

node "$SCRIPT_DIR/postprocess-auth-schema.mjs" "$CLI_OUTPUT" "$PROCESSED_OUTPUT"
mkdir -p "$(dirname "$OUTPUT")"
mv -f "$PROCESSED_OUTPUT" "$OUTPUT"
