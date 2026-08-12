import type {
	EvidenceCapture,
	FixtureScenario,
	FixtureTask,
	RunnerTask,
	SurfaceResponse,
	SurfaceSession,
	SurfaceSessionFactory,
} from "../contracts.js";
import { BrowserRunnerError } from "../errors.js";
import { runnerSessionIdForTask } from "../session-identity.js";

const ONE_PIXEL_PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
	"base64",
);

export type FixtureCall = {
	taskId: string;
	sessionId: string;
	attempt: number;
	operation: "open" | "prepare" | "submit" | "confirm" | "collect" | "capture" | "close";
};

export class DoubaoFixtureSessionFactory implements SurfaceSessionFactory {
	readonly calls: FixtureCall[] = [];
	readonly #fixtures: Map<string, FixtureTask>;

	constructor(tasks: readonly FixtureTask[]) {
		this.#fixtures = new Map(tasks.map((task) => [task.id, task]));
	}

	async create(task: RunnerTask, attempt: number): Promise<SurfaceSession> {
		const fixture = this.#fixtures.get(task.id);
		if (!fixture)
			throw new BrowserRunnerError("fixture_missing", "session_open", "needs_human", `No fixture for ${task.id}`);
		return new DoubaoFixtureSession(fixture, attempt, this.calls);
	}
}

class DoubaoFixtureSession implements SurfaceSession {
	readonly id: string;
	readonly #task: FixtureTask;
	readonly #attempt: number;
	readonly #calls: FixtureCall[];
	#submitted = false;
	#collectCount = 0;

	constructor(task: FixtureTask, attempt: number, calls: FixtureCall[]) {
		this.#task = task;
		this.#attempt = attempt;
		this.#calls = calls;
		this.id = runnerSessionIdForTask(task);
	}

	async open(): Promise<void> {
		this.#record("open");
		const scenario = this.#scenario();
		if (scenario === "login_required") {
			throw new BrowserRunnerError("login_required", "session_open", "needs_human", "Doubao requires a login");
		}
		if (scenario === "captcha") {
			throw new BrowserRunnerError("captcha", "session_open", "needs_human", "Doubao presented a CAPTCHA");
		}
	}

	async prepare(): Promise<void> {
		this.#record("prepare");
		const scenario = this.#scenario();
		if (scenario === "page_drift") {
			throw new BrowserRunnerError("page_drift", "pre_submit", "needs_human", "Doubao fixture selectors drifted");
		}
		if (scenario === "pre_submit_transient_then_success" && this.#attempt === 1) {
			throw new BrowserRunnerError(
				"navigation_timeout",
				"pre_submit",
				"safe_pre_submit_retry",
				"Fixture navigation timed out before the prompt was submitted",
			);
		}
	}

	async submit(): Promise<void> {
		if (this.#submitted) {
			throw new BrowserRunnerError("duplicate_submit_blocked", "submit", "needs_human", "Prompt was already submitted");
		}
		this.#record("submit");
		this.#submitted = true;
		if (this.#scenario() === "submit_unknown_then_confirmed") {
			throw new BrowserRunnerError(
				"submit_confirmation_timeout",
				"submit",
				"recover_same_session",
				"The prompt may have been submitted; recover in the same fixture session",
			);
		}
	}

	async confirmSubmission(): Promise<void> {
		this.#record("confirm");
		if (!this.#submitted) {
			throw new BrowserRunnerError(
				"submission_not_visible",
				"post_submit",
				"needs_human",
				"Submitted prompt is not visible",
			);
		}
	}

	async collectResponse(): Promise<SurfaceResponse> {
		this.#record("collect");
		if (!this.#submitted)
			throw new BrowserRunnerError("not_submitted", "post_submit", "needs_human", "No prompt submitted");
		this.#collectCount += 1;
		if (this.#scenario() === "post_submit_transient_then_success" && this.#collectCount === 1) {
			throw new BrowserRunnerError(
				"response_timeout",
				"post_submit",
				"recover_same_session",
				"Fixture response was not ready yet",
			);
		}
		return {
			answerText: this.#answerText(),
			pageUrl: `https://www.doubao.com/chat/fixture-${encodeURIComponent(this.#task.id)}`,
			observedAt: new Date().toISOString(),
			modelVersion: "doubao-fixture-v1",
			citations: [],
			webQueries: [],
		};
	}

	async captureEvidence(): Promise<EvidenceCapture> {
		this.#record("capture");
		return {
			domSnapshot: [
				'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body>',
				`<main data-surface="doubao.fixture" data-task-id="${escapeHtml(this.#task.id)}">`,
				`<section data-role="answer">${escapeHtml(this.#answerText())}</section></main></body></html>`,
			].join(""),
			screenshotPng: ONE_PIXEL_PNG,
		};
	}

	async handoffMetadata() {
		return {
			sessionId: this.id,
			profileDirectory: `fixture-profile://${encodeURIComponent(this.#task.id)}`,
			lastPageUrl: `https://www.doubao.com/chat/fixture-${encodeURIComponent(this.#task.id)}`,
			fixture: true,
		};
	}

	async close(): Promise<void> {
		this.#record("close");
	}

	#scenario(): FixtureScenario {
		return this.#task.scenario ?? "success";
	}

	#answerText(): string {
		if (this.#task.fixtureAnswer) return this.#task.fixtureAnswer;
		if (this.#scenario() === "success_without_brand") {
			return "\u8fd9\u91cc\u662f\u4e00\u6761\u4e0d\u5305\u542b\u53d7\u6d4b\u54c1\u724c\u7684\u5939\u5177\u56de\u7b54\u3002";
		}
		return "\u9636\u8dc3\u661f\u8fb0\uff08StepFun\uff09\u662f\u4e00\u5bb6\u4eba\u5de5\u667a\u80fd\u516c\u53f8\u3002";
	}

	#record(operation: FixtureCall["operation"]): void {
		this.#calls.push({ taskId: this.#task.id, sessionId: this.id, attempt: this.#attempt, operation });
	}
}

function escapeHtml(value: string): string {
	return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
