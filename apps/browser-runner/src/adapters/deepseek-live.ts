import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, open, readFile, rm } from "node:fs/promises";
import path from "node:path";
import type { BrowserContext, Locator, Page } from "playwright";
import type { SurfaceResponse } from "../contracts.js";
import type { DeepSeekCaptureSession, DeepSeekCaptureSessionFactory } from "../deepseek-local-capture.js";
import { type PersistentContextLauncher, sandboxedPersistentContext } from "../sandbox-preflight.js";

export type DeepSeekSelectorContract = {
	version: string;
	composer: string;
	send: string;
	newConversation: string;
	userMessage: string;
	answer: string;
	generating: string;
	loginWall: string;
	captcha: string;
	rateLimit: string;
	searchUsed: string | null;
	searchNotUsed: string | null;
	citationLink: string | null;
	queryItem: string | null;
};

export type DeepSeekPageSnapshot = {
	url: string;
	composerCount: number;
	composerVisible: boolean;
	sendCount: number;
	sendVisible: boolean;
	newConversationCount: number;
	newConversationVisible: boolean;
	loginWallVisible: boolean;
	captchaVisible: boolean;
	rateLimitVisible: boolean;
};

export type DeepSeekPageClassification = "ready" | "login_required" | "captcha" | "rate_limited" | "page_drift";

type DeepSeekResponseInput = {
	pageUrl: string;
	observedAt: string;
	answers: readonly string[];
	usedCount: number;
	notUsedCount: number;
	webQueries: readonly string[];
	citations: ReadonlyArray<{ url: string; title: string }>;
	modelVersion?: string;
	browserVersion?: string;
};

const ACTION_KEYS = new Set<keyof DeepSeekSelectorContract>(["composer", "send", "newConversation"]);
const OPTIONAL_SELECTOR_KEYS = new Set<keyof DeepSeekSelectorContract>([
	"searchUsed",
	"searchNotUsed",
	"citationLink",
	"queryItem",
]);
const SELECTOR_KEYS: ReadonlyArray<keyof DeepSeekSelectorContract> = [
	"composer",
	"send",
	"newConversation",
	"userMessage",
	"answer",
	"generating",
	"loginWall",
	"captcha",
	"rateLimit",
	"searchUsed",
	"searchNotUsed",
	"citationLink",
	"queryItem",
];
const PLAYWRIGHT_ONLY_SELECTOR = /:visible|:has-text\(|:text\(|^text=|^xpath=|^\/\//i;
const DEEPSEEK_ROOT_URL = "https://chat.deepseek.com/";
const DEEPSEEK_LOGIN_URL = "https://chat.deepseek.com/sign_in";
const PROFILE_IDENTITY_FILE = ".yonaris-deepseek-profile-id";
const PROFILE_LOCK_FILE = ".yonaris-deepseek-active";

export class DeepSeekPlaywrightSessionFactory implements DeepSeekCaptureSessionFactory {
	readonly #profileDirectory: string;
	readonly #selectors: DeepSeekSelectorContract;
	readonly #launcher?: PersistentContextLauncher;

	constructor(stateDirectory: string, selectors: DeepSeekSelectorContract, launcher?: PersistentContextLauncher) {
		this.#profileDirectory = path.resolve(stateDirectory, "deepseek-profile");
		this.#selectors = validateDeepSeekSelectorContract(selectors);
		this.#launcher = launcher;
	}

	async create(externalId: string, promptText: string): Promise<DeepSeekCaptureSession> {
		void promptText;
		return this.#launch(externalId);
	}

	async resume(externalId: string, promptText: string, pageUrl: string): Promise<DeepSeekCaptureSession> {
		void promptText;
		const session = await this.#launch(externalId);
		try {
			await session.resumeAt(assertDeepSeekConversationUrl(pageUrl));
			return session;
		} catch (error) {
			await session.close().catch(() => undefined);
			throw error;
		}
	}

	async #launch(externalId: string): Promise<DeepSeekPlaywrightSession> {
		await initializeDeepSeekProfile(this.#profileDirectory);
		const releaseLock = await acquireProfileLock(this.#profileDirectory, externalId);
		try {
			const context = await sandboxedPersistentContext(
				this.#profileDirectory,
				{
					headless: true,
					locale: "zh-CN",
					timezoneId: "Asia/Shanghai",
					viewport: { width: 1440, height: 900 },
				},
				this.#launcher,
			);
			const page = context.pages()[0] ?? (await context.newPage());
			return new DeepSeekPlaywrightSession(context, page, this.#selectors, releaseLock);
		} catch (error) {
			await releaseLock();
			throw error;
		}
	}
}

export async function openDeepSeekLoginWindow(
	stateDirectory: string,
	launcher?: PersistentContextLauncher,
): Promise<{ status: "closed"; profileIdentityHash: string }> {
	const profileDirectory = path.resolve(stateDirectory, "deepseek-profile");
	const profileIdentityHash = await initializeDeepSeekProfile(profileDirectory);
	const releaseLock = await acquireProfileLock(profileDirectory, "manual-login-window");
	let context: BrowserContext | undefined;
	try {
		context = await sandboxedPersistentContext(
			profileDirectory,
			{
				headless: false,
				locale: "zh-CN",
				timezoneId: "Asia/Shanghai",
				viewport: { width: 1440, height: 900 },
			},
			launcher,
		);
		const page = context.pages()[0] ?? (await context.newPage());
		await page.goto(DEEPSEEK_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
		await context.waitForEvent("close", { timeout: 0 });
		return { status: "closed", profileIdentityHash };
	} finally {
		await context?.close().catch(() => undefined);
		await releaseLock();
	}
}

export async function deepSeekProfileIdentityHash(stateDirectory: string): Promise<string> {
	return initializeDeepSeekProfile(path.resolve(stateDirectory, "deepseek-profile"));
}

class DeepSeekPlaywrightSession implements DeepSeekCaptureSession {
	readonly #context: BrowserContext;
	readonly #page: Page;
	readonly #selectors: DeepSeekSelectorContract;
	readonly #releaseLock: () => Promise<void>;
	readonly #submission = new DeepSeekSubmissionGuard();
	#answerCountBeforeSubmit = 0;
	#closed = false;

	constructor(
		context: BrowserContext,
		page: Page,
		selectors: DeepSeekSelectorContract,
		releaseLock: () => Promise<void>,
	) {
		this.#context = context;
		this.#page = page;
		this.#selectors = selectors;
		this.#releaseLock = releaseLock;
	}

	async openNewConversation(): Promise<void> {
		await this.#page.goto(DEEPSEEK_ROOT_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
		await this.#page.waitForTimeout(1_000);
		await this.#assertUnblocked();
		const button = await uniqueVisible(this.#page, this.#selectors.newConversation, "new conversation");
		await button.click();
		await this.#page.waitForTimeout(500);
		assertDeepSeekTopLevelUrl(this.#page.url());
	}

	async resumeAt(pageUrl: string): Promise<void> {
		await this.#page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
		await this.#page.waitForTimeout(1_000);
		await this.#assertUnblocked();
		const answerCount = await this.#page.locator(this.#selectors.answer).count();
		this.#answerCountBeforeSubmit = Math.max(0, answerCount - 1);
	}

	async prepare(): Promise<void> {
		await this.#assertUnblocked();
		await uniqueVisible(this.#page, this.#selectors.composer, "composer");
		await uniqueVisible(this.#page, this.#selectors.send, "send action");
		this.#answerCountBeforeSubmit = await this.#page.locator(this.#selectors.answer).count();
	}

	async submit(promptText: string): Promise<void> {
		await this.#submission.submitOnce(
			async () => undefined,
			async () => {
				const composer = await uniqueVisible(this.#page, this.#selectors.composer, "composer");
				const send = await uniqueVisible(this.#page, this.#selectors.send, "send action");
				await composer.fill(promptText);
				await send.click();
			},
		);
	}

	async confirmSubmission(promptText: string): Promise<void> {
		await this.#page.waitForFunction(
			({ selector, expected }) => {
				const messages = [...document.querySelectorAll(selector)];
				const latest = messages.at(-1)?.textContent?.trim().normalize("NFKC");
				return latest === expected.normalize("NFKC");
			},
			{ selector: this.#selectors.userMessage, expected: promptText },
			{ timeout: 30_000 },
		);
	}

	async collectResponse(): Promise<SurfaceResponse> {
		const timeoutAt = Date.now() + 180_000;
		let generatingSeen = false;
		let stableText = "";
		let stableSince = 0;
		while (Date.now() < timeoutAt) {
			await this.#assertUnblocked();
			const generating = await visible(this.#page.locator(this.#selectors.generating));
			if (generating) generatingSeen = true;
			const answers = await this.#page.locator(this.#selectors.answer).allTextContents();
			const latest = answers.at(-1)?.trim() ?? "";
			if (answers.length > this.#answerCountBeforeSubmit && latest) {
				if (latest !== stableText) {
					stableText = latest;
					stableSince = Date.now();
				} else if (generatingSeen && !generating && Date.now() - stableSince >= 8_000) {
					return this.#buildCurrentResponse(answers);
				}
			}
			await this.#page.waitForTimeout(250);
		}
		throw new Error("post_submit_unknown");
	}

	async captureEvidence() {
		return {
			domSnapshot: await this.#page.content(),
			screenshotPng: await this.#page.screenshot({ fullPage: true, type: "png" }),
		};
	}

	async close(): Promise<void> {
		if (this.#closed) return;
		this.#closed = true;
		await this.#context.close().catch(() => undefined);
		await this.#releaseLock();
	}

	async #assertUnblocked(): Promise<void> {
		assertDeepSeekTopLevelUrl(this.#page.url());
		if (await visible(this.#page.locator(this.#selectors.captcha))) throw new Error("captcha");
		if (await visible(this.#page.locator(this.#selectors.rateLimit))) throw new Error("rate_limited");
		if (await visible(this.#page.locator(this.#selectors.loginWall))) throw new Error("login_required");
	}

	async #buildCurrentResponse(answers: string[]): Promise<SurfaceResponse> {
		const answer = this.#page.locator(this.#selectors.answer).last();
		const usedCount = await optionalScopedCount(answer, this.#selectors.searchUsed);
		const notUsedCount = await optionalScopedCount(answer, this.#selectors.searchNotUsed);
		const webQueries = this.#selectors.queryItem
			? await answer.locator(this.#selectors.queryItem).allTextContents()
			: [];
		const citations = this.#selectors.citationLink
			? await answer.locator(this.#selectors.citationLink).evaluateAll((nodes) =>
					nodes.map((node) => {
						const anchor = node as HTMLAnchorElement;
						return {
							url: anchor.href,
							title:
								anchor.getAttribute("title")?.trim() || anchor.textContent?.trim() || new URL(anchor.href).hostname,
						};
					}),
				)
			: [];
		return buildDeepSeekSurfaceResponse({
			pageUrl: this.#page.url(),
			observedAt: new Date().toISOString(),
			answers,
			usedCount,
			notUsedCount,
			webQueries,
			citations,
		});
	}
}

export function validateDeepSeekSelectorContract(value: DeepSeekSelectorContract): DeepSeekSelectorContract {
	if (!/^[A-Za-z0-9._:-]{8,100}$/.test(value.version)) throw new Error("Invalid DeepSeek selector contract version");
	for (const key of SELECTOR_KEYS) {
		const selector = value[key];
		if (selector === null && OPTIONAL_SELECTOR_KEYS.has(key)) continue;
		if (
			typeof selector !== "string" ||
			selector.length < 2 ||
			selector.length > 500 ||
			selector.trim() !== selector ||
			selector === "*" ||
			PLAYWRIGHT_ONLY_SELECTOR.test(selector) ||
			(ACTION_KEYS.has(key) && /\s/.test(selector))
		) {
			throw new Error(`Invalid DeepSeek selector contract: ${key}`);
		}
	}
	return { ...value };
}

export function classifyDeepSeekPage(snapshot: DeepSeekPageSnapshot): DeepSeekPageClassification {
	try {
		assertDeepSeekConversationUrl(snapshot.url);
	} catch {
		return "page_drift";
	}
	if (snapshot.captchaVisible) return "captcha";
	if (snapshot.rateLimitVisible) return "rate_limited";
	if (snapshot.loginWallVisible) return "login_required";
	if (
		snapshot.composerCount !== 1 ||
		!snapshot.composerVisible ||
		snapshot.sendCount !== 1 ||
		!snapshot.sendVisible ||
		snapshot.newConversationCount !== 1 ||
		!snapshot.newConversationVisible
	) {
		return "page_drift";
	}
	return "ready";
}

export function classifyDeepSeekSearch(input: { usedCount: number; notUsedCount: number }): boolean | null {
	if (
		!Number.isInteger(input.usedCount) ||
		!Number.isInteger(input.notUsedCount) ||
		input.usedCount < 0 ||
		input.notUsedCount < 0 ||
		input.usedCount > 1 ||
		input.notUsedCount > 1 ||
		(input.usedCount === 1 && input.notUsedCount === 1)
	) {
		throw new Error("page_drift: conflicting or ambiguous DeepSeek search evidence");
	}
	if (input.usedCount === 1) return true;
	if (input.notUsedCount === 1) return false;
	return null;
}

export class DeepSeekSubmissionGuard {
	#submitted = false;

	async submitOnce(recordIntent: () => Promise<void>, submit: () => Promise<void>): Promise<void> {
		if (this.#submitted) throw new Error("DeepSeek prompt was already submitted");
		await recordIntent();
		this.#submitted = true;
		await submit();
	}
}

export function buildDeepSeekSurfaceResponse(input: DeepSeekResponseInput): SurfaceResponse {
	const pageUrl = assertDeepSeekConversationUrl(input.pageUrl);
	if (Number.isNaN(new Date(input.observedAt).getTime())) throw new Error("Invalid DeepSeek observedAt");
	const answerText = input.answers.at(-1)?.trim();
	if (!answerText || answerText.length > 500_000) throw new Error("DeepSeek response is missing or oversized");
	const webQueries = uniqueNonemptyStrings(input.webQueries, 32, 2_000, "DeepSeek web query");
	const citations: SurfaceResponse["citations"] = [];
	const citationUrls = new Set<string>();
	for (const item of input.citations) {
		if (citations.length >= 100) throw new Error("Too many DeepSeek citations");
		const url = validExternalUrl(item.url);
		if (citationUrls.has(url)) continue;
		const title = item.title.trim();
		if (!title || title.length > 2_000) throw new Error("Invalid DeepSeek citation title");
		citationUrls.add(url);
		citations.push({ url, title, citationIndex: citations.length });
	}
	return {
		answerText,
		pageUrl,
		observedAt: input.observedAt,
		webSearchObserved: classifyDeepSeekSearch({ usedCount: input.usedCount, notUsedCount: input.notUsedCount }),
		webQueries,
		citations,
		...(input.modelVersion ? { modelVersion: input.modelVersion } : {}),
		...(input.browserVersion ? { browserVersion: input.browserVersion } : {}),
	};
}

export function assertDeepSeekConversationUrl(value: string): string {
	const url = new URL(value);
	if (
		url.protocol !== "https:" ||
		url.hostname !== "chat.deepseek.com" ||
		url.port ||
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		!/^\/a\/chat\/s\/[A-Za-z0-9_-]{4,200}\/?$/.test(url.pathname)
	) {
		throw new Error("Invalid DeepSeek conversation URL");
	}
	return url.toString().replace(/\/$/, "");
}

function uniqueNonemptyStrings(values: readonly string[], maximum: number, maxLength: number, label: string): string[] {
	if (values.length > maximum) throw new Error(`Too many ${label} values`);
	const result: string[] = [];
	const seen = new Set<string>();
	for (const value of values) {
		const trimmed = value.trim();
		if (!trimmed || trimmed.length > maxLength) throw new Error(`Invalid ${label}`);
		const normalized = trimmed.normalize("NFKC").toLocaleLowerCase("zh-CN");
		if (seen.has(normalized)) continue;
		seen.add(normalized);
		result.push(trimmed);
	}
	return result;
}

function validExternalUrl(value: string): string {
	if (value.length < 1 || value.length > 10_000) throw new Error("Invalid DeepSeek citation URL");
	const url = new URL(value);
	if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
		throw new Error("Invalid DeepSeek citation URL");
	}
	return value;
}

function assertDeepSeekTopLevelUrl(value: string): void {
	const url = new URL(value);
	if (url.protocol !== "https:" || url.hostname !== "chat.deepseek.com" || url.port || url.username || url.password) {
		throw new Error("DeepSeek navigation left the approved top-level origin");
	}
}

async function uniqueVisible(page: Page, selector: string, label: string): Promise<Locator> {
	const locator = page.locator(selector);
	if ((await locator.count()) !== 1 || !(await locator.isVisible().catch(() => false))) {
		throw new Error(`page_drift: DeepSeek ${label} is not unique and visible`);
	}
	return locator;
}

async function visible(locator: Locator): Promise<boolean> {
	if ((await locator.count()) < 1) return false;
	return locator
		.first()
		.isVisible()
		.catch(() => false);
}

async function optionalScopedCount(scope: Locator, selector: string | null): Promise<number> {
	return selector ? scope.locator(selector).count() : 0;
}

async function initializeDeepSeekProfile(profileDirectory: string): Promise<string> {
	await mkdir(profileDirectory, { recursive: true, mode: 0o700 });
	await chmod(profileDirectory, 0o700);
	const identityPath = path.join(profileDirectory, PROFILE_IDENTITY_FILE);
	let identity: string;
	try {
		identity = (await readFile(identityPath, "utf8")).trim();
	} catch (error) {
		if (!isNodeError(error, "ENOENT")) throw error;
		identity = randomBytes(32).toString("hex");
		const handle = await open(identityPath, "wx", 0o600);
		try {
			await handle.writeFile(`${identity}\n`, "utf8");
			await handle.sync();
		} finally {
			await handle.close();
		}
		await chmod(identityPath, 0o600);
	}
	if (!/^[0-9a-f]{64}$/.test(identity)) throw new Error("Invalid dedicated DeepSeek profile identity");
	return createHash("sha256").update(identity).digest("hex");
}

async function acquireProfileLock(profileDirectory: string, owner: string): Promise<() => Promise<void>> {
	const lockPath = path.join(profileDirectory, PROFILE_LOCK_FILE);
	let handle: Awaited<ReturnType<typeof open>>;
	try {
		handle = await open(lockPath, "wx", 0o600);
	} catch (error) {
		if (isNodeError(error, "EEXIST")) throw new Error("The dedicated DeepSeek profile is already in use");
		throw error;
	}
	try {
		await handle.writeFile(`${createHash("sha256").update(owner).digest("hex")}\n`, "utf8");
		await handle.sync();
	} finally {
		await handle.close();
	}
	let released = false;
	return async () => {
		if (released) return;
		released = true;
		await rm(lockPath, { force: true });
	};
}

function isNodeError(error: unknown, code: string): boolean {
	return error instanceof Error && "code" in error && error.code === code;
}
