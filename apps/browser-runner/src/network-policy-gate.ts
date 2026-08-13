import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const NETWORK_SERVICE = "yonaris-browser-network.service";
const EGRESS_PROXY_SERVICE = "yonaris-browser-egress-proxy.service";
const EXPECTED_NFT_CHAIN = "inet yonaris_browser_egress output";
const DEFAULT_CONFIG_PATH = "/etc/yonaris-browser-runner/network.env";
const MANUAL_BROWSER_COMMANDS = new Set(["login-window", "probe-selectors", "uat-once", "provision-dedicated-profile"]);

export type NetworkGateFile = {
	uid: number;
	mode: number;
	regularFile: boolean;
	symbolicLink: boolean;
	content: string;
};

export type NetworkGateDependencies = {
	platform: string;
	now: () => Date;
	inspectFile: (filePath: string) => Promise<NetworkGateFile>;
	isNetworkServiceActive: () => Promise<boolean>;
	isProxyServiceActive: () => Promise<boolean>;
};

export type NetworkGateContext = {
	browserUid: number;
	environment: NodeJS.ProcessEnv | Record<string, string | undefined>;
};

export async function assertManualBrowserCommandNetworkGate(
	command: string | undefined,
	context: NetworkGateContext,
	dependencies: NetworkGateDependencies = productionNetworkGateDependencies,
): Promise<void> {
	if (!command || !MANUAL_BROWSER_COMMANDS.has(command)) return;
	if (dependencies.platform !== "linux") throw new Error("Manual browser commands require the Linux network gate");
	if (context.environment.BROWSER_NETWORK_POLICY_ENABLED?.trim() !== "true") {
		throw new Error("Manual browser commands require BROWSER_NETWORK_POLICY_ENABLED=true");
	}
	if (!(await dependencies.isNetworkServiceActive())) {
		throw new Error("Manual browser commands require an active browser network policy service");
	}
	if (!(await dependencies.isProxyServiceActive())) {
		throw new Error("Manual browser commands require an active browser egress proxy service");
	}

	const configPath = absolutePath(context.environment.BROWSER_NETWORK_CONFIG ?? DEFAULT_CONFIG_PATH, "network config");
	const configFile = await inspectRootOwnedFile(configPath, dependencies);
	const config = parseFixedEnvironment(configFile.content);
	if (config.BROWSER_NETWORK_POLICY_ENABLED !== "true") {
		throw new Error("Root-owned browser network policy is not enabled");
	}
	const ttlSeconds = boundedInteger(config.BROWSER_NETWORK_PROOF_TTL_SECONDS ?? "1800", "network proof TTL", 1, 3600);
	const approvedPath = absolutePath(config.BROWSER_NETWORK_APPROVED_DOMAINS, "approved-domain file");
	const controlPath = absolutePath(config.BROWSER_NETWORK_CONTROL_PLANE_HOSTS, "control-plane host file");
	const activeMarkerPath = absolutePath(
		config.BROWSER_NETWORK_ACTIVE_MARKER ?? "/run/yonaris-browser-runner/network-policy-active.json",
		"network active marker",
	);
	const probeReceiptPath = absolutePath(
		config.BROWSER_NETWORK_PROBE_RECEIPT ?? "/run/yonaris-browser-runner/network-negative-probes.json",
		"network probe receipt",
	);
	const [approvedFile, controlFile, activeMarkerFile, probeReceiptFile] = await Promise.all([
		inspectRootOwnedFile(approvedPath, dependencies),
		inspectRootOwnedFile(controlPath, dependencies),
		inspectRootOwnedFile(activeMarkerPath, dependencies),
		inspectRootOwnedFile(probeReceiptPath, dependencies),
	]);
	const policySha256 = browserNetworkPolicyHash(configFile.content, approvedFile.content, controlFile.content);
	const activeMarker = parseProof(activeMarkerFile.content, "network active marker");
	const probeReceipt = parseProof(probeReceiptFile.content, "network probe receipt");
	assertMatchingProof(activeMarker, context.browserUid, policySha256, "network active marker");
	assertMatchingProof(probeReceipt, context.browserUid, policySha256, "network probe receipt");
	if (probeReceipt.negativeProbesPassed !== true) {
		throw new Error("Browser network negative-probe receipt is incomplete");
	}
	const verifiedAt = Date.parse(probeReceipt.verifiedAt);
	if (!Number.isFinite(verifiedAt)) throw new Error("Browser network negative-probe receipt timestamp is invalid");
	const ageMilliseconds = dependencies.now().getTime() - verifiedAt;
	if (ageMilliseconds < -30_000) throw new Error("Browser network negative-probe receipt timestamp is in the future");
	if (ageMilliseconds > ttlSeconds * 1000) throw new Error("Browser network negative-probe receipt is stale");
}

export function browserNetworkPolicyHash(
	networkConfig: string,
	approvedDomains: string,
	controlPlaneHosts: string,
): string {
	return createHash("sha256")
		.update("network.env\0")
		.update(networkConfig)
		.update("\0approved-browser-domains\0")
		.update(approvedDomains)
		.update("\0control-plane-hosts\0")
		.update(controlPlaneHosts)
		.digest("hex");
}

type NetworkProof = {
	schemaVersion: number;
	verifiedAt: string;
	browserUid: number;
	policySha256: string;
	nftChain: string;
	negativeProbesPassed?: boolean;
};

function parseProof(content: string, label: string): NetworkProof {
	let value: unknown;
	try {
		value = JSON.parse(content);
	} catch {
		throw new Error(`Root-owned ${label} is not valid JSON`);
	}
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Root-owned ${label} is invalid`);
	const proof = value as Partial<NetworkProof>;
	if (
		proof.schemaVersion !== 1 ||
		typeof proof.verifiedAt !== "string" ||
		!Number.isSafeInteger(proof.browserUid) ||
		typeof proof.policySha256 !== "string" ||
		typeof proof.nftChain !== "string"
	) {
		throw new Error(`Root-owned ${label} is invalid`);
	}
	return proof as NetworkProof;
}

function assertMatchingProof(proof: NetworkProof, browserUid: number, policySha256: string, label: string): void {
	if (proof.browserUid !== browserUid) throw new Error(`Root-owned ${label} browser UID does not match this process`);
	if (proof.policySha256 !== policySha256)
		throw new Error(`Root-owned ${label} policy hash does not match current files`);
	if (proof.nftChain !== EXPECTED_NFT_CHAIN)
		throw new Error(`Root-owned ${label} does not attest the required nft chain`);
}

async function inspectRootOwnedFile(filePath: string, dependencies: NetworkGateDependencies): Promise<NetworkGateFile> {
	let file: NetworkGateFile;
	try {
		file = await dependencies.inspectFile(filePath);
	} catch {
		throw new Error(`Required root-owned browser network proof is unavailable: ${filePath}`);
	}
	if (file.uid !== 0) throw new Error(`Browser network proof must be root-owned: ${filePath}`);
	if (!file.regularFile || file.symbolicLink)
		throw new Error(`Browser network proof must be a regular non-symlink file: ${filePath}`);
	if (file.mode !== 0o600 && file.mode !== 0o644) {
		throw new Error(`Browser network proof must use mode 0600 or 0644: ${filePath}`);
	}
	return file;
}

function parseFixedEnvironment(content: string): Record<string, string> {
	const result: Record<string, string> = {};
	for (const rawLine of content.split(/\r?\n/u)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const match = /^([A-Z][A-Z0-9_]*)=(.*)$/u.exec(line);
		if (!match) throw new Error("Root-owned browser network configuration contains an invalid assignment");
		const [, key, rawValue] = match;
		let value = rawValue.trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		result[key] = value;
	}
	return result;
}

function absolutePath(value: string | undefined, label: string): string {
	const normalized = value?.trim();
	if (!normalized || normalized.includes("\0") || !path.posix.isAbsolute(normalized)) {
		throw new Error(`Browser ${label} must be an absolute path`);
	}
	return path.posix.normalize(normalized);
}

function boundedInteger(value: string | undefined, label: string, minimum: number, maximum: number): number {
	if (!value || !/^\d+$/u.test(value)) throw new Error(`Browser ${label} is invalid`);
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum)
		throw new Error(`Browser ${label} is invalid`);
	return parsed;
}

const productionNetworkGateDependencies: NetworkGateDependencies = {
	platform: process.platform,
	now: () => new Date(),
	inspectFile: async (filePath) => {
		const stats = await lstat(filePath);
		return {
			uid: stats.uid,
			mode: stats.mode & 0o777,
			regularFile: stats.isFile(),
			symbolicLink: stats.isSymbolicLink(),
			content: await readFile(filePath, "utf8"),
		};
	},
	isNetworkServiceActive: async () => {
		try {
			await execFileAsync("systemctl", ["is-active", "--quiet", NETWORK_SERVICE], { timeout: 5_000 });
			return true;
		} catch {
			return false;
		}
	},
	isProxyServiceActive: async () => {
		try {
			await execFileAsync("systemctl", ["is-active", "--quiet", EGRESS_PROXY_SERVICE], { timeout: 5_000 });
			return true;
		} catch {
			return false;
		}
	},
};
