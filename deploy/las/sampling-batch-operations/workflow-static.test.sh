#!/usr/bin/env bash

set -Eeuo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
WORKFLOW="$REPO_ROOT/.github/workflows/deploy-las.yaml"

if [[ -d "$REPO_ROOT/deploy/las/sampling-batch-operations/requests" ]]; then
	echo 'This release must not include an approved sampling batch request.' >&2
	exit 1
fi

if ! grep -Fq 'sampling_batch_operation_plan:' "$WORKFLOW"; then
	echo 'Sampling batch operation plan job is missing.' >&2
	exit 1
fi
if ! grep -Fq 'sampling-batch-operations/requests/*.json' "$WORKFLOW"; then
	echo 'Sampling batch operation plan does not inspect the explicit request directory.' >&2
	exit 1
fi
if ! grep -Fq 'sampling-batch-operations/**' "$WORKFLOW"; then
	echo 'Sampling batch operation changes will not trigger the production workflow.' >&2
	exit 1
fi
if ! grep -Fq 'deploy/las/browser-runner/**' "$WORKFLOW"; then
	echo 'Browser Runner host changes will not trigger the production workflow.' >&2
	exit 1
fi
if ! grep -Fq 'sampling-batch-operations/requests/$REQUEST_NAME' "$WORKFLOW"; then
	echo 'Sampling batch execution does not use the checked-in request selected by the plan.' >&2
	exit 1
fi
if ! grep -Fq 'run-sampling-batch-operation.sh sha-$RELEASE_SHA' "$WORKFLOW"; then
	echo 'Sampling batch execution does not use the immutable release helper.' >&2
	exit 1
fi

echo 'sampling batch operation workflow static test passed'
