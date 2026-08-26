import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const repoRoot = new URL("../../../", import.meta.url);
const workflow = await readFile(new URL(".github/workflows/deploy-marketing.yaml", repoRoot), "utf8");
const dockerfile = await readFile(new URL("docker/Dockerfile.www", repoRoot), "utf8");
const caddyInstaller = await readFile(new URL("deploy/las/bin/install-marketing-caddy.sh", repoRoot), "utf8");
const regionalPreTrailingSlashUrl = new URL(
	"deploy/las/caddy/yonaris-marketing-regional-pre-trailing-slash.caddy",
	repoRoot,
);
const REGIONAL_PRE_TRAILING_SLASH_SHA = "804857e0867dfff19a5369eebf06cfe1d7865eff6d28e78309921d3cfd38ab52";
const regionalReleaseUrl = new URL("deploy/las/caddy/yonaris-marketing-regional.caddy", repoRoot);
const REGIONAL_RELEASE_SHA = "59e6772ec564e2e0e099cadd7a45e67379efcb53879627eb38e86ea8635536f5";

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

test("release fixtures bind both deployed regional predecessors byte-for-byte", async () => {
	ordered(
		"Verify release fixtures",
		"bash deploy/las/bin/install-marketing-caddy.test.sh",
		"Build and load the immutable release image",
	);
	assert.equal(existsSync(regionalPreTrailingSlashUrl), true, "missing deployed regional predecessor snapshot");
	const predecessor = await readFile(regionalPreTrailingSlashUrl);
	assert.equal(createHash("sha256").update(predecessor).digest("hex"), REGIONAL_PRE_TRAILING_SLASH_SHA);
	assert.match(
		caddyInstaller,
		new RegExp(`REGIONAL_PRE_TRAILING_SLASH_RELEASE_SHA="${REGIONAL_PRE_TRAILING_SLASH_SHA}"`, "u"),
	);
	assert.equal(existsSync(regionalReleaseUrl), true, "missing deployed regional release snapshot");
	const regionalRelease = await readFile(regionalReleaseUrl);
	assert.equal(createHash("sha256").update(regionalRelease).digest("hex"), REGIONAL_RELEASE_SHA);
	assert.match(caddyInstaller, new RegExp(`REGIONAL_RELEASE_SHA="${REGIONAL_RELEASE_SHA}"`, "u"));
	assert.match(
		caddyInstaller,
		/"\$REGIONAL_PRE_TRAILING_SLASH_RELEASE_SHA" \| "\$REGIONAL_RELEASE_SHA"\) return 0/u,
	);
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

test("remote preflight precedes source mutation and exact checkout verification", () => {
	ordered(
		"Remote secret preflight before source mutation",
		"--verify-only sha-$RELEASE_SHA",
		"Lock source and deploy the exact release",
		"flock --wait 1800 /opt/yonaris/.source-deploy.lock",
		"git fetch --depth=50 origin main",
		'git checkout --detach "$RELEASE_SHA"',
		'test "$(git rev-parse HEAD)" = "$RELEASE_SHA"',
		"deploy-marketing.sh sha-$RELEASE_SHA",
	);
	assert.match(workflow, /bash -s -- --verify-only sha-\$RELEASE_SHA/u);
});

test("post-deploy verification binds marker, image, live routes, and retired route boundaries", () => {
	ordered(
		"deploy-marketing.sh sha-$RELEASE_SHA",
		"Verify live marker, image, and governed health",
		".marketing-release",
		"docker inspect",
		"https://yonaris.com/",
		"https://portal.yonaris.com/",
		"https://yonaris.com/company",
		"https://yonaris.com/resources",
		"https://yonaris.com/status",
	);
	assert.match(workflow, /ghcr\.io\/blackdcp\/yonaris-www:sha-\$RELEASE_SHA/u);
	assert.match(workflow, /write-out '%\{http_code\}'[\s\S]*?yonaris\.com\/resources\)" = 404/u);
	assert.match(workflow, /write-out '%\{http_code\}'[\s\S]*?yonaris\.com\/status\)" = 404/u);
});
