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
AUTH_CONFIG="$PKG_DIR/src/auth/_cli-helper.ts"
OUTPUT="$PKG_DIR/src/db/schema-auth.ts"
TMP_OUTPUT="/tmp/better-auth-schema-gen.ts"

# The CLI needs a file that default-exports or exports `auth`.
# Our real config exports a factory function, so we use a thin wrapper.
mkdir -p "$(dirname "$AUTH_CONFIG")"
cat > "$AUTH_CONFIG" <<'EOF'
import { createAuth } from "./server";
export const auth = createAuth();
export default auth;
EOF

cleanup() { rm -f "$AUTH_CONFIG" "$TMP_OUTPUT"; }
trap cleanup EXIT

echo "[generate-auth-schema] Running better-auth CLI..."
echo "y" | npx @better-auth/cli@latest generate \
  --config "$AUTH_CONFIG" \
  --output "$TMP_OUTPUT" \
  2>&1

if [ ! -s "$TMP_OUTPUT" ]; then
  echo "[generate-auth-schema] ERROR: CLI produced empty output" >&2
  exit 1
fi

node "$SCRIPT_DIR/postprocess-auth-schema.mjs" "$TMP_OUTPUT" "$OUTPUT"
