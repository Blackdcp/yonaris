import { createHash } from "node:crypto";
import { chmod, lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BrowserContext, Page } from "playwright";
import { assertExactlyOneNewAnswer, validateAnswerContainerSnapshot } from "../answer-container-snapshot.js";
import type {
	EvidenceCapture,
	RunnerPhase,
	RunnerTask,
	SurfaceResponse,
	SurfaceSession,
	SurfaceSessionFactory,
} from "../contracts.js";
import {
	acquireDedicatedProfileSession,
	assertDedicatedProfileSession,
	dedicatedProfileDirectory,
	releaseDedicatedProfileSession,
} from "../dedicated-profile.js";
import { BrowserRunnerError } from "../errors.js";
import { RUNNER_EVIDENCE_MAX_BYTES } from "../evidence.js";
import { type PersistentContextLauncher, sandboxedPersistentContext } from "../sandbox-preflight.js";
import { runnerSessionIdForTask } from "../session-identity.js";

const DOUBAO_URL = "https://www.doubao.com/chat/";
export const DOUBAO_COMPOSER_SELECTOR = 'textarea.semi-input-textarea[placeholder="发消息或按住空格说话..."]';
export const DOUBAO_SEND_SELECTOR = "#input-engine-container button.bg-dbx-text-highlight";
const MAX_ANSWER_CHARACTERS = 500_000;
const MAX_PAGE_URL_CHARACTERS = 10_000;
const MAX_DOM_CHARACTERS = Math.floor(RUNNER_EVIDENCE_MAX_BYTES / 4);
const PROFILE_IDENTITY_FILE = ".yonaris-browser-session.json";

export class DoubaoLiveSessionFactory implements SurfaceSessionFactory {
	readonly #profilesDirectory: string;
	readonly #dedicatedProfileDirectory: string;
	readonly #launcher?: PersistentContextLauncher;

	constructor(stateDirectory: string, launcher?: PersistentContextLauncher) {
		this.#profilesDirectory = path.resolve(stateDirectory, "profiles");
		this.#dedicatedProfileDirectory = dedicatedProfileDirectory(stateDirectory);
		this.#launcher = launcher;
	}

	async create(task: RunnerTask, attempt: number): Promise<SurfaceSession> {
		void attempt;
		await mkdir(this.#profilesDirectory, { recursive: true, mode: 0o700 });
		await chmod(this.#profilesDirectory, 0o700);
		const dedicated = task.sessionRequirement === "dedicated_sampling_profile";
		const profileDirectory = dedicated
			? this.#dedicatedProfileDirectory
			: safeChildDirectory(
					this.#profilesDirectory,
					`${task.id}:automation-attempt:${task.automationAttemptCount}:lease:${task.leaseGeneration}`,
				);
		const sessionId = runnerSessionIdForTask(task);
		if (dedicated) await acquireDedicatedProfileSession(profileDirectory, task, sessionId);
		else await initializeProfileIdentity(profileDirectory, task, sessionId);
		try {
			const context = await sandboxedPersistentContext(
				profileDirectory,
				{
					headless: true,
					locale: "zh-CN",
					timezoneId: "Asia/Shanghai",
					viewport: { width: 1_440, height: 900 },
				},
				this.#launcher,
			);
			const page = context.pages()[0] ?? (await context.newPage());
			return new DoubaoLiveSession(task, sessionId, profileDirectory, context, page);
		} catch (error) {
			if (dedicated) {
				await releaseDedicatedProfileSession(profileDirectory, task, sessionId).catch(() => undefined);
			} else {
				await rm(profileDirectory, { recursive: true, force: true }).catch(() => undefined);
			}
			throw mapDoubaoAutomationError(error, "session_open", false);
		}
	}

	async resume(
		task: RunnerTask,
		profileDirectory: string,
		lastPageUrl: string,
		expectedSessionId: string,
	): Promise<SurfaceSession> {
		const dedicated = task.sessionRequirement === "dedicated_sampling_profile";
		if (dedicated) {
			if (path.resolve(profileDirectory) !== this.#dedicatedProfileDirectory) {
				throw new BrowserRunnerError(
					"dedicated_session_mismatch",
					"post_submit",
					"needs_human",
					"The handoff did not reference the configured dedicated Doubao profile",
				);
			}
		} else {
			assertSafeChild(this.#profilesDirectory, profileDirectory);
		}
		if (!expectedSessionId.trim() || expectedSessionId.length > 300) {
			throw new BrowserRunnerError(
				"assist_session_mismatch",
				"post_submit",
				"needs_human",
				"The server did not provide a valid durable Browser Runner session",
			);
		}
		if (dedicated) await assertDedicatedProfileSession(profileDirectory, task, expectedSessionId);
		else await assertProfileIdentity(profileDirectory, task, expectedSessionId);
		let context: BrowserContext | undefined;
		try {
			context = await sandboxedPersistentContext(
				profileDirectory,
				{
					headless: false,
					locale: "zh-CN",
					timezoneId: "Asia/Shanghai",
					viewport: { width: 1_440, height: 900 },
				},
				this.#launcher,
			);
			const page = context.pages()[0] ?? (await context.newPage());
			await page.goto(assertDoubaoUrl(lastPageUrl), { waitUntil: "domcontentloaded" });
			assertDoubaoUrl(page.url());
			return new DoubaoLiveSession(task, expectedSessionId, profileDirectory, context, page);
		} catch (error) {
			await context?.close().catch(() => undefined);
			throw mapDoubaoAutomationError(error, "post_submit", true);
		}
	}
}

export async function initializeProfileIdentity(
	profileDirectory: string,
	task: RunnerTask,
	sessionId: string,
): Promise<void> {
	let created = false;
	try {
		await mkdir(profileDirectory, { recursive: false, mode: 0o700 });
		created = true;
		await chmod(profileDirectory, 0o700);
		const markerPath = path.join(profileDirectory, PROFILE_IDENTITY_FILE);
		await writeFile(markerPath, `${JSON.stringify(profileIdentity(task, sessionId))}\n`, {
			encoding: "utf8",
			flag: "wx",
			mode: 0o600,
		});
		await chmod(markerPath, 0o600);
	} catch (cause) {
		if (created) await rm(profileDirectory, { recursive: true, force: true }).catch(() => undefined);
		throw new BrowserRunnerError(
			"profile_identity_initialization_failed",
			"session_open",
			"needs_human",
			"A fresh Browser Runner profile identity could not be created",
			{ cause },
		);
	}
}

export async function assertProfileIdentity(
	profileDirectory: string,
	task: RunnerTask,
	expectedSessionId: string,
): Promise<void> {
	const fail = (code: "assist_profile_missing" | "assist_session_mismatch", message: string, cause?: unknown) =>
		new BrowserRunnerError(code, "post_submit", "needs_human", message, cause ? { cause } : undefined);
	try {
		const directoryStat = await lstat(profileDirectory);
		if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
			throw fail("assist_session_mismatch", "The retained Browser Runner profile is not a private directory");
		}
	} catch (cause) {
		if (cause instanceof BrowserRunnerError) throw cause;
		throw fail("assist_profile_missing", "The retained Browser Runner profile directory is missing", cause);
	}
	const markerPath = path.join(profileDirectory, PROFILE_IDENTITY_FILE);
	let actual: unknown;
	try {
		const markerStat = await lstat(markerPath);
		if (!markerStat.isFile() || markerStat.isSymbolicLink() || markerStat.size > 4_096) {
			throw new Error("invalid identity marker file");
		}
		actual = JSON.parse(await readFile(markerPath, "utf8"));
	} catch (cause) {
		throw fail("assist_session_mismatch", "The retained Browser Runner profile identity is missing or invalid", cause);
	}
	const expected = profileIdentity(task, expectedSessionId);
	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
		throw fail("assist_session_mismatch", "The retained Browser Runner profile belongs to a different task or attempt");
	}
}

function profileIdentity(task: RunnerTask, sessionId: string) {
	return {
		schemaVersion: 1,
		taskId: task.id,
		sessionId,
	};
}

class DoubaoLiveSession implements SurfaceSession {
	readonly id: string;
	readonly #task: RunnerTask;
	readonly #profileDirectory: string;
	readonly #context: BrowserContext;
	readonly #page: Page;
	#lastPageUrl = DOUBAO_URL;
	#answerCountBeforeSubmit = 0;
	#generationMarkerObserved = false;
	#submitAttempted = false;

	constructor(task: RunnerTask, sessionId: string, profileDirectory: string, context: BrowserContext, page: Page) {
		this.#task = task;
		this.#profileDirectory = profileDirectory;
		this.#context = context;
		this.#page = page;
		this.id = sessionId;
	}

	async open(): Promise<void> {
		try {
			await this.#page.goto(DOUBAO_URL, { waitUntil: "domcontentloaded" });
			this.#lastPageUrl = this.#assertCurrentDoubaoUrl("session_open");
			await this.#assertSupportedState();
		} catch (error) {
			throw mapDoubaoAutomationError(error, "session_open", false);
		}
	}

	async prepare(): Promise<void> {
		try {
			this.#assertCurrentDoubaoUrl("pre_submit");
			await this.#assertSupportedState();
			if (process.env.BROWSER_RUNNER_DOUBAO_ADAPTER_VERIFIED !== "true") {
				throw new BrowserRunnerError(
					"adapter_unverified",
					"pre_submit",
					"needs_human",
					"The production Doubao contract is disabled until its selector fingerprint is verified on a CN runner",
				);
			}
			if (
				this.#task.sessionRequirement !== "anonymous_clean" &&
				this.#task.sessionRequirement !== "dedicated_sampling_profile"
			) {
				throw new BrowserRunnerError(
					"session_mode_unsupported",
					"pre_submit",
					"needs_human",
					"The verified Doubao adapter does not support this frozen session requirement",
				);
			}
			if (this.#task.sessionRequirement === "dedicated_sampling_profile") {
				await prepareDedicatedConversation(this.#page);
			}
			const composer = this.#page.locator(DOUBAO_COMPOSER_SELECTOR);
			if ((await composer.count()) !== 1 || !(await composer.isVisible())) {
				throw new BrowserRunnerError(
					"page_drift",
					"pre_submit",
					"needs_human",
					"The verified Doubao composer fingerprint no longer matches",
				);
			}
			if (this.#task.sessionRequirement === "anonymous_clean") {
				const loginButtonVisible = await this.#page
					.getByRole("button", { name: "\u767b\u5f55", exact: true })
					.isVisible()
					.catch(() => false);
				throw anonymousDoubaoPreflightError(loginButtonVisible);
			}
			if (this.#task.searchRequirement === "forbidden") await this.#assertSearchOff("pre_submit");
			this.#answerCountBeforeSubmit = await this.#answerLocator().count();
		} catch (error) {
			throw mapDoubaoAutomationError(error, "pre_submit", false);
		}
	}

	async submit(promptText: string): Promise<void> {
		this.#submitAttempted = true;
		try {
			this.#assertCurrentDoubaoUrl("submit");
			const composer = this.#page.locator(DOUBAO_COMPOSER_SELECTOR);
			await composer.fill(promptText);
			const send = this.#page.locator(DOUBAO_SEND_SELECTOR);
			if ((await send.count()) !== 1 || !(await send.isVisible())) {
				throw new BrowserRunnerError(
					"page_drift",
					"submit",
					"needs_human",
					"The verified Doubao send control no longer matches",
				);
			}
			await send.click();
			this.#generationMarkerObserved = await this.#page
				.locator(requiredCompletionSelector())
				.isVisible()
				.catch(() => false);
			this.#assertCurrentDoubaoUrl("post_submit");
		} catch (error) {
			throw mapDoubaoAutomationError(error, "submit", true);
		}
	}

	async confirmSubmission(promptText: string): Promise<void> {
		this.#assertCurrentDoubaoUrl("post_submit");
		const exactPrompt = this.#page.getByText(promptText, { exact: true }).last();
		try {
			await exactPrompt.waitFor({ state: "visible", timeout: 15_000 });
		} catch (cause) {
			const mapped = mapDoubaoAutomationError(cause, "post_submit", true);
			if (mapped.code === "post_submit_timeout") {
				throw new BrowserRunnerError(
					"submit_confirmation_timeout",
					"post_submit",
					"recover_same_session",
					"The submitted prompt is not yet visible in the current Doubao conversation",
					{ cause },
				);
			}
			throw mapped;
		}
		this.#assertCurrentDoubaoUrl("post_submit");
	}

	async collectResponse(): Promise<SurfaceResponse> {
		this.#assertCurrentDoubaoUrl("post_submit");
		const answers = this.#answerLocator();
		try {
			await this.#page.waitForFunction(
				({ selector, previousCount }) => document.querySelectorAll(selector).length > previousCount,
				{ selector: requiredAnswerSelector(), previousCount: this.#answerCountBeforeSubmit },
				{ timeout: 90_000 },
			);
		} catch (cause) {
			const mapped = mapDoubaoAutomationError(cause, "post_submit", true);
			if (mapped.code === "post_submit_timeout") {
				throw new BrowserRunnerError(
					"response_timeout",
					"post_submit",
					"recover_same_session",
					"A new Doubao answer did not appear within the verified response window",
					{ cause },
				);
			}
			throw mapped;
		}
		const completionSelector = requiredCompletionSelector();
		const completionMarker = this.#page.locator(completionSelector);
		const answer = answers.last();
		const answerText = await stableText(answer, 90_000, 8, async () => {
			if (await completionMarker.isVisible().catch(() => false)) this.#generationMarkerObserved = true;
		});
		if (!this.#generationMarkerObserved) {
			throw new BrowserRunnerError(
				"completion_state_unverified",
				"post_submit",
				"needs_human",
				"The approved Doubao generation marker was never observed; response completion cannot be proven",
			);
		}
		if (await completionMarker.isVisible().catch(() => false)) {
			throw new BrowserRunnerError(
				"generation_still_active",
				"post_submit",
				"recover_same_session",
				"The approved Doubao stop-generation marker is still visible; a partial answer will not be persisted",
			);
		}
		assertExactlyOneNewAnswer(this.#answerCountBeforeSubmit, await answers.count());
		if (!answerText || answerText.length > MAX_ANSWER_CHARACTERS) {
			throw new BrowserRunnerError(
				"invalid_answer",
				"post_submit",
				"needs_human",
				"The Doubao answer is empty or exceeds the persistence limit",
			);
		}
		const answerContainer = await answer.evaluate((element) => ({
			containerText: (element as HTMLElement).innerText,
			answerHtml: (element as HTMLElement).outerHTML,
		}));
		const answerHtml = validateAnswerContainerSnapshot({ answerText, ...answerContainer });
		const citations = await answer.locator("a[href]").evaluateAll((links) =>
			links
				.map((link, citationIndex) => ({
					url: (link as HTMLAnchorElement).href,
					title: (link.textContent ?? "").trim().slice(0, 1_000) || undefined,
					citationIndex,
				}))
				.filter(
					({ url }) =>
						url.length <= MAX_PAGE_URL_CHARACTERS && (url.startsWith("https://") || url.startsWith("http://")),
				)
				.slice(0, 200),
		);
		const webSearchObserved = await this.#observeVerifiedWebSearch(answer);
		this.#lastPageUrl = this.#assertCurrentDoubaoUrl("post_submit");
		return {
			answerText,
			answerHtml,
			pageUrl: this.#lastPageUrl,
			observedAt: new Date().toISOString(),
			browserVersion: (await this.#page.evaluate(() => navigator.userAgent)).slice(0, 200),
			citations,
			webQueries: [],
			webSearchObserved,
		};
	}

	async captureEvidence(): Promise<EvidenceCapture> {
		try {
			this.#assertCurrentDoubaoUrl("evidence");
			if (this.#task.searchRequirement === "forbidden") await this.#assertSearchOff("evidence");
			const capture = {
				domSnapshot: await this.#boundedPageSnapshot(),
				screenshotPng: await this.#page.screenshot({ fullPage: false }),
			};
			if (capture.screenshotPng.byteLength > RUNNER_EVIDENCE_MAX_BYTES) {
				throw new BrowserRunnerError(
					"evidence_too_large",
					"evidence",
					"needs_human",
					"The viewport screenshot exceeds the Browser Runner evidence limit",
				);
			}
			this.#assertCurrentDoubaoUrl("evidence");
			return capture;
		} catch (error) {
			throw mapDoubaoAutomationError(error, "evidence", true);
		}
	}

	async handoffMetadata() {
		try {
			this.#lastPageUrl = assertDoubaoUrl(this.#page.url() || this.#lastPageUrl);
		} catch {
			// Preserve the last verified Doubao URL; never hand an arbitrary redirect to assist mode.
		}
		return {
			sessionId: this.id,
			profileDirectory: this.#profileDirectory,
			lastPageUrl: this.#lastPageUrl,
			fixture: false,
		};
	}

	async close(outcome: "succeeded" | "retrying" | "needs_human"): Promise<void> {
		await this.#context.close();
		if (outcome === "succeeded" || outcome === "retrying" || !this.#submitAttempted) {
			if (this.#task.sessionRequirement === "dedicated_sampling_profile") {
				await releaseDedicatedProfileSession(this.#profileDirectory, this.#task, this.id);
			} else {
				assertSafeChild(this.#profilesRoot(), this.#profileDirectory);
				await rm(this.#profileDirectory, { recursive: true, force: true });
			}
		}
	}

	#profilesRoot(): string {
		return path.dirname(this.#profileDirectory);
	}

	async #assertSupportedState(): Promise<void> {
		const pageText = (await this.#page.locator("body").innerText()).slice(0, 50_000);
		if (/\u9a8c\u8bc1\u7801|captcha|\u5b89\u5168\u9a8c\u8bc1|\u6ed1\u5757\u9a8c\u8bc1/i.test(pageText)) {
			throw new BrowserRunnerError(
				"captcha",
				"session_open",
				"needs_human",
				"Doubao presented a verification challenge",
			);
		}
		if (
			/\u626b\u7801\u767b\u5f55|\u624b\u673a\u53f7\u767b\u5f55/i.test(pageText) &&
			(await this.#page.locator(DOUBAO_COMPOSER_SELECTOR).count()) === 0
		) {
			throw new BrowserRunnerError("login_required", "session_open", "needs_human", "Doubao requires a login");
		}
	}

	#answerLocator() {
		return this.#page.locator(requiredAnswerSelector());
	}

	async #boundedPageSnapshot(): Promise<string> {
		const characterCount = await this.#page.evaluate(() => document.documentElement?.outerHTML.length ?? 0);
		if (characterCount <= 0 || characterCount > MAX_DOM_CHARACTERS) {
			throw new BrowserRunnerError(
				"evidence_too_large",
				"evidence",
				"needs_human",
				"The page snapshot cannot be captured within the Browser Runner evidence limit",
			);
		}
		const html = await this.#page.content();
		if (Buffer.byteLength(html, "utf8") > RUNNER_EVIDENCE_MAX_BYTES) {
			throw new BrowserRunnerError(
				"evidence_too_large",
				"evidence",
				"needs_human",
				"The page snapshot exceeds the Browser Runner evidence limit",
			);
		}
		return html;
	}

	async #assertSearchOff(phase: "pre_submit" | "evidence"): Promise<void> {
		const selector = requiredSearchOffSelector();
		const marker = this.#page.locator(selector);
		if ((await marker.count()) !== 1 || !(await marker.isVisible())) {
			throw new BrowserRunnerError(
				"search_state_unverified",
				phase,
				"needs_human",
				"The approved Doubao marker does not uniquely prove that search is off",
			);
		}
		const state = await marker.evaluate((element) => ({
			ariaChecked: element.getAttribute("aria-checked")?.toLowerCase() ?? null,
			ariaPressed: element.getAttribute("aria-pressed")?.toLowerCase() ?? null,
			dataState: element.getAttribute("data-state")?.toLowerCase() ?? null,
			checked: "checked" in element ? Boolean((element as HTMLInputElement).checked) : null,
		}));
		const explicitlyOff =
			state.ariaChecked === "false" ||
			state.ariaPressed === "false" ||
			state.dataState === "off" ||
			state.dataState === "false" ||
			state.checked === false;
		if (!explicitlyOff) {
			throw new BrowserRunnerError(
				"search_state_unverified",
				phase,
				"needs_human",
				"The approved Doubao marker exists but does not expose an explicit off state",
			);
		}
	}

	async #observeVerifiedWebSearch(answer: import("playwright").Locator): Promise<boolean | null> {
		if (this.#task.searchRequirement !== "platform_default") return false;
		const [usedMarkerVisible, explicitNotUsedMarkerVisible] = await Promise.all([
			verifiedMarkerVisible(answer, configuredSearchObservationSelector("USED")),
			verifiedMarkerVisible(answer, configuredSearchObservationSelector("NOT_USED")),
		]);
		return observedWebSearchState(usedMarkerVisible, explicitNotUsedMarkerVisible);
	}

	#assertCurrentDoubaoUrl(phase: "session_open" | "pre_submit" | "submit" | "post_submit" | "evidence"): string {
		try {
			return assertDoubaoUrl(this.#page.url());
		} catch (cause) {
			throw new BrowserRunnerError(
				"unexpected_navigation",
				phase,
				"needs_human",
				"The Doubao session navigated outside the approved HTTPS host",
				{ cause },
			);
		}
	}
}

export function anonymousDoubaoPreflightError(loginActionVisible: boolean): BrowserRunnerError {
	return loginActionVisible
		? new BrowserRunnerError(
				"login_required",
				"pre_submit",
				"needs_human",
				"The verified anonymous Doubao page requires login before it accepts a prompt",
			)
		: new BrowserRunnerError(
				"anonymous_session_unverified",
				"pre_submit",
				"needs_human",
				"The Doubao page does not expose the expected anonymous-session marker",
			);
}

export function assertDoubaoUrl(value: string): string {
	if (!value || value.length > MAX_PAGE_URL_CHARACTERS) throw new Error("Doubao URL is empty or too long");
	const url = new URL(value);
	const hostname = url.hostname.toLowerCase();
	if (
		url.protocol !== "https:" ||
		url.port !== "" ||
		url.username !== "" ||
		url.password !== "" ||
		(hostname !== "doubao.com" && !hostname.endsWith(".doubao.com"))
	) {
		throw new Error("Handoff URL is not an HTTPS Doubao URL");
	}
	return url.toString();
}

export async function prepareDedicatedConversation(page: Page): Promise<void> {
	const authenticatedSelector = requiredDedicatedSelector(
		"BROWSER_RUNNER_DOUBAO_AUTHENTICATED_SELECTOR",
		"the approved positive authenticated-account marker",
	);
	const authenticated = page.locator(authenticatedSelector);
	const loginButtonVisible = await page
		.getByRole("button", { name: "\u767b\u5f55", exact: true })
		.isVisible()
		.catch(() => false);
	if ((await authenticated.count()) !== 1 || !(await authenticated.isVisible()) || loginButtonVisible) {
		throw new BrowserRunnerError(
			"dedicated_profile_not_authenticated",
			"pre_submit",
			"needs_human",
			"The dedicated Doubao profile is not positively verified as the preconfigured sampling account",
		);
	}

	const newConversationSelector = requiredDedicatedSelector(
		"BROWSER_RUNNER_DOUBAO_NEW_CONVERSATION_SELECTOR",
		"the approved new-conversation action",
	);
	const newConversation = page.locator(newConversationSelector);
	if ((await newConversation.count()) !== 1 || !(await newConversation.isVisible())) {
		throw new BrowserRunnerError(
			"new_conversation_action_unverified",
			"pre_submit",
			"needs_human",
			"The dedicated Doubao profile does not expose one verified new-conversation action",
		);
	}
	await newConversation.click();

	const answerSelector = requiredAnswerSelector();
	const userMessageSelector = requiredDedicatedSelector(
		"BROWSER_RUNNER_DOUBAO_USER_MESSAGE_SELECTOR",
		"the approved user-message nodes",
	);
	try {
		await page.waitForFunction(
			({ answer, userMessage }) =>
				document.querySelectorAll(answer).length === 0 && document.querySelectorAll(userMessage).length === 0,
			{ answer: answerSelector, userMessage: userMessageSelector },
			{ timeout: 15_000 },
		);
	} catch (cause) {
		throw new BrowserRunnerError(
			"fresh_conversation_unverified",
			"pre_submit",
			"needs_human",
			"A blank dedicated-account conversation could not be verified before prompt submission",
			{ cause },
		);
	}
	if ((await page.locator(answerSelector).count()) !== 0 || (await page.locator(userMessageSelector).count()) !== 0) {
		throw new BrowserRunnerError(
			"fresh_conversation_unverified",
			"pre_submit",
			"needs_human",
			"The dedicated-account conversation contains prior user or answer content",
		);
	}
}

function requiredAnswerSelector(): string {
	const selector = process.env.BROWSER_RUNNER_DOUBAO_ANSWER_SELECTOR?.trim();
	if (!selector || selector.length > 500) {
		throw new BrowserRunnerError(
			"adapter_unverified",
			"pre_submit",
			"needs_human",
			"BROWSER_RUNNER_DOUBAO_ANSWER_SELECTOR must be supplied by the approved selector fingerprint",
		);
	}
	return selector;
}

function requiredCompletionSelector(): string {
	const selector = process.env.BROWSER_RUNNER_DOUBAO_COMPLETION_SELECTOR?.trim();
	if (!selector || selector.length > 500) {
		throw new BrowserRunnerError(
			"adapter_unverified",
			"pre_submit",
			"needs_human",
			"BROWSER_RUNNER_DOUBAO_COMPLETION_SELECTOR must identify the approved in-progress/stop-generation marker",
		);
	}
	return selector;
}

function requiredDedicatedSelector(environmentKey: string, description: string): string {
	const selector = process.env[environmentKey]?.trim();
	if (!selector || selector.length > 500) {
		throw new BrowserRunnerError(
			"adapter_unverified",
			"pre_submit",
			"needs_human",
			`${environmentKey} must identify ${description}`,
		);
	}
	return selector;
}

function requiredSearchOffSelector(): string {
	const selector = process.env.BROWSER_RUNNER_DOUBAO_SEARCH_OFF_SELECTOR?.trim();
	if (!selector || selector.length > 500) {
		throw new BrowserRunnerError(
			"adapter_unverified",
			"pre_submit",
			"needs_human",
			"BROWSER_RUNNER_DOUBAO_SEARCH_OFF_SELECTOR must identify an approved explicit search-off state",
		);
	}
	return selector;
}

function configuredSearchObservationSelector(kind: "USED" | "NOT_USED"): string | null {
	const selector = process.env[`BROWSER_RUNNER_DOUBAO_SEARCH_${kind}_SELECTOR`]?.trim();
	return selector && selector.length <= 500 ? selector : null;
}

async function verifiedMarkerVisible(answer: import("playwright").Locator, selector: string | null): Promise<boolean> {
	if (!selector) return false;
	const markers = answer.locator(selector);
	const count = await markers.count();
	for (let index = 0; index < count; index += 1) {
		if (
			await markers
				.nth(index)
				.isVisible()
				.catch(() => false)
		)
			return true;
	}
	return false;
}

export function observedWebSearchState(
	verifiedUsedMarkerVisible: boolean,
	verifiedNotUsedMarkerVisible: boolean,
): boolean | null {
	if (verifiedUsedMarkerVisible === verifiedNotUsedMarkerVisible) return null;
	return verifiedUsedMarkerVisible;
}

async function stableText(
	locator: import("playwright").Locator,
	timeoutMs: number,
	minimumStableSeconds: number,
	onPoll?: () => Promise<void>,
): Promise<string> {
	const deadline = Date.now() + timeoutMs;
	let prior = "";
	let unchanged = 0;
	while (Date.now() < deadline) {
		await onPoll?.();
		let current: string;
		try {
			current = (await locator.innerText()).trim();
		} catch (error) {
			throw mapDoubaoAutomationError(error, "post_submit", true);
		}
		if (current && current === prior) unchanged += 1;
		else unchanged = 0;
		if (unchanged >= minimumStableSeconds) return current;
		prior = current;
		await new Promise((resolve) => setTimeout(resolve, 1_000));
	}
	throw new BrowserRunnerError(
		"response_stream_timeout",
		"post_submit",
		"recover_same_session",
		"The Doubao answer did not stabilize before the response deadline",
	);
}

/**
 * Convert only recognized Playwright/browser transport failures into retryable
 * classes. Unknown errors remain fail-closed. Once durable submit intent
 * exists, no classification is ever allowed to request a fresh execution.
 */
export function mapDoubaoAutomationError(
	error: unknown,
	phase: RunnerPhase,
	submitIntentRecorded: boolean,
): BrowserRunnerError {
	if (error instanceof BrowserRunnerError) return error;
	const rawMessage = error instanceof Error ? error.message : String(error);
	const name = error instanceof Error ? error.name : "";
	const isTargetClosed =
		/TargetClosedError/i.test(name) ||
		/target (?:page|context|browser).*closed|browser has been closed|page has been closed/i.test(rawMessage);
	const isTimeout = /TimeoutError/i.test(name) || /timeout|timed out/i.test(rawMessage);
	const isTransientNetwork =
		/net::ERR_(?:ABORTED|CONNECTION_CLOSED|CONNECTION_RESET|CONNECTION_TIMED_OUT|INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|NETWORK_CHANGED|TIMED_OUT)/i.test(
			rawMessage,
		);

	if (!submitIntentRecorded && (phase === "session_open" || phase === "pre_submit")) {
		if (isTargetClosed) {
			return new BrowserRunnerError(
				"browser_crash_before_submit",
				phase,
				"safe_pre_submit_retry",
				"The browser closed before the prompt was submitted",
				{ cause: error },
			);
		}
		if (isTransientNetwork) {
			return new BrowserRunnerError(
				"network_transient",
				phase,
				"safe_pre_submit_retry",
				"A transient network error occurred before the prompt was submitted",
				{ cause: error },
			);
		}
		if (isTimeout) {
			return new BrowserRunnerError(
				"navigation_timeout",
				phase,
				"safe_pre_submit_retry",
				"Doubao navigation timed out before the prompt was submitted",
				{ cause: error },
			);
		}
	}

	if (submitIntentRecorded) {
		if (isTargetClosed) {
			return new BrowserRunnerError(
				"browser_crash_after_submit",
				phase,
				"needs_human",
				"The browser closed after durable submit intent; automatic replay is forbidden",
				{ cause: error },
			);
		}
		if (isTransientNetwork) {
			return new BrowserRunnerError(
				"network_transient_after_submit",
				phase,
				"recover_same_session",
				"A transient network error occurred after durable submit intent; only same-session recovery is allowed",
				{ cause: error },
			);
		}
		if (isTimeout) {
			return new BrowserRunnerError(
				"post_submit_timeout",
				phase,
				"recover_same_session",
				"The browser timed out after durable submit intent; only same-session recovery is allowed",
				{ cause: error },
			);
		}
	}

	return new BrowserRunnerError("unexpected_runner_error", phase, "needs_human", rawMessage, { cause: error });
}

export function safeChildDirectory(rootDirectory: string, identity: string): string {
	const root = path.resolve(rootDirectory);
	const readable = identity.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "task";
	const digest = createHash("sha256").update(identity).digest("hex").slice(0, 16);
	const child = path.resolve(root, `${readable}-${digest}`);
	assertSafeChild(root, child);
	return child;
}

function assertSafeChild(rootDirectory: string, childDirectory: string): void {
	const root = path.resolve(rootDirectory);
	const child = path.resolve(childDirectory);
	const relative = path.relative(root, child);
	if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
		throw new Error("Browser profile directory escaped its configured root");
	}
}
