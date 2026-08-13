import path from "node:path";
import { assertBrokerEnvironmentSafe } from "./broker-server.js";

export type BrokerRuntimeConfiguration = {
	socketPath: string;
	stateDirectory: string;
	evidenceDirectory: string;
	peerCredentialHelper: string;
	browserUid: number;
	rpcGid: number;
	allowedControlUid: number;
};

export function brokerRuntimeConfigurationFromEnvironment(
	environment: NodeJS.ProcessEnv | Record<string, string | undefined>,
	currentUid = process.getuid?.(),
): BrokerRuntimeConfiguration {
	assertBrokerEnvironmentSafe(environment);
	if (currentUid === undefined) throw new Error("Browser broker requires a Linux service UID");
	const configuration = {
		socketPath: absoluteEnvironmentPath(environment, "BROWSER_BROKER_SOCKET"),
		stateDirectory: absoluteEnvironmentPath(environment, "BROWSER_BROKER_STATE_DIR"),
		evidenceDirectory: absoluteEnvironmentPath(environment, "BROWSER_BROKER_EVIDENCE_DIR"),
		peerCredentialHelper: absoluteEnvironmentPath(environment, "BROWSER_BROKER_PEERCRED_HELPER"),
		browserUid: positiveEnvironmentInteger(environment, "BROWSER_BROKER_UID"),
		rpcGid: positiveEnvironmentInteger(environment, "BROWSER_BROKER_RPC_GID"),
		allowedControlUid: positiveEnvironmentInteger(environment, "BROWSER_BROKER_ALLOWED_CONTROL_UID"),
	};
	if (configuration.browserUid !== currentUid) {
		throw new Error("Browser broker process does not match BROWSER_BROKER_UID service UID");
	}
	if (configuration.browserUid === configuration.allowedControlUid) {
		throw new Error("Browser broker and control process require separate UIDs");
	}
	return configuration;
}

function absoluteEnvironmentPath(
	environment: NodeJS.ProcessEnv | Record<string, string | undefined>,
	name: string,
): string {
	const value = environment[name]?.trim();
	if (!value || value.includes("\0") || !path.posix.isAbsolute(value))
		throw new Error(`${name} must be an absolute path`);
	return path.posix.normalize(value);
}

function positiveEnvironmentInteger(
	environment: NodeJS.ProcessEnv | Record<string, string | undefined>,
	name: string,
): number {
	const value = environment[name]?.trim();
	if (!value || !/^\d+$/.test(value)) throw new Error(`${name} must be a positive integer`);
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
	return parsed;
}
