#!/usr/bin/env bash

set -Eeuo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
WORKFLOW="$REPO_ROOT/.github/workflows/deploy-las.yaml"

REQUEST_DIR="$REPO_ROOT/deploy/las/sampling-batch-operations/requests"
EXPECTED_REQUEST="$REQUEST_DIR/stepfun-cn-doubao-6x-20260816-v6.json"

if [[ ! -f "$EXPECTED_REQUEST" ]]; then
	echo 'The approved v6 sampling batch request is missing.' >&2
	exit 1
fi
shopt -s nullglob
requests=("$REQUEST_DIR"/*.json)
if [[ ${#requests[@]} -ne 1 || "${requests[0]}" != "$EXPECTED_REQUEST" ]]; then
	echo 'The release must contain only the approved v6 sampling batch request.' >&2
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
