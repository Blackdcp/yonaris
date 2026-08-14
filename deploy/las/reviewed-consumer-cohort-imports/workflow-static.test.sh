#!/usr/bin/env bash

set -Eeuo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "$0")/../../.." && pwd)"
WORKFLOW="$REPO_ROOT/.github/workflows/deploy-las.yaml"
REQUEST="$REPO_ROOT/deploy/las/reviewed-consumer-cohort-imports/requests/stepfun-local-pc-deepseek-18-20260814.json"
MANIFEST="$REPO_ROOT/apps/worker/src/reviewed-consumer-cohorts/stepfun-local-pc-deepseek-18-20260814.json"

test -f "$REQUEST"
test -f "$MANIFEST"
grep -Fq 'reviewed_consumer_cohort_import_plan:' "$WORKFLOW"
grep -Fq 'reviewed-consumer-cohort-imports/requests/*.json' "$WORKFLOW"
grep -Fq 'reviewed-consumer-cohort-imports/**' "$WORKFLOW"
grep -Fq 'run-reviewed-consumer-cohort-import.sh sha-$RELEASE_SHA' "$WORKFLOW"
grep -Fq 'reviewed-consumer-cohort-import:' "$WORKFLOW"
grep -Fq 'local-demo-import' "$WORKFLOW"

echo 'reviewed consumer cohort workflow static test passed'
