#!/usr/bin/env bash

set -Eeuo pipefail
set +x
umask 077
PATH='/usr/bin:/bin'
export PATH
readonly PATH

/usr/bin/printf '%s\n' \
	'The legacy marketing Caddy launcher is permanently disabled, including all inside-host entry points. Use the root-owned stable manage-las-caddy helper.' >&2
exit 2
