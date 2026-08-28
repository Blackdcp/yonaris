import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const repoRoot = new URL("../../../", import.meta.url);
const workflow = await readFile(new URL(".github/workflows/deploy-marketing.yaml", repoRoot), "utf8");
const portalWorkflow = await readFile(new URL(".github/workflows/deploy-las.yaml", repoRoot), "utf8");
const dispatcher = await readFile(
	new URL("deploy/las/bin/dispatch-las-command.sh", repoRoot),
	"utf8",
);
const runtimeManager = await readFile(
	new URL("deploy/las/bin/manage-las-runtime.sh", repoRoot),
	"utf8",
);
const dockerfile = await readFile(new URL("docker/Dockerfile.www", repoRoot), "utf8");

const ACTION_PINS = [
	"actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
	"actions/setup-node@820762786026740c76f36085b0efc47a31fe5020",
	"pnpm/action-setup@f520eceda224fe1a4aed5a2a27a194379a409996",
	"docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e",
	"docker/login-action@dbcb813823bdd20940b903addbd779551569679f",
	"docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a",
];

function ordered(...needles) {
	let cursor = -1;
	for (const needle of needles) {
		const next = workflow.indexOf(needle, cursor + 1);
		assert.ok(next > cursor, `missing or out-of-order workflow token: ${needle}`);
		cursor = next;
	}
}

test("release supply chain uses immutable action and image references", () => {
	for (const pin of ACTION_PINS) assert.match(workflow, new RegExp(pin.replaceAll("/", "\\/"), "u"));
	assert.doesNotMatch(workflow, /^\s*uses:\s*[^\s]+@v\d+/gmu);
	assert.match(
		dockerfile,
		/^FROM node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS base$/mu,
	);
	assert.match(
		workflow,
		/docker\/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a[\s\S]*?platforms: linux\/amd64[\s\S]*?load: true[\s\S]*?push: false/u,
	);
});

test("release verification runs the permanently disabled legacy Caddy boundary test", () => {
	ordered(
		"Verify release fixtures",
		"bash deploy/las/bin/install-marketing-caddy.test.sh",
		"Build and load the immutable release image",
	);
});

test("marketing deploy path filters cover the complete LAS stable TCB", () => {
	const trigger = workflow.slice(0, workflow.indexOf("  workflow_dispatch:"));
	assert.match(trigger, /^\s+- deploy\/las\/bin\/\*\*$/mu);
	assert.doesNotMatch(trigger, /^\s+- deploy\/las\/bin\/(?!\*\*$).+$/gmu);
});

test("the exact image is tested directly and through pinned Caddy before its only push", () => {
	ordered(
		"Verify release fixtures",
		"Build and load the immutable release image",
		"Direct image smoke",
		"Digest-pinned Caddy integration smoke",
		"Push the already-verified image",
	);
	assert.equal((workflow.match(/docker push "\$IMAGE_REF"/gu) ?? []).length, 1);
	assert.equal((workflow.match(/docker\/build-push-action@/gu) ?? []).length, 1);
	assert.match(
		workflow,
		/if ! node apps\/www\/scripts\/smoke-marketing\.mjs[\s\S]*?docker logs "\$container_id"[\s\S]*?sleep 2[\s\S]*?node apps\/www\/scripts\/smoke-marketing\.mjs/u,
	);
	assert.match(workflow, /node apps\/www\/scripts\/smoke-marketing-caddy\.mjs "\$IMAGE_REF"/u);
});

test("remote marketing operations use only the stable forced-command protocol", () => {
	ordered(
		"Prove the exact forced-command boundary",
		'"yonaris-las-v1 probe"',
		'"true"',
		"Remote secret preflight before source mutation",
		"yonaris-las-v1 marketing-preflight sha-$RELEASE_SHA $WWW_DIGEST",
		"Lock source and deploy the exact release",
		"yonaris-las-v1 marketing-deploy sha-$RELEASE_SHA $WWW_DIGEST",
		"Verify live marker, image, and governed health",
		"yonaris-las-v1 marketing-verify sha-$RELEASE_SHA $WWW_DIGEST",
	);
	assert.doesNotMatch(workflow, /bash -s|<<|<deploy\/las\/bin|env RELEASE_SHA=/u);
	assert.match(workflow, /vars\.LAS_FORCED_COMMAND_ENABLED == 'true'/u);
	assert.match(workflow, /probe_output[\s\S]*?yonaris-las-probe-v1 ok/u);
	assert.match(
		workflow,
		/rejection_status" -ne 2[\s\S]*?Refusing non-protocol LAS SSH command\./u,
	);
});

test("post-deploy verification binds marker, image, live routes, and retired route boundaries", () => {
	for (const token of [
		"las-active-marketing-release-v1",
		"https://yonaris.com/",
		"https://portal.yonaris.com/",
		"https://yonaris.com/company",
		"https://yonaris.com/resources",
		"https://yonaris.com/status",
	]) {
		assert.ok(dispatcher.includes(token), `stable dispatcher is missing marketing boundary: ${token}`);
	}
	for (const token of ["docker inspect", 'container_matches "$id" "$MARKETING_IMAGE" "$www" yes']) {
		assert.ok(runtimeManager.includes(token), `stable runtime manager is missing marketing boundary: ${token}`);
	}
	assert.doesNotMatch(dispatcher, /docker inspect/u, "the SSH gate must not own the Docker API");
	assert.match(dispatcher, /authorize_candidate "\$release_tag" "\$operation"/u);
	assert.match(dispatcher, /STABLE_GUARD[\s\S]*?candidate "\$release_tag" "\$operation"/u);
	assert.match(dispatcher, /state_manager rollback-evidence portal "\$active_portal_release"/u);
	assert.match(
		dispatcher,
		/curl[\s\S]*?https:\/\/yonaris\.com\/[\s\S]*?data-generation="site-06"/u,
		"stable post-deploy verification must bind the live apex to Site 06",
	);
});

test("every workflow sharing the LAS deploy key has an enumerated remote-command shape", async () => {
	const workflowDirectory = new URL(".github/workflows/", repoRoot);
	const entries = (await readdir(workflowDirectory)).filter((name) => /\.ya?ml$/u.test(name));
	const sharedKeyWorkflows = [];
	for (const name of entries) {
		const contents = await readFile(new URL(name, workflowDirectory), "utf8");
		if (contents.includes("LAS_SSH_PRIVATE_KEY")) sharedKeyWorkflows.push(name);
	}
	assert.deepEqual(sharedKeyWorkflows.sort(), ["deploy-las.yaml", "deploy-marketing.yaml"]);

	const portalSshCalls = portalWorkflow.match(/ssh -i ~\/\.ssh\/yonaris_las/gu) ?? [];
	const portalProtocolCommands = portalWorkflow.match(/"yonaris-las-v1 [^"\n]+"/gu) ?? [];
	assert.equal(portalSshCalls.length, 14, "every checked-in portal SSH call must remain enumerated");
	assert.equal(portalProtocolCommands.length, 13, "every checked-in portal protocol command must remain enumerated");
	assert.equal((portalWorkflow.match(/"yonaris-las-v1 probe"/gu) ?? []).length, 1);
	assert.equal((portalWorkflow.match(/^\s*"true" 2>&1\)"$/gmu) ?? []).length, 1);
	assert.match(portalWorkflow, /rejection_status" -ne 2/u);
	assert.match(portalWorkflow, /Refusing non-protocol LAS SSH command\./u);
	assert.equal((portalWorkflow.match(/bash -s --/gu) ?? []).length, 0, "Actions never receives an unrestricted remote shell");
	assert.equal((portalWorkflow.match(/<<'REMOTE'/gu) ?? []).length, 0, "Actions never streams a remote heredoc");
	assert.doesNotMatch(portalWorkflow, /flock --wait 1800 \/opt\/yonaris\/\.source-deploy\.lock bash -c/u);
	assert.doesNotMatch(portalWorkflow, /LAS_FORCED_COMMAND_ENABLED != 'true'/u);
	assert.match(portalWorkflow, /vars\.LAS_DEPLOY_ENABLED == 'true'[\s\S]*?vars\.LAS_FORCED_COMMAND_ENABLED == 'true'/u);
	for (const job of [
		"response_snapshot_activation_plan",
		"browser_runner_activation_plan",
		"report_operation_plan",
		"sampling_batch_operation_plan",
		"overseas_formal_run_plan",
		"reviewed_consumer_cohort_import_plan",
		"program_locale_repair_plan",
		"program_import_plan",
		"response_snapshot_backfill_plan",
		"report-operations",
		"overseas-formal-readiness",
		"overseas-formal-one-shot",
		"response-snapshot-activation",
		"sampling-batch-operation",
		"local-demo-import",
		"reviewed-consumer-cohort-import",
		"program-locale-repair",
		"program-import",
		"response-snapshot-backfill",
		"browser-runner-activation",
	]) {
		const start = portalWorkflow.indexOf(`\n  ${job}:\n`);
		assert.notEqual(start, -1, `missing legacy job: ${job}`);
		const tail = portalWorkflow.slice(start + 1);
		const next = tail.slice(job.length + 4).search(/^  \S[^\n]*:\s*$/mu);
		const block = next === -1 ? tail : tail.slice(0, job.length + 4 + next);
		assert.match(block, /^    if: \$\{\{ false \}\}$/mu, `${job} must remain permanently disabled`);
	}

	const marketingSshCalls = workflow.match(/ssh -i ~\/\.ssh\/yonaris_las/gu) ?? [];
	const marketingProtocolCommands = workflow.match(/"yonaris-las-v1 marketing-[^"\n]+"/gu) ?? [];
	assert.equal(marketingSshCalls.length, 5, "every marketing SSH call must be enumerated");
	assert.equal(marketingProtocolCommands.length, 3, "all marketing SSH calls use the protocol");
	assert.equal((workflow.match(/"yonaris-las-v1 probe"/gu) ?? []).length, 1);
	assert.equal((workflow.match(/^\s*"true" 2>&1\)"$/gmu) ?? []).length, 1);
});

test("workflow exports registry digests for root policy authorization", () => {
	for (const token of ["web_digest:", "worker_digest:", "migrate_digest:"]) {
		assert.ok(portalWorkflow.includes(token), `portal workflow is missing ${token}`);
	}
	assert.ok(workflow.includes("www_digest:"), "marketing workflow is missing www_digest output");
	assert.match(portalWorkflow, /steps\.build_web\.outputs\.digest/u);
	assert.match(portalWorkflow, /steps\.build_worker\.outputs\.digest/u);
	assert.match(portalWorkflow, /steps\.build_migrate\.outputs\.digest/u);
	assert.match(workflow, /sha256:[0-9a-f]{64}|steps\.[a-z_]+\.outputs\.digest/u);
	assert.match(
		portalWorkflow,
		/vars\.LAS_POSTGRES_IMAGE_DIGEST \|\| 'sha256:97ff59a4e30e08d1c11bdcd9455e7832368c0572b576c9092cde2df4ae5552a3'/u,
		"production must retain an audited immutable Postgres fallback digest",
	);
});
