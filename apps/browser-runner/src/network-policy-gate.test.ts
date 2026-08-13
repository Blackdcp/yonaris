import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
	assertManualBrowserCommandNetworkGate,
	type NetworkGateDependencies,
	type NetworkGateFile,
} from "./network-policy-gate.js";

const NOW = new Date("2026-08-13T03:00:00.000Z");
const BROWSER_UID = 991;
const CONFIG_PATH = "/etc/yonaris-browser-runner/network.env";
const APPROVED_PATH = "/etc/yonaris-browser-runner/approved-browser-domains";
const CONTROL_PATH = "/etc/yonaris-browser-runner/control-plane-hosts";
const ACTIVE_MARKER_PATH = "/run/yonaris-browser-runner/network-policy-active.json";
const PROBE_RECEIPT_PATH = "/run/yonaris-browser-runner/network-negative-probes.json";
const MANUAL_COMMANDS = ["login-window", "probe-selectors", "uat-once", "provision-dedicated-profile"] as const;

test("all manual browser commands require the same valid root-owned live network proof", async () => {
	for (const command of MANUAL_COMMANDS) {
		const fixture = validFixture();
		await assert.doesNotReject(
			assertManualBrowserCommandNetworkGate(
				command,
				{ browserUid: BROWSER_UID, environment: fixture.environment },
				fixture.dependencies,
			),
		);
		assert.equal(fixture.serviceChecks(), 1, `${command} did not check the active network service`);
	}
});

test("the manual browser gate rejects a disabled policy before trusting proof files", async () => {
	const fixture = validFixture();
	fixture.environment.BROWSER_NETWORK_POLICY_ENABLED = "false";
	await assert.rejects(
		assertManualBrowserCommandNetworkGate(
			"login-window",
			{ browserUid: BROWSER_UID, environment: fixture.environment },
			fixture.dependencies,
		),
		/policy.*enabled/i,
	);
});

test("the manual browser gate rejects stale negative-probe receipts", async () => {
	const fixture = validFixture({ verifiedAt: "2026-08-13T02:29:59.000Z" });
	await assert.rejects(
		assertManualBrowserCommandNetworkGate(
			"probe-selectors",
			{ browserUid: BROWSER_UID, environment: fixture.environment },
			fixture.dependencies,
		),
		/stale|expired/i,
	);
});

test("the manual browser gate rejects proof that is not root-owned", async () => {
	const fixture = validFixture();
	const receipt = fixture.files.get(PROBE_RECEIPT_PATH);
	assert.ok(receipt);
	fixture.files.set(PROBE_RECEIPT_PATH, { ...receipt, uid: 1000 });
	await assert.rejects(
		assertManualBrowserCommandNetworkGate(
			"uat-once",
			{ browserUid: BROWSER_UID, environment: fixture.environment },
			fixture.dependencies,
		),
		/root-owned/i,
	);
});

test("the manual browser gate rejects a receipt for a different browser UID", async () => {
	const fixture = validFixture({ receiptBrowserUid: BROWSER_UID + 1 });
	await assert.rejects(
		assertManualBrowserCommandNetworkGate(
			"provision-dedicated-profile",
			{ browserUid: BROWSER_UID, environment: fixture.environment },
			fixture.dependencies,
		),
		/browser UID/i,
	);
});

test("the manual browser gate rejects a receipt for a different policy hash", async () => {
	const fixture = validFixture({ policySha256: "f".repeat(64) });
	await assert.rejects(
		assertManualBrowserCommandNetworkGate(
			"login-window",
			{ browserUid: BROWSER_UID, environment: fixture.environment },
			fixture.dependencies,
		),
		/policy hash/i,
	);
});

type FixtureOptions = {
	verifiedAt?: string;
	receiptBrowserUid?: number;
	policySha256?: string;
};

function validFixture(options: FixtureOptions = {}) {
	const networkConfig = [
		"BROWSER_NETWORK_POLICY_ENABLED=true",
		"BROWSER_NETWORK_PROOF_TTL_SECONDS=1800",
		`BROWSER_NETWORK_APPROVED_DOMAINS=${APPROVED_PATH}`,
		`BROWSER_NETWORK_CONTROL_PLANE_HOSTS=${CONTROL_PATH}`,
		`BROWSER_NETWORK_ACTIVE_MARKER=${ACTIVE_MARKER_PATH}`,
		`BROWSER_NETWORK_PROBE_RECEIPT=${PROBE_RECEIPT_PATH}`,
		"",
	].join("\n");
	const approvedDomains = "www.doubao.com\nwww.volcengine.com\n";
	const controlHosts = "portal.yonaris.com\n";
	const actualPolicyHash = policyHash(networkConfig, approvedDomains, controlHosts);
	const policySha256 = options.policySha256 ?? actualPolicyHash;
	const proof = {
		schemaVersion: 1,
		verifiedAt: options.verifiedAt ?? "2026-08-13T02:45:00.000Z",
		browserUid: options.receiptBrowserUid ?? BROWSER_UID,
		policySha256,
		nftChain: "inet yonaris_browser_egress output",
	};
	const files = new Map<string, NetworkGateFile>([
		[CONFIG_PATH, rootFile(networkConfig, 0o600)],
		[APPROVED_PATH, rootFile(approvedDomains, 0o644)],
		[CONTROL_PATH, rootFile(controlHosts, 0o644)],
		[ACTIVE_MARKER_PATH, rootFile(JSON.stringify(proof), 0o644)],
		[PROBE_RECEIPT_PATH, rootFile(JSON.stringify({ ...proof, negativeProbesPassed: true }), 0o644)],
	]);
	let serviceChecks = 0;
	const dependencies: NetworkGateDependencies = {
		platform: "linux",
		now: () => NOW,
		inspectFile: async (filePath) => {
			const file = files.get(filePath);
			if (!file) throw new Error(`missing ${filePath}`);
			return file;
		},
		isNetworkServiceActive: async () => {
			serviceChecks += 1;
			return true;
		},
	};
	return {
		dependencies,
		environment: {
			BROWSER_NETWORK_POLICY_ENABLED: "true",
			BROWSER_NETWORK_CONFIG: CONFIG_PATH,
		},
		files,
		serviceChecks: () => serviceChecks,
	};
}

function rootFile(content: string, mode: 0o600 | 0o644): NetworkGateFile {
	return { uid: 0, mode, regularFile: true, symbolicLink: false, content };
}

function policyHash(networkConfig: string, approvedDomains: string, controlHosts: string): string {
	return createHash("sha256")
		.update("network.env\0")
		.update(networkConfig)
		.update("\0approved-browser-domains\0")
		.update(approvedDomains)
		.update("\0control-plane-hosts\0")
		.update(controlHosts)
		.digest("hex");
}
