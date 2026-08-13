import assert from "node:assert/strict";
import { createServer, type Socket } from "node:net";
import path from "node:path";
import test from "node:test";
import {
	BrokeredSurfaceSessionFactory,
	type BrokerTransport,
	brokeredFactoryOptionsFromEnvironment,
	UnixSocketBrokerTransport,
} from "./broker-client.js";
import type { BrokerEvidenceDescriptor, BrokerRequest, BrokerSuccessResult } from "./broker-protocol.js";
import type { RunnerTask } from "./contracts.js";

const task: RunnerTask = {
	id: "task-1",
	batchId: "batch-1",
	brandId: "stepfun",
	promptText: "阶跃星辰 StepFun 是一家什么公司？",
	surfaceTargetKey: "doubao.consumer_web",
	captureRouteKey: "browser_runner.doubao",
	sampleIndex: 1,
	sessionRequirement: "dedicated_sampling_profile",
	searchRequirement: "platform_default",
	evaluationRole: "scored",
	minimumEvidenceArtifacts: 2,
	automationAttemptCount: 1,
	leaseGeneration: 2,
};

test("brokered session sends only the frozen browser contract and never accepts a changed prompt", async () => {
	const transport = new ScriptedTransport();
	const factory = new BrokeredSurfaceSessionFactory(clientOptions(transport));
	const session = await factory.create(task, 1);
	await session.open(task);
	await session.prepare(task);
	await assert.rejects(() => session.submit("changed prompt"), /frozen prompt/i);
	await session.submit(task.promptText);

	assert.deepEqual(
		transport.requests.map(({ operation }) => operation),
		["create", "open", "prepare", "submit"],
	);
	const create = transport.requests[0];
	assert.equal(create?.operation, "create");
	if (create?.operation !== "create") throw new Error("Expected create request");
	assert.deepEqual(create.task, task);
	assert.equal("leaseToken" in create, false);
	assert.equal("apiToken" in create, false);
});

test("brokered capture returns bounded verified bytes and acknowledges only those artifacts", async () => {
	const transport = new ScriptedTransport();
	const page = Buffer.from("<html>evidence</html>");
	const screenshot = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
	transport.captureEvidence = [
		descriptor("page-1", "page_snapshot", "/private/page.html", page),
		descriptor("png-1", "screenshot", "/private/page.png", screenshot),
	];
	const reads: string[] = [];
	const factory = new BrokeredSurfaceSessionFactory({
		...clientOptions(transport),
		evidenceReader: async (item) => {
			reads.push(item.artifactId);
			return item.kind === "page_snapshot" ? page : screenshot;
		},
	});
	const session = await factory.create(task, 1);
	const capture = await session.captureEvidence();

	assert.equal(capture.domSnapshot, page.toString("utf8"));
	assert.deepEqual(Buffer.from(capture.screenshotPng), screenshot);
	assert.deepEqual(reads, ["page-1", "png-1"]);
	const release = transport.requests.at(-1);
	assert.equal(release?.operation, "release_evidence");
	if (release?.operation !== "release_evidence") throw new Error("Expected evidence release");
	assert.deepEqual(release.artifactIds, ["page-1", "png-1"]);
});

test("brokered capture retains handoff files when secure reading fails", async () => {
	const transport = new ScriptedTransport();
	const content = Buffer.from("evidence");
	transport.captureEvidence = [
		descriptor("page-1", "page_snapshot", "/private/page.html", content),
		descriptor("png-1", "screenshot", "/private/page.png", content),
	];
	const factory = new BrokeredSurfaceSessionFactory({
		...clientOptions(transport),
		evidenceReader: async () => {
			throw new Error("unsafe file owner");
		},
	});
	const session = await factory.create(task, 1);
	await assert.rejects(() => session.captureEvidence(), /unsafe file owner/);
	assert.equal(
		transport.requests.some(({ operation }) => operation === "release_evidence"),
		false,
	);
});

test("brokered close reaches the broker once and is locally idempotent", async () => {
	const transport = new ScriptedTransport();
	const session = await new BrokeredSurfaceSessionFactory(clientOptions(transport)).create(task, 1);
	await session.close("succeeded");
	await session.close("succeeded");
	assert.equal(transport.requests.filter(({ operation }) => operation === "close").length, 1);
});

test("Unix broker transport enforces a bounded response timeout", async (context) => {
	const socketPath =
		process.platform === "win32"
			? `\\\\.\\pipe\\yonaris-broker-timeout-${process.pid}-${Date.now()}`
			: path.join(process.env.TMPDIR ?? "/tmp", `yonaris-broker-timeout-${process.pid}-${Date.now()}.sock`);
	const connections = new Set<Socket>();
	const server = createServer((socket) => {
		connections.add(socket);
		socket.once("close", () => connections.delete(socket));
	});
	await new Promise<void>((resolve, reject) => server.listen(socketPath, resolve).once("error", reject));
	context.after(() => {
		for (const socket of connections) socket.destroy();
		return new Promise<void>((resolve) => server.close(() => resolve()));
	});

	const transport = new UnixSocketBrokerTransport(socketPath);
	await assert.rejects(
		() => transport.request({ version: 1, requestId: "timeout-1", operation: "ping" }, 25),
		(error: unknown) =>
			error instanceof Error && error.name === "BrokerTransportError" && /timed out/i.test(error.message),
	);
});

test("control-side broker configuration refuses the browser service UID", () => {
	const environment = {
		BROWSER_BROKER_SOCKET: "/run/yonaris-browser-broker/broker.sock",
		BROWSER_BROKER_EVIDENCE_DIR: "/var/lib/yonaris-browser-broker/evidence-out",
		BROWSER_BROKER_UID: "991",
		BROWSER_BROKER_RPC_GID: "992",
	};
	assert.equal(brokeredFactoryOptionsFromEnvironment(environment, 1000).expectedBrowserUid, 991);
	assert.throws(() => brokeredFactoryOptionsFromEnvironment(environment, 991), /separate/i);
});

class ScriptedTransport implements BrokerTransport {
	readonly requests: BrokerRequest[] = [];
	captureEvidence: BrokerEvidenceDescriptor[] = [];

	async request(request: BrokerRequest): Promise<BrokerSuccessResult> {
		this.requests.push(request);
		switch (request.operation) {
			case "create":
			case "resume":
				return { kind: "session", sessionId: "session-1" };
			case "capture":
				return { kind: "evidence", evidence: this.captureEvidence };
			case "handoff":
				return {
					kind: "handoff",
					metadata: {
						sessionId: "session-1",
						profileDirectory: "/private/profile",
						lastPageUrl: "https://www.doubao.com/chat/1",
						fixture: false,
					},
				};
			case "collect":
				return {
					kind: "response",
					response: {
						answerText: "answer",
						pageUrl: "https://www.doubao.com/chat/1",
						observedAt: "2026-08-13T00:00:00.000Z",
						citations: [],
						webQueries: [],
						webSearchObserved: null,
					},
				};
			default:
				return { kind: "ack" };
		}
	}
}

function clientOptions(transport: BrokerTransport) {
	return {
		socketPath: "/run/yonaris-browser-broker/broker.sock",
		evidenceRoot: "/var/lib/yonaris-browser-broker/evidence-out",
		expectedBrowserUid: 991,
		expectedRpcGid: 992,
		transport,
		evidenceReader: async () => Buffer.from("unused"),
	};
}

function descriptor(
	artifactId: string,
	kind: "page_snapshot" | "screenshot",
	filePath: string,
	content: Buffer,
): BrokerEvidenceDescriptor {
	return {
		artifactId,
		kind,
		path: filePath,
		mediaType: kind === "page_snapshot" ? "text/html" : "image/png",
		sha256: "a".repeat(64),
		bytes: content.byteLength,
	};
}
