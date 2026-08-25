#!/usr/bin/env node

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const CADDY_IMAGE =
	"docker.io/library/caddy:2.6.2-alpine@sha256:7992b931b7da3cf0840dd69ea74b2c67d423faf03408da8abdc31b7590a239a7";
export const CADDY_PLATFORM = "linux/amd64";

const REVIEWED_TLS = "tls /etc/caddy/certs/yonaris/yonaris-origin.pem /etc/caddy/certs/yonaris/yonaris-origin.key";
const REVIEWED_UPSTREAM = "127.0.0.1:1516";
const EXPECTED_UPSTREAM_OCCURRENCES = 5;
const ROOT_CERTIFICATE = "/data/caddy/pki/authorities/local/root.crt";
const CONTAINER_CERTIFICATE = "/certs/caddy-root.crt";

const fragmentPath = fileURLToPath(new URL("../../../deploy/las/caddy/yonaris-marketing.caddy", import.meta.url));
const smokePath = fileURLToPath(new URL("./smoke-marketing.mjs", import.meta.url));
const echoPath = fileURLToPath(new URL("./fixtures/header-echo-server.mjs", import.meta.url));
const probePath = fileURLToPath(new URL("./fixtures/caddy-policy-probe.mjs", import.meta.url));

export function prepareCaddyCandidate(fragment, upstream) {
	const tlsLines = fragment.match(/^\s*tls\s+.*$/gmu) ?? [];
	if (tlsLines.length !== 1 || tlsLines[0]?.trim() !== REVIEWED_TLS) {
		throw new Error("candidate must contain exactly one reviewed TLS line");
	}
	const upstreamOccurrences = fragment.split(REVIEWED_UPSTREAM).length - 1;
	if (upstreamOccurrences !== EXPECTED_UPSTREAM_OCCURRENCES) {
		throw new Error(`candidate must contain the reviewed upstream exactly ${EXPECTED_UPSTREAM_OCCURRENCES} times`);
	}
	return fragment
		.replace(tlsLines[0], `${tlsLines[0].match(/^\s*/u)?.[0] ?? ""}tls internal`)
		.replaceAll(REVIEWED_UPSTREAM, upstream);
}

export function executeCommand(command, args, context = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let stderr = "";
		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk) => {
			stdout += chunk;
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) resolve({ stdout, stderr });
			else reject(new Error(`${context.phase ?? "command"} failed (${code}): ${stderr.trim() || stdout.trim()}`));
		});
	});
}

function subnetPlan(seed) {
	const first = seed[0] ?? 1;
	const second = seed[1] ?? 1;
	const backendOctet = 16 + (first % 200);
	const trustedThird = 48 + (first % 16);
	const trustedBase = (second % 32) * 8;
	const ipv6Segment = `${first.toString(16)}${second.toString(16)}`;
	return {
		backend: `10.223.${backendOctet}.0/24`,
		backendClient: `10.223.${backendOctet}.4`,
		trustedV4: `173.245.${trustedThird}.${trustedBase}/29`,
		trustedV4Caddy: `173.245.${trustedThird}.${trustedBase + 2}`,
		trustedV4Client: `173.245.${trustedThird}.${trustedBase + 3}`,
		trustedV6: `2606:4700:${ipv6Segment}::/64`,
		trustedV6Caddy: `2606:4700:${ipv6Segment}::2`,
		trustedV6Client: `2606:4700:${ipv6Segment}::3`,
	};
}

function errorText(error) {
	return error instanceof Error ? error.message : String(error);
}

function alreadyAbsent(error) {
	return /No such container|No such network|network .* not found|No such volume|volume .* not found/iu.test(
		errorText(error),
	);
}

async function retryCleanup(label, action, failures, attempts = 3) {
	let lastError;
	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			await action();
			return;
		} catch (error) {
			if (alreadyAbsent(error)) return;
			lastError = error;
		}
	}
	failures.push(new Error(`${label}: ${errorText(lastError)}`));
}

export async function runCaddySmoke(imageRef, options = {}) {
	if (typeof imageRef !== "string" || !imageRef.trim() || /\s/u.test(imageRef))
		throw new Error("an exact built image reference is required");
	const execute = options.execute ?? executeCommand;
	const removeDirectory = options.removeDirectory ?? rm;
	const seed = randomBytes(4);
	const suffix = `${process.pid}-${seed.toString("hex")}`;
	const names = {
		backend: `yn-backend-${suffix}`,
		trustedV4: `yn-cf4-${suffix}`,
		trustedV6: `yn-cf6-${suffix}`,
		volume: `yn-caddy-data-${suffix}`,
		app: `yn-www-${suffix}`,
		caddy: `yn-caddy-${suffix}`,
		echo: `yn-echo-${suffix}`,
		routeClient: `yn-route-${suffix}`,
		trustedV4Client: `yn-probe4-${suffix}`,
		trustedV6Client: `yn-probe6-${suffix}`,
		directClient: `yn-probe-direct-${suffix}`,
	};
	const tempRoot = options.tempRoot ?? tmpdir();
	const workingDirectory = await mkdtemp(join(tempRoot, "yonaris-caddy-smoke-"));
	const appConfig = join(workingDirectory, "Caddyfile.app");
	const echoConfig = join(workingDirectory, "Caddyfile.echo");
	const rootCertificate = join(workingDirectory, "caddy-root.crt");
	const subnets = subnetPlan(seed);

	const cleanup = async () => {
		const failures = [];
		for (const container of [
			names.routeClient,
			names.trustedV4Client,
			names.trustedV6Client,
			names.directClient,
			names.caddy,
			names.app,
			names.echo,
		]) {
			await retryCleanup(
				`container ${container}`,
				() => execute("docker", ["rm", "-f", container], { phase: "cleanup" }),
				failures,
			);
		}
		for (const network of [names.trustedV4, names.trustedV6, names.backend]) {
			await retryCleanup(
				`network ${network}`,
				() => execute("docker", ["network", "rm", network], { phase: "cleanup" }),
				failures,
			);
		}
		await retryCleanup(
			`volume ${names.volume}`,
			() => execute("docker", ["volume", "rm", "-f", names.volume], { phase: "cleanup" }),
			failures,
		);
		await retryCleanup(
			`temporary directory ${workingDirectory}`,
			() => removeDirectory(workingDirectory, { recursive: true, force: true }),
			failures,
		);
		return failures;
	};

	const startCaddy = async (configPath) => {
		await execute(
			"docker",
			[
				"run",
				"-d",
				"--name",
				names.caddy,
				"--platform",
				CADDY_PLATFORM,
				"--network",
				names.backend,
				"--network-alias",
				"yonaris.com",
				"--mount",
				`type=bind,source=${configPath},target=/etc/caddy/Caddyfile,readonly`,
				"--mount",
				`type=volume,source=${names.volume},target=/data`,
				CADDY_IMAGE,
				"caddy",
				"run",
				"--config",
				"/etc/caddy/Caddyfile",
				"--adapter",
				"caddyfile",
			],
			{ phase: "caddy-start" },
		);
		await execute(
			"docker",
			["network", "connect", "--alias", "yonaris.com", "--ip", subnets.trustedV4Caddy, names.trustedV4, names.caddy],
			{ phase: "caddy-connect" },
		);
		await execute(
			"docker",
			["network", "connect", "--alias", "yonaris.com", "--ip6", subnets.trustedV6Caddy, names.trustedV6, names.caddy],
			{ phase: "caddy-connect" },
		);
		await execute("docker", ["exec", names.caddy, "caddy", "validate", "--config", "/etc/caddy/Caddyfile"], {
			phase: "caddy-validate",
		});
	};

	let operationError;
	try {
		const fragment = await readFile(fragmentPath, "utf8");
		await writeFile(appConfig, prepareCaddyCandidate(fragment, "www:3000"), { encoding: "utf8", mode: 0o600 });
		await writeFile(echoConfig, prepareCaddyCandidate(fragment, "echo:3000"), { encoding: "utf8", mode: 0o600 });

		await execute("docker", ["image", "inspect", imageRef], { phase: "image-preflight" });
		await execute("docker", ["network", "create", "--subnet", subnets.backend, names.backend], { phase: "network" });
		await execute("docker", ["network", "create", "--subnet", subnets.trustedV4, names.trustedV4], {
			phase: "network",
		});
		await execute("docker", ["network", "create", "--ipv6", "--subnet", subnets.trustedV6, names.trustedV6], {
			phase: "network",
		});
		await execute("docker", ["volume", "create", names.volume], { phase: "volume" });

		await execute(
			"docker",
			[
				"run",
				"-d",
				"--name",
				names.app,
				"--platform",
				CADDY_PLATFORM,
				"--network",
				names.backend,
				"--network-alias",
				"www",
				imageRef,
			],
			{ phase: "app-start" },
		);
		await startCaddy(appConfig);
		await execute("docker", ["cp", `${names.caddy}:${ROOT_CERTIFICATE}`, rootCertificate], { phase: "tls" });

		const routeResult = await execute(
			"docker",
			[
				"run",
				"--rm",
				"--name",
				names.routeClient,
				"--platform",
				CADDY_PLATFORM,
				"--network",
				names.backend,
				"--env",
				`NODE_EXTRA_CA_CERTS=${CONTAINER_CERTIFICATE}`,
				"--volume",
				`${rootCertificate}:${CONTAINER_CERTIFICATE}:ro`,
				"--volume",
				`${smokePath}:/smoke/smoke-marketing.mjs:ro`,
				"--entrypoint",
				"node",
				imageRef,
				"/smoke/smoke-marketing.mjs",
				"https://yonaris.com/",
				"--caddy",
			],
			{ phase: "route" },
		);
		if (!routeResult.stdout.includes("904 Accept and trailing-slash cases checked.")) {
			throw new Error("route probe did not emit the strict release matrix summary");
		}

		await execute("docker", ["rm", "-f", names.caddy, names.app], { phase: "transition" });
		await execute(
			"docker",
			[
				"run",
				"-d",
				"--name",
				names.echo,
				"--platform",
				CADDY_PLATFORM,
				"--network",
				names.backend,
				"--network-alias",
				"echo",
				"--volume",
				`${echoPath}:/harness/header-echo-server.mjs:ro`,
				"--entrypoint",
				"node",
				imageRef,
				"/harness/header-echo-server.mjs",
			],
			{ phase: "echo-start" },
		);
		await startCaddy(echoConfig);

		const probeBase = [
			"run",
			"--rm",
			"--platform",
			CADDY_PLATFORM,
			"--env",
			`NODE_EXTRA_CA_CERTS=${CONTAINER_CERTIFICATE}`,
			"--volume",
			`${rootCertificate}:${CONTAINER_CERTIFICATE}:ro`,
			"--volume",
			`${probePath}:/harness/caddy-policy-probe.mjs:ro`,
			"--entrypoint",
			"node",
		];
		await execute(
			"docker",
			[
				...probeBase,
				"--name",
				names.trustedV4Client,
				"--network",
				names.trustedV4,
				"--ip",
				subnets.trustedV4Client,
				imageRef,
				"/harness/caddy-policy-probe.mjs",
				"trusted-v4",
				"https://yonaris.com/",
				"198.51.100.11",
				"198.51.100.12",
			],
			{ phase: "identity" },
		);
		await execute(
			"docker",
			[
				...probeBase,
				"--name",
				names.trustedV6Client,
				"--network",
				names.trustedV6,
				"--ip6",
				subnets.trustedV6Client,
				imageRef,
				"/harness/caddy-policy-probe.mjs",
				"trusted-v6",
				"https://yonaris.com/",
				"2001:db8::11",
				"2001:db8::12",
			],
			{ phase: "identity" },
		);
		await execute(
			"docker",
			[
				...probeBase,
				"--name",
				names.directClient,
				"--network",
				names.backend,
				"--ip",
				subnets.backendClient,
				imageRef,
				"/harness/caddy-policy-probe.mjs",
				"direct",
				"https://yonaris.com/",
				"203.0.113.201",
				"203.0.113.202",
				subnets.backendClient,
			],
			{ phase: "identity" },
		);
	} catch (error) {
		operationError = error;
	}

	const cleanupFailures = await cleanup();
	if (operationError && cleanupFailures.length === 0) throw operationError;
	if (operationError || cleanupFailures.length > 0) {
		const errors = operationError ? [operationError, ...cleanupFailures] : cleanupFailures;
		const operationSummary = operationError ? `Caddy smoke failed: ${errorText(operationError)}; ` : "";
		throw new AggregateError(
			errors,
			`${operationSummary}cleanup failed: ${cleanupFailures.map((error) => error.message).join("; ")}`,
		);
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await runCaddySmoke(process.argv[2]);
}
