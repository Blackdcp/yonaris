import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const helperUrl = new URL("./smoke-marketing-caddy.mjs", import.meta.url);
const helperExists = existsSync(helperUrl);

test("the digest-pinned Caddy smoke helper exists", () => {
	assert.equal(helperExists, true);
});

test("candidate generation changes only the reviewed TLS and upstream lines", { skip: !helperExists }, async () => {
	const { prepareCaddyCandidate } = await import(helperUrl.href);
	const source = await import("node:fs/promises").then(({ readFile }) =>
		readFile(new URL("../../../deploy/las/caddy/yonaris-marketing.caddy", import.meta.url), "utf8"),
	);
	const candidate = prepareCaddyCandidate(source, "www:3000");
	assert.match(candidate, /\n\ttls internal\n/u);
	assert.doesNotMatch(candidate, /yonaris-origin\.(?:pem|key)/u);
	assert.doesNotMatch(candidate, /127\.0\.0\.1:1516/u);
	assert.match(candidate, /reverse_proxy @diagnosticCloudflare www:3000/u);

	const restored = candidate
		.replace(
			"\ttls internal",
			"\ttls /etc/caddy/certs/yonaris/yonaris-origin.pem /etc/caddy/certs/yonaris/yonaris-origin.key",
		)
		.replaceAll("www:3000", "127.0.0.1:1516");
	assert.equal(restored, source);
	assert.throws(
		() => prepareCaddyCandidate(source.replace("encode zstd gzip", "tls internal"), "www:3000"),
		/exactly one reviewed TLS line/u,
	);
	assert.throws(
		() => prepareCaddyCandidate(source.replaceAll("127.0.0.1:1516", "localhost:1516"), "www:3000"),
		/reviewed upstream/u,
	);
});

function fakeExecutor(calls, failAt) {
	return async (command, args, context = {}) => {
		calls.push({ command, args: [...args], phase: context.phase });
		if (context.phase === failAt) throw new Error(`forced ${failAt} failure`);
		if (context.phase === "route")
			return { stdout: "904 Accept and trailing-slash cases checked.\n49 routes passed.\n", stderr: "" };
		return { stdout: "fixture-id\n", stderr: "" };
	};
}

function trackingExecutor(calls, { failEveryFirstCleanup = false, permanentCleanupType } = {}) {
	const owned = {
		containers: new Set(),
		networks: new Set(),
		volumes: new Set(),
	};
	const cleanupAttempts = new Map();

	const resourceForCleanup = (args) => {
		if (args[0] === "rm" && args[1] === "-f") return { type: "container", names: args.slice(2) };
		if (args[0] === "network" && args[1] === "rm") return { type: "network", names: args.slice(2) };
		if (args[0] === "volume" && args[1] === "rm" && args[2] === "-f") return { type: "volume", names: args.slice(3) };
		return undefined;
	};

	const execute = async (command, args, context = {}) => {
		calls.push({ command, args: [...args], phase: context.phase });
		if (command !== "docker") return { stdout: "fixture-id\n", stderr: "" };

		if (context.phase === "cleanup") {
			const resource = resourceForCleanup(args);
			assert.ok(resource, `unexpected cleanup command: ${args.join(" ")}`);
			const key = `${resource.type}:${resource.names.join(",")}`;
			const attempts = (cleanupAttempts.get(key) ?? 0) + 1;
			cleanupAttempts.set(key, attempts);
			if (permanentCleanupType === resource.type || (failEveryFirstCleanup && attempts === 1)) {
				throw new Error(`forced ${resource.type} cleanup failure`);
			}
			const collection = owned[`${resource.type}s`];
			for (const name of resource.names) collection.delete(name);
			return { stdout: "", stderr: "" };
		}

		if (args[0] === "network" && args[1] === "create") owned.networks.add(args.at(-1));
		if (args[0] === "volume" && args[1] === "create") owned.volumes.add(args.at(-1));
		if (args[0] === "run" && args.includes("-d")) {
			const nameIndex = args.indexOf("--name");
			if (nameIndex !== -1) owned.containers.add(args[nameIndex + 1]);
		}
		if (args[0] === "rm" && args[1] === "-f") {
			for (const name of args.slice(2)) owned.containers.delete(name);
		}
		if (context.phase === "route")
			return { stdout: "904 Accept and trailing-slash cases checked.\n49 routes passed.\n", stderr: "" };
		return { stdout: "fixture-id\n", stderr: "" };
	};

	return { execute, owned, cleanupAttempts };
}

test("orchestration pins Caddy, verifies its CA, and runs trusted-v4, trusted-v6, and direct probes", {
	skip: !helperExists,
}, async () => {
	const { runCaddySmoke } = await import(helperUrl.href);
	const calls = [];
	const root = await mkdtemp(join(tmpdir(), "yonaris-caddy-fixture-"));
	try {
		await runCaddySmoke("yonaris-www:fixture", { execute: fakeExecutor(calls), tempRoot: root });
		const caddyStart = calls.find((call) => call.phase === "caddy-start");
		assert.ok(caddyStart, "Caddy was not started");
		assert.ok(caddyStart.args.includes("--platform"));
		assert.ok(caddyStart.args.includes("linux/amd64"));
		assert.ok(
			caddyStart.args.includes(
				"docker.io/library/caddy:2.6.2-alpine@sha256:7992b931b7da3cf0840dd69ea74b2c67d423faf03408da8abdc31b7590a239a7",
			),
		);
		const caddyImageIndex = caddyStart.args.indexOf(
			"docker.io/library/caddy:2.6.2-alpine@sha256:7992b931b7da3cf0840dd69ea74b2c67d423faf03408da8abdc31b7590a239a7",
		);
		assert.deepEqual(caddyStart.args.slice(caddyImageIndex + 1), [
			"caddy",
			"run",
			"--config",
			"/etc/caddy/Caddyfile",
			"--adapter",
			"caddyfile",
		]);

		const caCopy = calls.find((call) => call.phase === "tls" && call.args[0] === "cp");
		assert.ok(caCopy?.args[1].endsWith(":/data/caddy/pki/authorities/local/root.crt"));
		const routeProbe = calls.find((call) => call.phase === "route");
		assert.ok(routeProbe?.args.includes("NODE_EXTRA_CA_CERTS=/certs/caddy-root.crt"));
		assert.ok(routeProbe?.args.some((arg) => arg.endsWith(":/certs/caddy-root.crt:ro")));

		const identityCalls = calls.filter((call) => call.phase === "identity");
		assert.ok(identityCalls.some((call) => call.args.includes("trusted-v4")));
		assert.ok(identityCalls.some((call) => call.args.includes("trusted-v6")));
		assert.ok(identityCalls.some((call) => call.args.includes("direct")));
		assert.ok(identityCalls.some((call) => call.args.includes("198.51.100.11") && call.args.includes("198.51.100.12")));
		assert.ok(identityCalls.some((call) => call.args.includes("2001:db8::11") && call.args.includes("2001:db8::12")));
		assert.ok(identityCalls.some((call) => call.args.includes("203.0.113.201") && call.args.includes("203.0.113.202")));

		const commandText = calls.flatMap((call) => call.args).join(" ");
		assert.doesNotMatch(commandText, /(?:^|\s)-k(?:\s|$)|--insecure|NODE_TLS_REJECT_UNAUTHORIZED=0/u);
		assert.deepEqual(await readdir(root), []);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("candidate permits exactly the thirteen canonical Human trailing-slash variants", { skip: !helperExists }, async () => {
	const { prepareCaddyCandidate } = await import(helperUrl.href);
	const source = await import("node:fs/promises").then(({ readFile }) =>
		readFile(new URL("../../../deploy/las/caddy/yonaris-marketing.caddy", import.meta.url), "utf8"),
	);
	const candidate = prepareCaddyCandidate(source, "www:3000");
	const publicMatcher = candidate.match(/@publicGetHead\s*\{[\s\S]*?\bpath\s+([^\n]+)\n/u)?.[1] ?? "";
	const paths = new Set(publicMatcher.trim().split(/\s+/u));
	const trailingPaths = [
		"/zh/",
		"/product/",
		"/zh/product/",
		"/approach/",
		"/zh/approach/",
		"/company/",
		"/zh/company/",
		"/geo/",
		"/zh/geo/",
		"/diagnostic/",
		"/zh/diagnostic/",
		"/privacy/",
		"/zh/privacy/",
	];
	for (const path of trailingPaths) assert.ok(paths.has(path), `Caddy must proxy ${path}`);
	assert.ok(!paths.has("/zh/*"), "the exact Human policy must not widen to /zh/*");
});

test("candidate exposes only the scoped Site 06 brand assets", { skip: !helperExists }, async () => {
	const { prepareCaddyCandidate } = await import(helperUrl.href);
	const source = await import("node:fs/promises").then(({ readFile }) =>
		readFile(new URL("../../../deploy/las/caddy/yonaris-marketing.caddy", import.meta.url), "utf8"),
	);
	const candidate = prepareCaddyCandidate(source, "www:3000");
	const publicMatcher = candidate.match(/@publicGetHead\s*\{[\s\S]*?\bpath\s+([^\n]+)\n/u)?.[1] ?? "";
	const paths = new Set(publicMatcher.trim().split(/\s+/u));
	assert.ok(paths.has("/brand/site-06/*"), "Caddy must proxy the Site 06 photography assets");
	assert.ok(!paths.has("/brand/*"), "the Site 06 exception must not expose every brand asset");
});

test("Caddy smoke rejects an exit-zero route probe that did not run the strict release matrix", {
	skip: !helperExists,
}, async () => {
	const { runCaddySmoke } = await import(helperUrl.href);
	const calls = [];
	const root = await mkdtemp(join(tmpdir(), "yonaris-caddy-fixture-"));
	const execute = async (command, args, context = {}) => {
		const result = await fakeExecutor(calls)(command, args, context);
		return context.phase === "route" ? { stdout: "49 routes passed.\n", stderr: "" } : result;
	};
	try {
		await assert.rejects(
			() => runCaddySmoke("yonaris-www:fixture", { execute, tempRoot: root }),
			/strict release matrix summary/u,
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

for (const phase of ["caddy-start", "tls", "route", "identity"]) {
	test(`a forced ${phase} failure removes every owned Docker and temporary resource`, {
		skip: !helperExists,
	}, async () => {
		const { runCaddySmoke } = await import(helperUrl.href);
		const calls = [];
		const root = await mkdtemp(join(tmpdir(), "yonaris-caddy-fixture-"));
		try {
			await assert.rejects(
				() => runCaddySmoke("yonaris-www:fixture", { execute: fakeExecutor(calls, phase), tempRoot: root }),
				new RegExp(`forced ${phase} failure`, "u"),
			);
			const dockerCalls = calls.filter((call) => call.command === "docker").map((call) => call.args.join(" "));
			assert.ok(
				dockerCalls.some((call) => call.startsWith("rm -f ")),
				"containers were not force-removed",
			);
			assert.equal(dockerCalls.filter((call) => call.startsWith("network rm ")).length, 3);
			assert.equal(dockerCalls.filter((call) => call.startsWith("volume rm -f ")).length, 1);
			assert.deepEqual(await readdir(root), []);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
}

test("cleanup retries every owned Docker resource after a transient removal failure", {
	skip: !helperExists,
}, async () => {
	const { runCaddySmoke } = await import(helperUrl.href);
	const calls = [];
	const tracker = trackingExecutor(calls, { failEveryFirstCleanup: true });
	const root = await mkdtemp(join(tmpdir(), "yonaris-caddy-fixture-"));
	try {
		await runCaddySmoke("yonaris-www:fixture", { execute: tracker.execute, tempRoot: root });
		assert.deepEqual([...tracker.owned.containers], []);
		assert.deepEqual([...tracker.owned.networks], []);
		assert.deepEqual([...tracker.owned.volumes], []);
		assert.ok([...tracker.cleanupAttempts.values()].every((attempts) => attempts >= 2));
		assert.deepEqual(await readdir(root), []);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("cleanup attempts every resource and reports a residual Docker cleanup failure", {
	skip: !helperExists,
}, async () => {
	const { runCaddySmoke } = await import(helperUrl.href);
	const calls = [];
	const tracker = trackingExecutor(calls, { permanentCleanupType: "volume" });
	const root = await mkdtemp(join(tmpdir(), "yonaris-caddy-fixture-"));
	try {
		await assert.rejects(
			() => runCaddySmoke("yonaris-www:fixture", { execute: tracker.execute, tempRoot: root }),
			/cleanup failed.*volume yn-caddy-data-/u,
		);
		assert.deepEqual([...tracker.owned.containers], []);
		assert.deepEqual([...tracker.owned.networks], []);
		assert.equal(tracker.owned.volumes.size, 1);
		assert.ok(
			[...tracker.cleanupAttempts.entries()].some(([key, attempts]) => key.startsWith("volume:") && attempts >= 2),
		);
		assert.deepEqual(await readdir(root), []);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("temporary-directory cleanup failures are surfaced after Docker cleanup", { skip: !helperExists }, async () => {
	const { runCaddySmoke } = await import(helperUrl.href);
	const calls = [];
	const root = await mkdtemp(join(tmpdir(), "yonaris-caddy-fixture-"));
	try {
		await assert.rejects(
			() =>
				runCaddySmoke("yonaris-www:fixture", {
					execute: fakeExecutor(calls),
					tempRoot: root,
					removeDirectory: async () => {
						throw new Error("forced temp cleanup failure");
					},
				}),
			/cleanup failed.*temporary directory.*forced temp cleanup failure/u,
		);
		const cleanupCalls = calls.filter((call) => call.phase === "cleanup");
		assert.equal(cleanupCalls.filter((call) => call.args[0] === "network").length, 3);
		assert.equal(cleanupCalls.filter((call) => call.args[0] === "volume").length, 1);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
