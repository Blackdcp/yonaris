#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf -- "$TEST_ROOT"' EXIT

mkdir -p "$TEST_ROOT/bin"

cat >"$TEST_ROOT/bin/caddy" <<'EOF'
#!/usr/bin/env sh
exit 0
EOF

cat >"$TEST_ROOT/bin/curl" <<'EOF'
#!/usr/bin/env sh
output=""
url=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --output)
      output="$2"
      shift 2
      ;;
    --write-out | --resolve | --max-time)
      shift 2
      ;;
    https://*)
      url="$1"
      shift
      ;;
    *)
      shift
      ;;
  esac
done
printf '%s\n' "$url" >>"$CURL_LOG"
if [ -n "$output" ] && [ "$output" != "/dev/null" ]; then
  case "$url" in
    */agent/company) printf '%s\n' 'AI-native MarTech' >"$output" ;;
    *) printf '%s\n' 'Product Truth' >"$output" ;;
  esac
fi
printf '200'
EOF

chmod +x "$TEST_ROOT/bin/caddy" "$TEST_ROOT/bin/curl"

cat >"$TEST_ROOT/legacy.caddy" <<'EOF'
yonaris.com, www.yonaris.com {
	tls cert key
	redir https://portal.yonaris.com{uri} permanent
}
EOF

cat >"$TEST_ROOT/previous.caddy" <<'EOF'
yonaris.com, www.yonaris.com {
	tls cert key
	route {
		@public path /
		reverse_proxy @public 127.0.0.1:1516
		respond 404
	}
}
EOF

cat >"$TEST_ROOT/marketing.caddy" <<'EOF'
yonaris.com, www.yonaris.com {
	tls cert key
	route {
		@public path / /zh /diagnostic /agent
		reverse_proxy @public 127.0.0.1:1516
		respond 404
	}
}
EOF

{
  printf '%s\n' 'unrelated.example {' $'\trespond "keep me"' '}'
  cat "$TEST_ROOT/previous.caddy"
  printf '%s\n' 'portal.yonaris.com {' $'\trespond "portal stays"' '}'
} >"$TEST_ROOT/Caddyfile"

CURL_LOG="$TEST_ROOT/curl.log" PATH="$TEST_ROOT/bin:$PATH" bash "$SCRIPT_DIR/install-marketing-caddy.sh" \
  --inside-host \
  "$TEST_ROOT/legacy.caddy" \
  "$TEST_ROOT/previous.caddy" \
  "$TEST_ROOT/marketing.caddy" \
  "$TEST_ROOT/Caddyfile"

CURL_LOG="$TEST_ROOT/curl.log" PATH="$TEST_ROOT/bin:$PATH" bash "$SCRIPT_DIR/install-marketing-caddy.sh" \
  --inside-host \
  "$TEST_ROOT/legacy.caddy" \
  "$TEST_ROOT/previous.caddy" \
  "$TEST_ROOT/marketing.caddy" \
  "$TEST_ROOT/Caddyfile"

grep -Fq '@public path / /zh /diagnostic /agent' "$TEST_ROOT/Caddyfile"
grep -Fq 'respond "keep me"' "$TEST_ROOT/Caddyfile"
grep -Fq 'respond "portal stays"' "$TEST_ROOT/Caddyfile"
grep -Fq 'https://yonaris.com/agent/company' "$TEST_ROOT/curl.log"

echo "marketing Caddy upgrade preserves unrelated blocks"
