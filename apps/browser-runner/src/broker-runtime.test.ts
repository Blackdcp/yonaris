import assert from "node:assert/strict";
import test from "node:test";
import { brokerRuntimeConfigurationFromEnvironment } from "./broker-runtime.js";

const safeEnvironment = {
	BROWSER_BROKER_SOCKET: "/run/yonaris-browser-broker/broker.sock",
	BROWSER_BROKER_STATE_DIR: "/var/lib/yonaris-browser-broker",
	BROWSER_BROKER_EVIDENCE_DIR: "/var/lib/yonaris-browser-broker/evidence-out",
	BROWSER_BROKER_PEERCRED_HELPER: "/opt/yonaris-browser-runner/bin/yonaris-peercred",
	BROWSER_BROKER_UID: "991",
	BROWSER_BROKER_RPC_GID: "992",
	BROWSER_BROKER_ALLOWED_CONTROL_UID: "1000",
};

test("broker runtime accepts only a separate configured browser identity", () => {
	assert.deepEqual(brokerRuntimeConfigurationFromEnvironment(safeEnvironment, 991), {
		socketPath: safeEnvironment.BROWSER_BROKER_SOCKET,
		stateDirectory: safeEnvironment.BROWSER_BROKER_STATE_DIR,
		evidenceDirectory: safeEnvironment.BROWSER_BROKER_EVIDENCE_DIR,
		peerCredentialHelper: safeEnvironment.BROWSER_BROKER_PEERCRED_HELPER,
		browserUid: 991,
		rpcGid: 992,
		allowedControlUid: 1000,
	});
	assert.throws(
		() =>
			brokerRuntimeConfigurationFromEnvironment(
				{ ...safeEnvironment, BROWSER_BROKER_ALLOWED_CONTROL_UID: safeEnvironment.BROWSER_BROKER_UID },
				991,
			),
		/separate/i,
	);
	assert.throws(() => brokerRuntimeConfigurationFromEnvironment(safeEnvironment, 1000), /service UID/i);
});

test("broker runtime rejects relative paths and forbidden inherited secrets", () => {
	assert.throws(
		() => brokerRuntimeConfigurationFromEnvironment({ ...safeEnvironment, BROWSER_BROKER_SOCKET: "broker.sock" }, 991),
		/absolute/i,
	);
	assert.throws(
		() => brokerRuntimeConfigurationFromEnvironment({ ...safeEnvironment, BROWSER_RUNNER_API_TOKEN: "secret" }, 991),
		/BROWSER_RUNNER_API_TOKEN/,
	);
});
