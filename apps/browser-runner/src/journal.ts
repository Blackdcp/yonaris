import { createHash, randomUUID } from "node:crypto";
import { appendFile, chmod, mkdir, rename, rm, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EvidenceArtifact, HandoffMetadata, RunnerJournalEvent, RunSummary } from "./contracts.js";

export class RunJournal {
	readonly runId: string;
	readonly stateDirectory: string;
	readonly runDirectory: string;
	readonly eventsPath: string;
	readonly summaryPath: string;
	#sequence = 0;

	private constructor(rootDirectory: string, runId: string) {
		this.runId = runId;
		this.stateDirectory = path.resolve(rootDirectory);
		this.runDirectory = path.resolve(this.stateDirectory, "runs", runId);
		this.eventsPath = path.join(this.runDirectory, "journal.jsonl");
		this.summaryPath = path.join(this.runDirectory, "summary.json");
	}

	static async create(
		rootDirectory: string,
		runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`,
	) {
		const journal = new RunJournal(rootDirectory, runId);
		const runsDirectory = path.join(journal.stateDirectory, "runs");
		await mkdir(journal.stateDirectory, { recursive: true, mode: 0o700 });
		await chmod(journal.stateDirectory, 0o700);
		await mkdir(runsDirectory, { recursive: true, mode: 0o700 });
		await chmod(runsDirectory, 0o700);
		await mkdir(journal.runDirectory, { recursive: true, mode: 0o700 });
		await chmod(journal.runDirectory, 0o700);
		return journal;
	}

	async append(event: Omit<RunnerJournalEvent, "sequence" | "at" | "runId">): Promise<RunnerJournalEvent> {
		const fullEvent: RunnerJournalEvent = {
			sequence: ++this.#sequence,
			at: new Date().toISOString(),
			runId: this.runId,
			...event,
		};
		await appendFile(this.eventsPath, `${JSON.stringify(fullEvent)}\n`, {
			encoding: "utf8",
			flag: "a",
			mode: 0o600,
		});
		await chmod(this.eventsPath, 0o600);
		return fullEvent;
	}

	async writeSummary(summary: RunSummary): Promise<void> {
		const temporaryPath = `${this.summaryPath}.${randomUUID()}.tmp`;
		const privateSummary = {
			...summary,
			results: summary.results.map((result) => ({
				taskId: result.taskId,
				status: result.status,
				...(result.status === "needs_human" ||
				result.status === "retry_queued" ||
				result.status === "persistence_failed"
					? { code: result.code, phase: result.phase }
					: {}),
			})),
		};
		await writeFile(temporaryPath, `${JSON.stringify(privateSummary, null, 2)}\n`, {
			encoding: "utf8",
			flag: "wx",
			mode: 0o600,
		});
		await rename(temporaryPath, this.summaryPath);
		await chmod(this.summaryPath, 0o600);
	}

	async removeUploadedEvidence(evidence: readonly EvidenceArtifact[]): Promise<void> {
		const evidenceRoot = path.resolve(this.runDirectory, "evidence");
		const attemptDirectories = new Set<string>();
		for (const artifact of evidence) {
			const artifactPath = path.resolve(artifact.path);
			assertChild(evidenceRoot, artifactPath);
			attemptDirectories.add(path.dirname(artifactPath));
		}
		for (const attemptDirectory of attemptDirectories) {
			assertChild(evidenceRoot, attemptDirectory);
			await rm(attemptDirectory, { recursive: true, force: true });
			const taskDirectory = path.dirname(attemptDirectory);
			assertChild(evidenceRoot, taskDirectory);
			try {
				// rmdir is intentionally used here: it removes only an empty directory atomically,
				// so a concurrent attempt can never be deleted by cleanup from an earlier attempt.
				await rmdir(taskDirectory);
			} catch (error) {
				const code = (error as NodeJS.ErrnoException).code;
				if (code !== "ENOENT" && code !== "ENOTEMPTY" && code !== "EEXIST") throw error;
			}
		}
	}

	async writeHandoff(metadata: HandoffMetadata): Promise<string> {
		const handoffDirectory = path.join(this.stateDirectory, "handoffs");
		await mkdir(handoffDirectory, { recursive: true, mode: 0o700 });
		await chmod(handoffDirectory, 0o700);
		const outputPath = path.join(handoffDirectory, `${safeName(metadata.taskId)}.json`);
		const temporaryPath = `${outputPath}.${randomUUID()}.tmp`;
		await writeFile(temporaryPath, `${JSON.stringify(metadata, null, 2)}\n`, {
			encoding: "utf8",
			flag: "wx",
			mode: 0o600,
		});
		await rename(temporaryPath, outputPath);
		await chmod(outputPath, 0o600);
		return outputPath;
	}

	async removeHandoff(taskId: string): Promise<void> {
		const handoffDirectory = path.resolve(this.stateDirectory, "handoffs");
		const outputPath = path.resolve(handoffDirectory, `${safeName(taskId)}.json`);
		assertChild(handoffDirectory, outputPath);
		await rm(outputPath, { force: true });
	}
}

function safeName(value: string): string {
	const readable = value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "task";
	return `${readable}-${createHash("sha256").update(value).digest("hex").slice(0, 16)}`;
}

function assertChild(rootDirectory: string, childDirectory: string): void {
	const relative = path.relative(path.resolve(rootDirectory), path.resolve(childDirectory));
	if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
		throw new Error("Runner artifact path escaped its configured root");
	}
}
