import { brokerRuntimeConfigurationFromEnvironment } from "./broker-runtime.js";
import { BrokerEvidenceStore, BrokerService } from "./broker-server.js";
import { createLinuxPeerVerifier, startBrokerSocketServer } from "./broker-socket.js";
import { sanitizeDiagnostic } from "./errors.js";
import { assertManualBrowserCommandNetworkGate } from "./network-policy-gate.js";

async function main(): Promise<void> {
	const rawArguments = process.argv.slice(2);
	if (rawArguments[0] === "--") rawArguments.shift();
	const [command, ...unexpected] = rawArguments;
	if (unexpected.length > 0) throw new Error("Browser broker commands do not accept positional or secret arguments");
	if (process.platform !== "linux") throw new Error("Browser broker service commands require Linux");
	const configuration = brokerRuntimeConfigurationFromEnvironment(process.env);
	if (process.getgid?.() !== configuration.rpcGid) {
		throw new Error("Browser broker primary service group does not match BROWSER_BROKER_RPC_GID");
	}
	process.umask(0o027);
	await assertManualBrowserCommandNetworkGate(command, {
		browserUid: configuration.browserUid,
		environment: process.env,
	});

	if (command === "preflight") {
		const { runChromiumSandboxPreflight } = await import("./sandbox-preflight.js");
		await runChromiumSandboxPreflight(configuration.stateDirectory);
		process.stdout.write(`${JSON.stringify({ status: "ready", chromiumSandbox: true })}\n`);
		return;
	}
	if (command === "login-window") {
		const { openDedicatedDoubaoLoginWindow } = await import("./dedicated-profile-uat.js");
		const result = await openDedicatedDoubaoLoginWindow(configuration.stateDirectory);
		process.stdout.write(`${JSON.stringify(result)}\n`);
		return;
	}
	if (command === "probe-selectors") {
		const { collectDedicatedDoubaoSelectorProbe } = await import("./dedicated-profile-uat.js");
		const result = await collectDedicatedDoubaoSelectorProbe(configuration.stateDirectory);
		process.stdout.write(`${JSON.stringify(result)}\n`);
		return;
	}
	if (command === "uat-once") {
		const { runDedicatedDoubaoUatOnce } = await import("./dedicated-profile-uat.js");
		const result = await runDedicatedDoubaoUatOnce(configuration.stateDirectory);
		process.stdout.write(`${JSON.stringify(result)}\n`);
		return;
	}
	if (command === "anonymous-uat-once") {
		const { runAnonymousDoubaoUatOnce } = await import("./dedicated-profile-uat.js");
		const result = await runAnonymousDoubaoUatOnce(configuration.stateDirectory);
		process.stdout.write(`${JSON.stringify(result)}\n`);
		return;
	}
	if (command === "provision-dedicated-profile") {
		const { provisionDedicatedDoubaoProfile } = await import("./dedicated-profile-provision.js");
		const profileDirectory = await provisionDedicatedDoubaoProfile(configuration.stateDirectory);
		process.stdout.write(`${JSON.stringify({ status: "ready", profileDirectory })}\n`);
		return;
	}
	if (command === "serve") {
		const [{ DoubaoLiveSessionFactory }, { runChromiumSandboxPreflight }] = await Promise.all([
			import("./adapters/doubao-live.js"),
			import("./sandbox-preflight.js"),
		]);
		await runChromiumSandboxPreflight(configuration.stateDirectory);
		const verifyPeer = await createLinuxPeerVerifier({
			helperPath: configuration.peerCredentialHelper,
			allowedControlUid: configuration.allowedControlUid,
			brokerUid: configuration.browserUid,
		});
		const server = await startBrokerSocketServer({
			socketPath: configuration.socketPath,
			service: new BrokerService({
				sessionFactory: new DoubaoLiveSessionFactory(configuration.stateDirectory),
				evidenceStore: new BrokerEvidenceStore({
					evidenceRoot: configuration.evidenceDirectory,
					expectedBrowserUid: configuration.browserUid,
					expectedRpcGid: configuration.rpcGid,
				}),
			}),
			verifyPeer,
			onConnectionError: () => {
				process.stderr.write(`${JSON.stringify({ status: "broker_connection_rejected" })}\n`);
			},
		});
		await waitForTerminationSignal();
		await server.close();
		return;
	}
	throw new Error(
		"Usage: browser-runner broker <serve|preflight|login-window|probe-selectors|uat-once|anonymous-uat-once|provision-dedicated-profile>",
	);
}

function waitForTerminationSignal(): Promise<void> {
	return new Promise((resolve) => {
		process.once("SIGINT", resolve);
		process.once("SIGTERM", resolve);
	});
}

main().catch((error) => {
	process.stderr.write(`${sanitizeDiagnostic(error instanceof Error ? error.message : String(error))}\n`);
	process.exitCode = 1;
});
