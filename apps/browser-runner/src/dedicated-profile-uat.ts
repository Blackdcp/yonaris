import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, open, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { BrowserContext, Page } from "playwright";
import { dedicatedProfileDirectory } from "./dedicated-profile.js";
import { BrowserRunnerError } from "./errors.js";
import { type PersistentContextLauncher, sandboxedPersistentContext } from "./sandbox-preflight.js";

const DOUBAO_URL = "https://www.doubao.com/chat/";
const KNOWN_COMPOSER_SELECTOR = 'textarea.semi-input-textarea[placeholder="发消息..."]';
const READY_MARKER = ".yonaris-dedicated-profile.json";
const UAT_INTENT_MARKER = ".yonaris-uat-once.intent.json";
const ANONYMOUS_UAT_INTENT_MARKER = ".yonaris-anonymous-uat-once.intent.json";
const ANONYMOUS_UAT_PROMPT = "\u8bf7\u4ec5\u56de\u590d\uff1a\u6d4b\u8bd5\u901a\u8fc7\u3002";
const UAT_PROMPT = "请仅回复：测试通过。";
const MAXIMUM_CANDIDATES = 64;
const MAXIMUM_RAW_CANDIDATES = 512;
const MAXIMUM_NODE_COUNT = 10_000;

const SAFE_SELECTOR_TOKENS = new Set([
	"account",
	"answer",
	"assistant",
	"avatar",
	"button",
	"chat",
	"composer",
	"content",
	"conversation",
	"create",
	"generation",
	"generating",
	"input",
	"loading",
	"main",
	"message",
	"nav",
	"navigation",
	"new",
	"progress",
	"response",
	"send",
	"sidebar",
	"stop",
	"textbox",
	"user",
]);

const SAFE_ROLES = new Set([
	"article",
	"button",
	"dialog",
	"listitem",
	"main",
	"navigation",
	"progressbar",
	"status",
	"textbox",
]);

export type SanitizedSelectorCandidate = {
	selector: string;
	count: number;
	visibleCount: number;
};

export type SelectorSnapshotCollector = (page: Page) => Promise<unknown>;

type UatBrowserOptions = {
	launcher?: PersistentContextLauncher;
	collector?: SelectorSnapshotCollector;
	sleep?: (milliseconds: number) => Promise<void>;
	maximumPolls?: number;
};

export async function openDedicatedDoubaoLoginWindow(
	stateDirectory: string,
	options: Pick<UatBrowserOptions, "launcher"> & { timeoutMs?: number } = {},
): Promise<{ status: "login_window_closed" | "login_window_timeout" }> {
	const profileDirectory = await prepareUnapprovedProfileDirectory(stateDirectory);
	const context = await launchProfile(profileDirectory, false, options.launcher);
	try {
		const page = context.pages()[0] ?? (await context.newPage());
		await page.goto(DOUBAO_URL, { waitUntil: "domcontentloaded" });
		try {
			await context.waitForEvent("close", { timeout: options.timeoutMs ?? 30 * 60_000 });
			return { status: "login_window_closed" };
		} catch (error) {
			if (isTimeoutError(error)) return { status: "login_window_timeout" };
			throw error;
		}
	} finally {
		await context.close().catch(() => undefined);
	}
}

export async function collectDedicatedDoubaoSelectorProbe(
	stateDirectory: string,
	options: Pick<UatBrowserOptions, "launcher" | "collector"> = {},
): Promise<{
	status: "login_required" | "session_available" | "page_unverified";
	allowedHost: boolean;
	loginActionVisible: boolean;
	knownComposerCount: number;
	knownComposerVisibleCount: number;
	candidates: SanitizedSelectorCandidate[];
}> {
	const profileDirectory = dedicatedProfileDirectory(stateDirectory);
	await mkdir(profileDirectory, { recursive: true, mode: 0o700 });
	await chmod(profileDirectory, 0o700);
	const context = await launchProfile(profileDirectory, true, options.launcher);
	try {
		const page = context.pages()[0] ?? (await context.newPage());
		await page.goto(DOUBAO_URL, { waitUntil: "domcontentloaded" });
		const state = await coarsePageState(page);
		const candidates = state.allowedHost
			? sanitizeSelectorCandidates(await (options.collector ?? collectBrowserCandidates)(page))
			: [];
		return {
			status: state.loginActionVisible
				? "login_required"
				: state.allowedHost && state.knownComposerCount === 1 && state.knownComposerVisibleCount === 1
					? "session_available"
					: "page_unverified",
			...state,
			candidates,
		};
	} finally {
		await context.close().catch(() => undefined);
	}
}

export async function runDedicatedDoubaoUatOnce(
	stateDirectory: string,
	options: UatBrowserOptions = {},
): Promise<{
	status: "structural_change_observed" | "prompt_submitted_no_safe_candidates";
	promptSubmitted: true;
	userMessageCandidates: SanitizedSelectorCandidate[];
	answerCandidates: SanitizedSelectorCandidate[];
	completionCandidates: SanitizedSelectorCandidate[];
}> {
	const profileDirectory = await prepareUnapprovedProfileDirectory(stateDirectory);
	await assertNoPriorUatIntent(profileDirectory);
	const context = await launchProfile(profileDirectory, false, options.launcher);
	try {
		const page = context.pages()[0] ?? (await context.newPage());
		await page.goto(DOUBAO_URL, { waitUntil: "domcontentloaded" });
		const pageState = await coarsePageState(page);
		if (pageState.loginActionVisible) {
			throw new BrowserRunnerError(
				"dedicated_profile_not_authenticated",
				"pre_submit",
				"needs_human",
				"The non-scored UAT stopped because the Doubao login action is visible",
			);
		}
		if (!pageState.allowedHost || pageState.knownComposerCount !== 1 || pageState.knownComposerVisibleCount !== 1) {
			throw new BrowserRunnerError(
				"adapter_unverified",
				"pre_submit",
				"needs_human",
				"The non-scored UAT requires exactly one visible known Doubao composer",
			);
		}

		const collector = options.collector ?? collectBrowserCandidates;
		const before = sanitizeSelectorCandidates(await collector(page));
		await writeDurableUatIntent(profileDirectory);
		const composer = page.locator(KNOWN_COMPOSER_SELECTOR);
		await composer.fill(UAT_PROMPT);
		await composer.press("Enter");

		const observations: SanitizedSelectorCandidate[][] = [];
		const maximumPolls = boundedPollCount(options.maximumPolls);
		const sleep =
			options.sleep ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
		for (let poll = 0; poll < maximumPolls; poll += 1) {
			await sleep(1_000);
			observations.push(sanitizeSelectorCandidates(await collector(page)));
		}
		const finalSnapshot = observations.at(-1) ?? before;
		const userMessageCandidates = increasedCandidates(before, finalSnapshot, "user_message");
		const answerCandidates = increasedCandidates(before, finalSnapshot, "answer");
		const completionCandidates = transientCandidates(before, observations, finalSnapshot, "completion");
		const changed = userMessageCandidates.length + answerCandidates.length + completionCandidates.length > 0;
		return {
			status: changed ? "structural_change_observed" : "prompt_submitted_no_safe_candidates",
			promptSubmitted: true,
			userMessageCandidates,
			answerCandidates,
			completionCandidates,
		};
	} finally {
		await context.close().catch(() => undefined);
	}
}

export async function runAnonymousDoubaoUatOnce(
	stateDirectory: string,
	options: UatBrowserOptions = {},
): Promise<{
	status: "structural_change_observed" | "prompt_submitted_no_safe_candidates";
	promptSubmitted: true;
	userMessageCandidates: SanitizedSelectorCandidate[];
	answerCandidates: SanitizedSelectorCandidate[];
	completionCandidates: SanitizedSelectorCandidate[];
}> {
	await mkdir(stateDirectory, { recursive: true, mode: 0o700 });
	await chmod(stateDirectory, 0o700);
	await assertNoPriorMarker(path.join(stateDirectory, ANONYMOUS_UAT_INTENT_MARKER));
	const profileRoot = path.join(stateDirectory, "anonymous-uat-profiles");
	await mkdir(profileRoot, { recursive: true, mode: 0o700 });
	await chmod(profileRoot, 0o700);
	const profileDirectory = await mkdtemp(path.join(profileRoot, "attempt-"));
	await chmod(profileDirectory, 0o700);
	let context: BrowserContext | undefined;
	try {
		context = await launchProfile(profileDirectory, true, options.launcher);
		const page = context.pages()[0] ?? (await context.newPage());
		await page.goto(DOUBAO_URL, { waitUntil: "domcontentloaded" });
		const pageState = await coarsePageState(page);
		if (!pageState.loginActionVisible) {
			throw new BrowserRunnerError(
				"anonymous_session_not_verified",
				"pre_submit",
				"needs_human",
				"The anonymous UAT requires a visible signed-out Doubao login action",
			);
		}
		if (!pageState.allowedHost || pageState.knownComposerCount !== 1 || pageState.knownComposerVisibleCount !== 1) {
			throw new BrowserRunnerError(
				"adapter_unverified",
				"pre_submit",
				"needs_human",
				"The anonymous UAT requires exactly one visible known Doubao composer",
			);
		}

		const collector = options.collector ?? collectBrowserCandidates;
		const before = sanitizeSelectorCandidates(await collector(page));
		await writeDurableAnonymousUatIntent(stateDirectory);
		const composer = page.locator(KNOWN_COMPOSER_SELECTOR);
		await composer.fill(ANONYMOUS_UAT_PROMPT);
		await composer.press("Enter");

		const observations: SanitizedSelectorCandidate[][] = [];
		const maximumPolls = boundedPollCount(options.maximumPolls);
		const sleep =
			options.sleep ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
		for (let poll = 0; poll < maximumPolls; poll += 1) {
			await sleep(1_000);
			observations.push(sanitizeSelectorCandidates(await collector(page)));
		}
		const finalSnapshot = observations.at(-1) ?? before;
		const userMessageCandidates = increasedCandidates(before, finalSnapshot, "user_message");
		const answerCandidates = increasedCandidates(before, finalSnapshot, "answer");
		const completionCandidates = transientCandidates(before, observations, finalSnapshot, "completion");
		const changed = userMessageCandidates.length + answerCandidates.length + completionCandidates.length > 0;
		return {
			status: changed ? "structural_change_observed" : "prompt_submitted_no_safe_candidates",
			promptSubmitted: true,
			userMessageCandidates,
			answerCandidates,
			completionCandidates,
		};
	} finally {
		await context?.close().catch(() => undefined);
		await rm(profileDirectory, { recursive: true, force: true });
	}
}

export function sanitizeSelectorCandidates(input: unknown): SanitizedSelectorCandidate[] {
	if (!Array.isArray(input)) return [];
	const unique = new Map<string, SanitizedSelectorCandidate>();
	for (const raw of input.slice(0, MAXIMUM_RAW_CANDIDATES)) {
		if (!raw || typeof raw !== "object") continue;
		const record = raw as Record<string, unknown>;
		const selector = typeof record.selector === "string" ? record.selector : "";
		if (!safeSelector(selector)) continue;
		const count = boundedNodeCount(record.count);
		const visibleCount = Math.min(count, boundedNodeCount(record.visibleCount));
		const existing = unique.get(selector);
		if (!existing) unique.set(selector, { selector, count, visibleCount });
		else {
			existing.count = Math.max(existing.count, count);
			existing.visibleCount = Math.max(existing.visibleCount, visibleCount);
		}
		if (unique.size >= MAXIMUM_CANDIDATES) break;
	}
	return [...unique.values()].sort((left, right) => left.selector.localeCompare(right.selector));
}

async function launchProfile(
	profileDirectory: string,
	headless: boolean,
	launcher?: PersistentContextLauncher,
): Promise<BrowserContext> {
	return sandboxedPersistentContext(
		profileDirectory,
		{
			headless,
			locale: "zh-CN",
			timezoneId: "Asia/Shanghai",
			viewport: { width: 1_440, height: 900 },
		},
		launcher,
	);
}

async function prepareUnapprovedProfileDirectory(stateDirectory: string): Promise<string> {
	const profileDirectory = dedicatedProfileDirectory(stateDirectory);
	await mkdir(profileDirectory, { recursive: true, mode: 0o700 });
	await chmod(profileDirectory, 0o700);
	try {
		await stat(path.join(profileDirectory, READY_MARKER));
	} catch (error) {
		if (isMissingFile(error)) return profileDirectory;
		throw error;
	}
	throw new Error("The dedicated profile is already formally provisioned; login/UAT discovery is closed");
}

async function assertNoPriorUatIntent(profileDirectory: string): Promise<void> {
	await assertNoPriorMarker(path.join(profileDirectory, UAT_INTENT_MARKER));
}

async function assertNoPriorMarker(markerPath: string): Promise<void> {
	try {
		await stat(markerPath);
	} catch (error) {
		if (isMissingFile(error)) return;
		throw error;
	}
	throw new Error("The non-scored selector UAT is one-shot and was already attempted");
}

async function writeDurableUatIntent(profileDirectory: string): Promise<void> {
	const markerPath = path.join(profileDirectory, UAT_INTENT_MARKER);
	const handle = await open(markerPath, "wx", 0o600).catch((error) => {
		if (isFileExists(error)) throw new Error("The non-scored selector UAT is one-shot and was already attempted");
		throw error;
	});
	try {
		await handle.writeFile(
			`${JSON.stringify({
				schemaVersion: 1,
				purpose: "selector_discovery_non_scored",
				promptSha256: createHash("sha256").update(UAT_PROMPT).digest("hex"),
				createdAt: new Date().toISOString(),
			})}\n`,
			"utf8",
		);
		await handle.chmod(0o600);
		await handle.sync();
	} finally {
		await handle.close();
	}
	if (process.platform !== "win32") {
		const directory = await open(profileDirectory, "r");
		try {
			await directory.sync();
		} finally {
			await directory.close();
		}
	}
}

async function writeDurableAnonymousUatIntent(stateDirectory: string): Promise<void> {
	const markerPath = path.join(stateDirectory, ANONYMOUS_UAT_INTENT_MARKER);
	const handle = await open(markerPath, "wx", 0o600).catch((error) => {
		if (isFileExists(error)) throw new Error("The anonymous non-scored UAT is one-shot and was already attempted");
		throw error;
	});
	try {
		await handle.writeFile(
			`${JSON.stringify({
				schemaVersion: 1,
				purpose: "selector_discovery_non_scored",
				sessionRequirement: "anonymous_clean",
				promptSha256: createHash("sha256").update(ANONYMOUS_UAT_PROMPT).digest("hex"),
				createdAt: new Date().toISOString(),
			})}\n`,
			"utf8",
		);
		await handle.chmod(0o600);
		await handle.sync();
	} finally {
		await handle.close();
	}
	if (process.platform !== "win32") {
		const directory = await open(stateDirectory, "r");
		try {
			await directory.sync();
		} finally {
			await directory.close();
		}
	}
}

async function coarsePageState(page: Page): Promise<{
	allowedHost: boolean;
	loginActionVisible: boolean;
	knownComposerCount: number;
	knownComposerVisibleCount: number;
}> {
	const composer = page.locator(KNOWN_COMPOSER_SELECTOR);
	const knownComposerCount = boundedNodeCount(await composer.count());
	const knownComposerVisibleCount = knownComposerCount === 1 && (await composer.isVisible().catch(() => false)) ? 1 : 0;
	const loginActionVisible = await page
		.getByRole("button", { name: "登录", exact: true })
		.isVisible()
		.catch(() => false);
	return {
		allowedHost: allowedDoubaoUrl(page.url()),
		loginActionVisible,
		knownComposerCount,
		knownComposerVisibleCount,
	};
}

const collectBrowserCandidates: SelectorSnapshotCollector = async (page) =>
	page.evaluate(() => {
		const candidates = new Map<string, { selector: string; count: number; visibleCount: number }>();
		const add = (selector: string) => {
			if (candidates.has(selector) || candidates.size >= 512) return;
			let nodes: Element[];
			try {
				nodes = [...document.querySelectorAll(selector)];
			} catch {
				return;
			}
			const visibleCount = nodes.filter((node) => {
				const rectangle = node.getBoundingClientRect();
				const style = getComputedStyle(node);
				return rectangle.width > 0 && rectangle.height > 0 && style.display !== "none" && style.visibility !== "hidden";
			}).length;
			candidates.set(selector, { selector, count: nodes.length, visibleCount });
		};
		for (const element of document.querySelectorAll("[data-testid],[data-e2e],[data-qa],[role],[class]")) {
			for (const attribute of ["data-testid", "data-e2e", "data-qa", "role"] as const) {
				const value = element.getAttribute(attribute);
				if (value && /^[a-z][a-z0-9_-]{1,63}$/.test(value)) add(`[${attribute}="${value}"]`);
			}
			for (const className of element.classList) {
				if (/^[a-z][a-z0-9_-]{1,63}$/.test(className)) add(`.${className}`);
			}
		}
		return [...candidates.values()];
	});

function safeSelector(selector: string): boolean {
	if (selector.length < 3 || selector.length > 100) return false;
	const attribute = selector.match(/^\[(data-testid|data-e2e|data-qa)="([a-z][a-z0-9_-]{1,63})"\]$/);
	if (attribute) return safeNeutralValue(attribute[2] ?? "");
	const role = selector.match(/^\[role="([a-z]{2,24})"\]$/);
	if (role) return SAFE_ROLES.has(role[1] ?? "");
	const className = selector.match(/^\.([a-z][a-z0-9_-]{1,63})$/);
	return className ? safeNeutralValue(className[1] ?? "") : false;
}

function safeNeutralValue(value: string): boolean {
	const tokens = value.split(/[-_]+/);
	return tokens.length > 0 && tokens.every((token) => SAFE_SELECTOR_TOKENS.has(token));
}

function candidateKind(selector: string): "user_message" | "answer" | "completion" | "other" {
	const tokens = new Set(
		selector
			.toLowerCase()
			.split(/[^a-z]+/)
			.filter(Boolean),
	);
	if (tokens.has("user") && tokens.has("message")) return "user_message";
	if (tokens.has("assistant") || tokens.has("answer") || tokens.has("response")) return "answer";
	if (
		tokens.has("stop") ||
		tokens.has("generation") ||
		tokens.has("generating") ||
		tokens.has("loading") ||
		tokens.has("progress")
	)
		return "completion";
	return "other";
}

function increasedCandidates(
	before: SanitizedSelectorCandidate[],
	after: SanitizedSelectorCandidate[],
	kind: "user_message" | "answer",
): SanitizedSelectorCandidate[] {
	const baseline = new Map(before.map((candidate) => [candidate.selector, candidate.count]));
	return after.filter(
		(candidate) =>
			candidateKind(candidate.selector) === kind && candidate.count > (baseline.get(candidate.selector) ?? 0),
	);
}

function transientCandidates(
	before: SanitizedSelectorCandidate[],
	observations: SanitizedSelectorCandidate[][],
	after: SanitizedSelectorCandidate[],
	kind: "completion",
): SanitizedSelectorCandidate[] {
	const baseline = new Map(before.map((candidate) => [candidate.selector, candidate.count]));
	const final = new Map(after.map((candidate) => [candidate.selector, candidate.count]));
	const maximum = new Map<string, SanitizedSelectorCandidate>();
	for (const snapshot of observations) {
		for (const candidate of snapshot) {
			if (candidateKind(candidate.selector) !== kind) continue;
			const prior = maximum.get(candidate.selector);
			if (!prior || candidate.count > prior.count) maximum.set(candidate.selector, candidate);
		}
	}
	return [...maximum.values()]
		.filter(
			(candidate) =>
				candidate.count > (baseline.get(candidate.selector) ?? 0) &&
				(final.get(candidate.selector) ?? 0) < candidate.count,
		)
		.sort((left, right) => left.selector.localeCompare(right.selector));
}

function allowedDoubaoUrl(value: string): boolean {
	try {
		const url = new URL(value);
		const hostname = url.hostname.toLowerCase();
		return (
			url.protocol === "https:" &&
			url.port === "" &&
			url.username === "" &&
			url.password === "" &&
			(hostname === "doubao.com" || hostname.endsWith(".doubao.com"))
		);
	} catch {
		return false;
	}
}

function boundedNodeCount(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value)
		? Math.max(0, Math.min(MAXIMUM_NODE_COUNT, Math.floor(value)))
		: 0;
}

function boundedPollCount(value: number | undefined): number {
	if (value === undefined) return 120;
	if (!Number.isInteger(value) || value < 1 || value > 300) throw new Error("maximumPolls must be between 1 and 300");
	return value;
}

function isTimeoutError(error: unknown): boolean {
	return error instanceof Error && (/TimeoutError/i.test(error.name) || /timeout/i.test(error.message));
}

function isMissingFile(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function isFileExists(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "EEXIST";
}
