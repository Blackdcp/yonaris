import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { UnixSocketBrokerTransport } from "./broker-client.js";
import {
	type BrokerRequest,
	type BrokerResponse,
	type BrokerSuccessResult,
	encodeBrokerFrame,
} from "./broker-protocol.js";
import { BrokerService } from "./broker-server.js";
import { assertPeerCredentialGate, startBrokerSocketServer } from "./broker-socket.js";
import { FakeEvidenceStore, FakeSessionFactory } from "./broker-test-doubles.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

test("peer credential gate requires Linux, a separate control UID, and a root-owned immutable helper", () => {
	const safeHelper = {
		isFile: () => true,
		isSymbolicLink: () => false,
		uid: 0,
		mode: 0o100755,
		nlink: 1,
	};
	assert.doesNotThrow(() =>
		assertPeerCredentialGate({ platform: "linux", brokerUid: 991, allowedControlUid: 1000, helperStat: safeHelper }),
	);
	assert.throws(
		() =>
			assertPeerCredentialGate({ platform: "win32", brokerUid: 991, allowedControlUid: 1000, helperStat: safeHelper }),
		/Linux/i,
	);
	assert.throws(
		() =>
			assertPeerCredentialGate({ platform: "linux", brokerUid: 1000, allowedControlUid: 1000, helperStat: safeHelper }),
		/separate/i,
	);
	assert.throws(
		() =>
			assertPeerCredentialGate({
				platform: "linux",
				brokerUid: 991,
				allowedControlUid: 1000,
				helperStat: { ...safeHelper, uid: 991, mode: 0o100775 },
			}),
		/root-owned|writable/i,
	);
});

test("socket server verifies peer identity before parsing any broker request", async (context) => {
	const socketPath = await testSocketPath("unauthorized");
	let checks = 0;
	const server = await startBrokerSocketServer({
		socketPath,
		service: new BrokerService({ sessionFactory: new FakeSessionFactory(), evidenceStore: new FakeEvidenceStore() }),
		verifyPeer: async () => {
			checks += 1;
			throw new Error("unauthorized peer");
		},
	});
	context.after(() => server.close());
	await assert.rejects(
		() =>
			new UnixSocketBrokerTransport(socketPath).request(
				{ version: 1, requestId: "request-1", operation: "ping" },
				1_000,
			),
		/Broker connection failed|truncated/i,
	);
	assert.equal(checks, 1);
});

test("authorized peer receives one versioned response over the private socket", async (context) => {
	const socketPath = await testSocketPath("authorized");
	const connectionErrors: unknown[] = [];
	const server = await startBrokerSocketServer({
		socketPath,
		service: new BrokerService({ sessionFactory: new FakeSessionFactory(), evidenceStore: new FakeEvidenceStore() }),
		verifyPeer: async () => undefined,
		onConnectionError: (error) => connectionErrors.push(error),
	});
	context.after(() => server.close());
	let result: BrokerSuccessResult | undefined;
	try {
		result = await new UnixSocketBrokerTransport(socketPath).request(
			{ version: 1, requestId: "request-2", operation: "ping" },
			1_000,
		);
	} catch (error) {
		assert.fail(
			`transport=${error instanceof Error ? error.message : String(error)} server=${connectionErrors
				.map((item) => (item instanceof Error ? item.message : String(item)))
				.join("|")}`,
		);
	}
	assert.deepEqual(result, { kind: "pong" });
	assert.deepEqual(connectionErrors, []);
});

test("a control client disconnect during response delivery does not crash the broker", async (context) => {
	const socketPath = await testSocketPath("disconnect");
	let releaseResponse: (() => void) | undefined;
	const responseGate = new Promise<void>((resolve) => {
		releaseResponse = resolve;
	});
	const connectionErrors: unknown[] = [];
	const service = {
		async handle(request: BrokerRequest): Promise<BrokerResponse> {
			await responseGate;
			return { version: 1, requestId: request.requestId, ok: true, result: { kind: "pong" } };
		},
	} as BrokerService;
	const server = await startBrokerSocketServer({
		socketPath,
		service,
		verifyPeer: async () => undefined,
		onConnectionError: (error) => connectionErrors.push(error),
	});
	context.after(() => server.close());

	const client = createConnection(socketPath);
	await new Promise<void>((resolve, reject) => {
		client.once("connect", resolve);
		client.once("error", reject);
	});
	await new Promise<void>((resolve, reject) => {
		client.write(
			encodeBrokerFrame({ version: 1, requestId: "request-disconnect", operation: "ping" }, 1_000),
			(error) => (error ? reject(error) : resolve()),
		);
	});
	client.destroy();
	releaseResponse?.();
	await new Promise((resolve) => setTimeout(resolve, 25));

	assert.ok(connectionErrors.length <= 1);
	const result = await new UnixSocketBrokerTransport(socketPath).request(
		{ version: 1, requestId: "request-after-disconnect", operation: "ping" },
		1_000,
	);
	assert.deepEqual(result, { kind: "pong" });
});

async function testSocketPath(name: string): Promise<string> {
	if (process.platform === "win32") return `\\\\.\\pipe\\yonaris-${name}-${process.pid}-${Date.now()}`;
	const directory = await mkdtemp(path.join(tmpdir(), `yonaris-${name}-`));
	temporaryDirectories.push(directory);
	return path.join(directory, "broker.sock");
}
