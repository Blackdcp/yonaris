import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import {
	assertBrokerEnvironmentSafe,
	BrokerEvidenceStore,
	BrokerService,
	type BrokerSessionFactory,
} from "./broker-server.js";
import type {
	EvidenceCapture,
	RunnerTask,
	SurfaceResponse,
	SurfaceSession,
	SurfaceSessionFactory,
} from "./contracts.js";
import { BrowserRunnerError } from "./errors.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const task: RunnerTask = {
	id: "task-1",
	batchId: "batch-1",
	brandId: "stepfun",
	promptText: "国内有哪些主流大模型公司？",
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

test("browser broker refuses to start with control-plane or database secrets", () => {
	for (const name of [
		"BROWSER_RUNNER_API_TOKEN",
		"DATABASE_URL",
		"ADMIN_API_KEYS",
		"BETTER_AUTH_SECRET",
		"CREDENTIAL_ENCRYPTION_KEY",
	]) {
		assert.throws(() => assertBrokerEnvironmentSafe({ [name]: "secret" }), new RegExp(name));
	}
	assert.doesNotThrow(() =>
		assertBrokerEnvironmentSafe({
			BROWSER_RUNNER_DOUBAO_ANSWER_SELECTOR: "[data-answer]",
			PLAYWRIGHT_BROWSERS_PATH: "/opt/yonaris-browser-runner/ms-playwright",
		}),
	);
});

test("broker enforces prepare before submit and never submits a frozen prompt twice", async () => {
	const factory = new FakeSessionFactory();
	const service = new BrokerService({ sessionFactory: factory, evidenceStore: new FakeEvidenceStore() });
	const created = await service.handle({ version: 1, requestId: "create", operation: "create", task, attempt: 1 });
	assert.equal(created.ok, true);

	const premature = await service.handle({
		version: 1,
		requestId: "premature",
		operation: "submit",
		sessionId: "session-1",
		promptText: task.promptText,
	});
	assert.equal(premature.ok, false);
	if (premature.ok) throw new Error("Expected premature submit rejection");
	assert.equal(premature.error.code, "broker_sequence_violation");

	await service.handle({ version: 1, requestId: "open", operation: "open", sessionId: "session-1" });
	await service.handle({ version: 1, requestId: "prepare", operation: "prepare", sessionId: "session-1" });
	const first = await service.handle({
		version: 1,
		requestId: "submit-1",
		operation: "submit",
		sessionId: "session-1",
		promptText: task.promptText,
	});
	assert.equal(first.ok, true);
	const second = await service.handle({
		version: 1,
		requestId: "submit-2",
		operation: "submit",
		sessionId: "session-1",
		promptText: task.promptText,
	});
	assert.equal(second.ok, false);
	if (second.ok) throw new Error("Expected duplicate submit rejection");
	assert.equal(second.error.code, "broker_duplicate_submit");
	assert.equal(factory.session.calls.filter((value) => value === "submit").length, 1);
});

test("broker serializes concurrent creates around the one dedicated profile", async () => {
	const factory = new FakeSessionFactory();
	const service = new BrokerService({ sessionFactory: factory, evidenceStore: new FakeEvidenceStore() });
	const [first, second] = await Promise.all([
		service.handle({ version: 1, requestId: "create-1", operation: "create", task, attempt: 1 }),
		service.handle({ version: 1, requestId: "create-2", operation: "create", task, attempt: 1 }),
	]);
	assert.equal(first.ok, true);
	assert.equal(second.ok, true);
	assert.equal(factory.createCalls, 1);
});

test("broker caches collected response so recovery cannot create another browser action", async () => {
	const factory = new FakeSessionFactory();
	const service = new BrokerService({ sessionFactory: factory, evidenceStore: new FakeEvidenceStore() });
	await readySubmittedSession(service);
	const first = await service.handle({
		version: 1,
		requestId: "collect-1",
		operation: "collect",
		sessionId: "session-1",
	});
	const second = await service.handle({
		version: 1,
		requestId: "collect-2",
		operation: "collect",
		sessionId: "session-1",
	});
	assert.equal(first.ok, true);
	assert.deepEqual(second.ok && second.result, first.ok && first.result);
	assert.equal(factory.session.calls.filter((value) => value === "collect").length, 1);
});

test("broker preserves classified browser errors without exposing a stack", async () => {
	const factory = new FakeSessionFactory();
	factory.session.prepareError = new BrowserRunnerError(
		"dedicated_profile_not_authenticated",
		"pre_submit",
		"needs_human",
		"Dedicated profile needs a human",
	);
	const service = new BrokerService({ sessionFactory: factory, evidenceStore: new FakeEvidenceStore() });
	await service.handle({ version: 1, requestId: "create", operation: "create", task, attempt: 1 });
	await service.handle({ version: 1, requestId: "open", operation: "open", sessionId: "session-1" });
	const response = await service.handle({
		version: 1,
		requestId: "prepare",
		operation: "prepare",
		sessionId: "session-1",
	});
	assert.equal(response.ok, false);
	if (response.ok) throw new Error("Expected classified broker error");
	assert.deepEqual(response.error, {
		code: "dedicated_profile_not_authenticated",
		phase: "pre_submit",
		disposition: "needs_human",
		message: "Dedicated profile needs a human",
	});
});

test("broker evidence store atomically seals two bounded 0640 files", {
	skip: process.platform === "win32",
}, async () => {
	const root = await temporaryDirectory();
	await chmod(root, 0o750);
	const rootStat = await stat(root);
	const store = new BrokerEvidenceStore({
		evidenceRoot: root,
		expectedBrowserUid: rootStat.uid,
		expectedRpcGid: rootStat.gid,
	});
	const descriptors = await store.capture("session-1", {
		domSnapshot: "<html>answer</html>",
		screenshotPng: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
	});
	assert.deepEqual(descriptors.map(({ kind }) => kind).sort(), ["page_snapshot", "screenshot"]);
	for (const descriptor of descriptors) {
		const fileStat = await stat(descriptor.path);
		assert.equal(fileStat.mode & 0o777, 0o640);
		assert.equal(fileStat.nlink, 1);
		assert.equal(path.dirname(descriptor.path), root);
	}
	await store.release(
		"session-1",
		descriptors.map(({ artifactId }) => artifactId),
	);
	const firstDescriptor = descriptors[0];
	assert.ok(firstDescriptor);
	await assert.rejects(() => stat(firstDescriptor.path), /ENOENT/);
});

async function readySubmittedSession(service: BrokerService): Promise<void> {
	await service.handle({ version: 1, requestId: "create", operation: "create", task, attempt: 1 });
	await service.handle({ version: 1, requestId: "open", operation: "open", sessionId: "session-1" });
	await service.handle({ version: 1, requestId: "prepare", operation: "prepare", sessionId: "session-1" });
	await service.handle({
		version: 1,
		requestId: "submit",
		operation: "submit",
		sessionId: "session-1",
		promptText: task.promptText,
	});
}

class FakeSessionFactory implements BrokerSessionFactory, SurfaceSessionFactory {
	readonly session = new FakeSession();
	createCalls = 0;
	async create(): Promise<SurfaceSession> {
		this.createCalls += 1;
		return this.session;
	}
	async resume(): Promise<SurfaceSession> {
		return this.session;
	}
}

class FakeSession implements SurfaceSession {
	readonly id = "session-1";
	readonly calls: string[] = [];
	prepareError?: Error;
	async open(): Promise<void> {
		this.calls.push("open");
	}
	async prepare(): Promise<void> {
		this.calls.push("prepare");
		if (this.prepareError) throw this.prepareError;
	}
	async submit(): Promise<void> {
		this.calls.push("submit");
	}
	async confirmSubmission(): Promise<void> {
		this.calls.push("confirm");
	}
	async collectResponse(): Promise<SurfaceResponse> {
		this.calls.push("collect");
		return {
			answerText: "StepFun answer",
			answerHtml: "<section>StepFun answer</section>",
			pageUrl: "https://www.doubao.com/chat/1",
			observedAt: "2026-08-13T00:00:00.000Z",
			citations: [],
			webQueries: [],
			webSearchObserved: null,
		};
	}
	async captureEvidence(): Promise<EvidenceCapture> {
		this.calls.push("capture");
		return { domSnapshot: "<html></html>", screenshotPng: Buffer.from("png") };
	}
	async handoffMetadata() {
		return {
			sessionId: this.id,
			profileDirectory: "/private/profile",
			lastPageUrl: "https://www.doubao.com/chat/1",
			fixture: false as const,
		};
	}
	async close(): Promise<void> {
		this.calls.push("close");
	}
}

class FakeEvidenceStore {
	async capture(): Promise<never> {
		throw new Error("capture not expected");
	}
	async release(): Promise<void> {}
}

async function temporaryDirectory(): Promise<string> {
	const directory = await mkdtemp(path.join(tmpdir(), "yonaris-broker-store-"));
	temporaryDirectories.push(directory);
	return directory;
}
