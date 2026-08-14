import type { SurfaceResponse } from "../contracts.js";

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
