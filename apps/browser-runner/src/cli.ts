import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { DoubaoFixtureSessionFactory } from "./adapters/doubao-fixture.js";
import { resumePostSubmitTask } from "./assist.js";
import { BrokeredSurfaceSessionFactory, brokeredFactoryOptionsFromEnvironment } from "./broker-client.js";
import type { HandoffMetadata } from "./contracts.js";
import { sanitizeDiagnostic } from "./errors.js";
import { readFixtureTasks } from "./fixture-file.js";
import { RunJournal } from "./journal.js";
import { pollStartedBatches } from "./poll.js";
import { publicSummary } from "./public-summary.js";
import { BrowserRunnerRemoteClient } from "./remote-client.js";
import { cleanupExpiredRunnerState } from "./retention.js";
import { runBatch } from "./run-batch.js";
import { LocalObservationSink } from "./sink.js";
import { FixtureTaskSource } from "./task-source.js";

const DEFAULT_STATE_DIRECTORY = defaultStateDirectory();

async function main(): Promise<void> {
	const rawArguments = process.argv.slice(2);
	if (rawArguments[0] === "--") rawArguments.shift();
	const [command, ...arguments_] = rawArguments;
	if (command === "run") return runCommand(arguments_);
	if (command === "poll") return pollCommand(arguments_);
	if (command === "assist") return assistCommand(arguments_);
	throw new Error(usage());
}

async function runCommand(arguments_: string[]): Promise<void> {
	const flags = parseFlags(arguments_);
	const stateDirectory = absoluteStateDirectory(flags);
	await cleanupExpiredRunnerState(stateDirectory);
	if (flags.fixture === true) throw new Error("--fixture requires a JSON file path");
	const fixturePath = typeof flags.fixture === "string" ? flags.fixture : undefined;
	const live = flags.live === true;
	if (fixturePath && live) throw new Error("Choose either --fixture <file> or --live, not both");
	if (!fixturePath && !live) throw new Error("Fixture mode is the default safety boundary; pass --fixture <file>");

	const journal = await RunJournal.create(stateDirectory);
	if (fixturePath) {
		const tasks = await readFixtureTasks(path.resolve(fixturePath));
		const source = new FixtureTaskSource(tasks);
		const summary = await runBatch({
			taskSource: source,
			sessionFactory: new DoubaoFixtureSessionFactory(tasks),
			journal,
			sink: new LocalObservationSink(journal.runDirectory),
			batchId: typeof flags["batch-id"] === "string" ? flags["batch-id"] : undefined,
		});
		process.stdout.write(`${JSON.stringify(publicSummary(summary), null, 2)}\n`);
		return;
	}

	assertLiveEnabled(flags);
	const batchId = requiredString(flags, "batch-id");
	const remote = createRemoteClient(flags, batchId);
	const summary = await runBatch({
		taskSource: remote,
		sessionFactory: liveSessionFactory(),
		journal,
		sink: remote,
		batchId,
	});
	process.stdout.write(`${JSON.stringify(publicSummary(summary), null, 2)}\n`);
}

async function pollCommand(arguments_: string[]): Promise<void> {
	const flags = parseFlags(arguments_);
	const stateDirectory = absoluteStateDirectory(flags);
	await cleanupExpiredRunnerState(stateDirectory);
	assertLiveEnabled(flags);
	const remote = createRemoteClient(flags);
	const abortController = new AbortController();
	process.once("SIGINT", () => abortController.abort());
	process.once("SIGTERM", () => abortController.abort());
	await pollStartedBatches({
		signal: abortController.signal,
		maintenance: () => cleanupExpiredRunnerState(stateDirectory).then(() => undefined),
		onMaintenanceError: (error) => {
			process.stderr.write(`${JSON.stringify({ status: "maintenance_failed", code: error.code })}\n`);
		},
		createOptions: async () => {
			const journal = await RunJournal.create(stateDirectory);
			return {
				taskSource: remote,
				sessionFactory: liveSessionFactory(),
				journal,
				sink: remote,
			};
		},
		onRunCompleted: (summary) => {
			process.stdout.write(`${JSON.stringify(publicSummary(summary))}\n`);
		},
		onRunError: (error) => {
			process.stderr.write(`${JSON.stringify({ status: "incomplete", code: error.code })}\n`);
		},
	});
}

async function assistCommand(arguments_: string[]): Promise<void> {
	const flags = parseFlags(arguments_);
	const taskId = requiredString(flags, "task-id");
	const stateDirectory = absoluteStateDirectory(flags);
	await cleanupExpiredRunnerState(stateDirectory);
	const handoffPath = path.join(stateDirectory, "handoffs", `${safeName(taskId)}.json`);
	const handoff = JSON.parse(await readFile(handoffPath, "utf8")) as HandoffMetadata;
	if (handoff.taskId !== taskId || handoff.surface !== "doubao" || handoff.fixture || !handoff.profileDirectory) {
		throw new Error("Task does not have a live Doubao handoff profile");
	}
	if (handoff.code === "login_required" && handoff.sessionRequirement === "anonymous_clean") {
		throw new Error(
			"This anonymous-clean task reached a login wall. Logging in would invalidate the frozen protocol; record the task as needs-human/final failure instead.",
		);
	}
	assertLiveEnabled({ live: true, surface: "doubao" });
	const remote = createRemoteClient(flags);
	const journal = await RunJournal.create(stateDirectory);
	await resumePostSubmitTask({
		handoff,
		remote,
		sessionFactory: liveSessionFactory(),
		journal,
	});
	process.stdout.write(`${JSON.stringify({ taskId, status: "completed" })}\n`);
}

function assertLiveEnabled(flags: Record<string, string | boolean>): void {
	if (flags.live !== true) throw new Error("Live mode requires --live");
	if (flags.surface !== "doubao") throw new Error("Live mode requires --surface doubao");
	if (process.env.BROWSER_RUNNER_LIVE_ENABLED !== "true") {
		throw new Error("Live mode is disabled; set BROWSER_RUNNER_LIVE_ENABLED=true on the runner host");
	}
	if (!process.env.BROWSER_RUNNER_API_TOKEN) {
		throw new Error("BROWSER_RUNNER_API_TOKEN is required for live task claiming");
	}
	brokeredFactoryOptionsFromEnvironment();
	if (process.env.BROWSER_RUNNER_DOUBAO_ADAPTER_VERIFIED !== "true") {
		throw new Error("Live Doubao execution requires BROWSER_RUNNER_DOUBAO_ADAPTER_VERIFIED=true after selector UAT");
	}
}

function liveSessionFactory(): BrokeredSurfaceSessionFactory {
	return new BrokeredSurfaceSessionFactory(brokeredFactoryOptionsFromEnvironment());
}

function createRemoteClient(flags: Record<string, string | boolean>, batchId?: string) {
	return new BrowserRunnerRemoteClient({
		baseUrl: process.env.BROWSER_RUNNER_API_URL ?? "",
		apiToken: process.env.BROWSER_RUNNER_API_TOKEN ?? "",
		brandId: requiredString(flags, "brand-id"),
		adapterVersion: requiredAdapterVersion(),
		...(batchId ? { batchId } : {}),
	});
}

function requiredAdapterVersion(): string {
	const fingerprint = process.env.BROWSER_RUNNER_DOUBAO_DOM_FINGERPRINT?.trim();
	if (!fingerprint || !/^[A-Za-z0-9._:-]{8,100}$/.test(fingerprint)) {
		throw new Error("BROWSER_RUNNER_DOUBAO_DOM_FINGERPRINT must identify the approved selector contract");
	}
	return `doubao-browser-v1:${fingerprint}`;
}

function absoluteStateDirectory(flags: Record<string, string | boolean>): string {
	const configured = typeof flags["state-dir"] === "string" ? flags["state-dir"] : DEFAULT_STATE_DIRECTORY;
	return path.resolve(configured);
}

function parseFlags(values: string[]): Record<string, string | boolean> {
	const flags: Record<string, string | boolean> = {};
	for (let index = 0; index < values.length; index += 1) {
		const token = values[index];
		if (!token?.startsWith("--")) throw new Error(`Unexpected argument ${token ?? ""}`);
		const key = token.slice(2);
		const next = values[index + 1];
		if (next && !next.startsWith("--")) {
			flags[key] = next;
			index += 1;
		} else {
			flags[key] = true;
		}
	}
	return flags;
}

function requiredString(flags: Record<string, string | boolean>, key: string): string {
	const value = flags[key];
	if (typeof value !== "string" || !value.trim()) throw new Error(`--${key} is required`);
	return value.trim();
}

function safeName(value: string): string {
	const readable = value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "task";
	return `${readable}-${createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
}

function usage(): string {
	return [
		"Usage:",
		"  browser-runner run --fixture <tasks.json> [--batch-id <id>] [--state-dir <dir>]",
		"  browser-runner run --live --surface doubao --brand-id <id> --batch-id <id> [--state-dir <dir>]",
		"  browser-runner poll --live --surface doubao --brand-id <id> [--state-dir <dir>]",
		"  browser-runner assist --brand-id <id> --task-id <id> [--state-dir <dir>]",
		"  Browser-only service commands are provided by: browser-runner broker <serve|preflight|provision-dedicated-profile>",
	].join("\n");
}

function defaultStateDirectory(): string {
	if (process.platform === "win32") {
		return path.join(process.env.LOCALAPPDATA || path.join(homedir(), "AppData", "Local"), "Yonaris", "BrowserRunner");
	}
	if (process.platform === "darwin") {
		return path.join(homedir(), "Library", "Application Support", "Yonaris", "BrowserRunner");
	}
	return path.join(process.env.XDG_DATA_HOME || path.join(homedir(), ".local", "share"), "yonaris-browser-runner");
}

main().catch((error) => {
	process.stderr.write(`${sanitizeDiagnostic(error instanceof Error ? error.message : String(error))}\n`);
	process.exitCode = 1;
});
