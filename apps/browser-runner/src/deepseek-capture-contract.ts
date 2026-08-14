import { createHash } from "node:crypto";

export const STEPFUN_DEEPSEEK_PROMPTS = [
	"国内有哪些主流大模型公司？",
	"国内有哪些大模型服务商？",
	"阶跃星辰 StepFun 是一家什么公司？",
] as const;

type PromptIndex = 1 | 2 | 3;
type SampleIndex = 1 | 2 | 3 | 4 | 5 | 6;

export type DeepSeekSlot = {
	externalId: string;
	promptIndex: PromptIndex;
	sampleIndex: SampleIndex;
	promptText: (typeof STEPFUN_DEEPSEEK_PROMPTS)[number];
};

export type DeepSeekCitation = {
	url: string;
	title: string;
	citationIndex: number;
};

export type DeepSeekCapturedObservation = DeepSeekSlot & {
	answerText: string;
	observedAt: string;
	pageUrl: string;
	webSearchObserved: boolean | null;
	webQueries: string[];
	citations: DeepSeekCitation[];
	evidence: {
		screenshotSha256: string;
		pageSnapshotSha256: string;
	};
};

export type DeepSeekReviewedManifest = {
	schemaVersion: 1;
	importId: "stepfun-local-pc-deepseek-18-20260814";
	brandId: "stepfun";
	scopeKey: "cn-zh-scored";
	market: "CN";
	locale: "zh-CN";
	timezone: "Asia/Shanghai";
	evaluationRole: "scored";
	model: "deepseek";
	surfaceTargetKey: "deepseek.consumer_web";
	captureRouteKey: "assisted_browser.generic";
	sessionMode: "dedicated_sampling_profile";
	searchMode: "native_auto";
	observations: DeepSeekCapturedObservation[];
};

const MANIFEST_KEYS = [
	"schemaVersion",
	"importId",
	"brandId",
	"scopeKey",
	"market",
	"locale",
	"timezone",
	"evaluationRole",
	"model",
	"surfaceTargetKey",
	"captureRouteKey",
	"sessionMode",
	"searchMode",
	"observations",
] as const;

const OBSERVATION_KEYS = [
	"externalId",
	"promptIndex",
	"sampleIndex",
	"promptText",
	"answerText",
	"observedAt",
	"pageUrl",
	"webSearchObserved",
	"webQueries",
	"citations",
	"evidence",
] as const;

const SECRET_KEY = /password|token|cookie|storage|phone|authorization/i;
const SHA256 = /^[0-9a-f]{64}$/;

export function buildDeepSeekSlots(): DeepSeekSlot[] {
	const slots: DeepSeekSlot[] = [];
	for (let sampleIndex = 1 as SampleIndex; sampleIndex <= 6; sampleIndex = (sampleIndex + 1) as SampleIndex) {
		for (let promptIndex = 1 as PromptIndex; promptIndex <= 3; promptIndex = (promptIndex + 1) as PromptIndex) {
			const sequence = (sampleIndex - 1) * 3 + promptIndex;
			slots.push({
				externalId: `stepfun-local-pc-deepseek-20260814-${String(sequence).padStart(2, "0")}-p${promptIndex}-s${sampleIndex}`,
				promptIndex,
				sampleIndex,
				promptText: STEPFUN_DEEPSEEK_PROMPTS[promptIndex - 1],
			});
		}
	}
	return slots;
}

export function parseDeepSeekReviewedManifest(value: unknown): DeepSeekReviewedManifest {
	assertNoSecretShapedFields(value);
	const record = recordValue(value, "Manifest must be an object");
	assertExactKeys(record, MANIFEST_KEYS, "DeepSeek manifest");
	assertLiteral(record.schemaVersion, 1);
	assertLiteral(record.importId, "stepfun-local-pc-deepseek-18-20260814");
	assertLiteral(record.brandId, "stepfun");
	assertLiteral(record.scopeKey, "cn-zh-scored");
	assertLiteral(record.market, "CN");
	assertLiteral(record.locale, "zh-CN");
	assertLiteral(record.timezone, "Asia/Shanghai");
	assertLiteral(record.evaluationRole, "scored");
	assertLiteral(record.model, "deepseek");
	assertLiteral(record.surfaceTargetKey, "deepseek.consumer_web");
	assertLiteral(record.captureRouteKey, "assisted_browser.generic");
	assertLiteral(record.sessionMode, "dedicated_sampling_profile");
	assertLiteral(record.searchMode, "native_auto");
	if (!Array.isArray(record.observations)) throw new Error("DeepSeek contract requires observations");
	const observations = record.observations.map(parseObservation);
	assertExactObservationSet(observations);
	return {
		schemaVersion: 1,
		importId: "stepfun-local-pc-deepseek-18-20260814",
		brandId: "stepfun",
		scopeKey: "cn-zh-scored",
		market: "CN",
		locale: "zh-CN",
		timezone: "Asia/Shanghai",
		evaluationRole: "scored",
		model: "deepseek",
		surfaceTargetKey: "deepseek.consumer_web",
		captureRouteKey: "assisted_browser.generic",
		sessionMode: "dedicated_sampling_profile",
		searchMode: "native_auto",
		observations,
	};
}

export function deepSeekManifestFingerprint(manifest: DeepSeekReviewedManifest): string {
	const canonical = canonicalJson(parseDeepSeekReviewedManifest(manifest));
	return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function parseObservation(value: unknown): DeepSeekCapturedObservation {
	const record = recordValue(value, "DeepSeek observation must be an object");
	assertExactKeys(record, OBSERVATION_KEYS, "DeepSeek observation");
	const promptIndex = integer(record.promptIndex, 1, 3, "promptIndex") as PromptIndex;
	const sampleIndex = integer(record.sampleIndex, 1, 6, "sampleIndex") as SampleIndex;
	const promptText = boundedString(record.promptText, 1, 50_000, "promptText");
	const answerText = boundedString(record.answerText, 1, 500_000, "answerText");
	if (answerText.trim().length === 0 || answerText.normalize("NFKC") === promptText.normalize("NFKC")) {
		throw new Error("DeepSeek answer must be a valid completed response");
	}
	const observedAt = boundedString(record.observedAt, 1, 100, "observedAt");
	if (Number.isNaN(new Date(observedAt).getTime())) throw new Error("Invalid observedAt");
	const pageUrl = boundedString(record.pageUrl, 1, 10_000, "pageUrl");
	assertDeepSeekConversationUrl(pageUrl);
	if (record.webSearchObserved !== null && typeof record.webSearchObserved !== "boolean") {
		throw new Error("Invalid webSearchObserved");
	}
	const webQueries = parseUniqueStrings(record.webQueries, 32, "webQueries");
	const citations = parseCitations(record.citations);
	const evidence = recordValue(record.evidence, "Invalid evidence");
	assertExactKeys(evidence, ["screenshotSha256", "pageSnapshotSha256"], "DeepSeek evidence");
	const screenshotSha256 = boundedString(evidence.screenshotSha256, 64, 64, "evidence digest");
	const pageSnapshotSha256 = boundedString(evidence.pageSnapshotSha256, 64, 64, "evidence digest");
	if (!SHA256.test(screenshotSha256) || !SHA256.test(pageSnapshotSha256)) {
		throw new Error("Invalid evidence digest");
	}
	return {
		externalId: boundedString(record.externalId, 1, 200, "externalId"),
		promptIndex,
		sampleIndex,
		promptText: promptText as DeepSeekCapturedObservation["promptText"],
		answerText,
		observedAt,
		pageUrl,
		webSearchObserved: record.webSearchObserved,
		webQueries,
		citations,
		evidence: { screenshotSha256, pageSnapshotSha256 },
	};
}

function assertExactObservationSet(observations: DeepSeekCapturedObservation[]): void {
	const expected = buildDeepSeekSlots();
	if (observations.length !== expected.length) throw new Error("Import must contain the exact reviewed 3 by 6 cohort");
	for (let index = 0; index < expected.length; index += 1) {
		const actual = observations[index];
		const slot = expected[index];
		if (
			!actual ||
			!slot ||
			actual.externalId !== slot.externalId ||
			actual.promptIndex !== slot.promptIndex ||
			actual.sampleIndex !== slot.sampleIndex ||
			actual.promptText !== slot.promptText
		) {
			throw new Error("Import must contain the exact reviewed 3 by 6 cohort");
		}
	}
}

function parseCitations(value: unknown): DeepSeekCitation[] {
	if (!Array.isArray(value) || value.length > 100) throw new Error("Invalid citations");
	const citations = value.map((item, index) => {
		const record = recordValue(item, "Invalid citation");
		assertExactKeys(record, ["url", "title", "citationIndex"], "DeepSeek citation");
		const url = boundedString(record.url, 1, 10_000, "citation URL");
		const parsed = new URL(url);
		if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.username || parsed.password) {
			throw new Error("Invalid citation URL");
		}
		const title = boundedString(record.title, 1, 2_000, "citation title").trim();
		if (!title) throw new Error("Invalid citation title");
		if (integer(record.citationIndex, 0, 99, "citationIndex") !== index) {
			throw new Error("Citation indexes must be contiguous and zero based");
		}
		return { url, title, citationIndex: index };
	});
	if (new Set(citations.map((citation) => citation.url)).size !== citations.length) {
		throw new Error("Duplicate citation URL");
	}
	return citations;
}

function parseUniqueStrings(value: unknown, maximum: number, label: string): string[] {
	if (!Array.isArray(value) || value.length > maximum) throw new Error(`Invalid ${label}`);
	const strings = value.map((item) => boundedString(item, 1, 2_000, label).trim());
	if (strings.some((item) => !item)) throw new Error(`Invalid ${label}`);
	if (new Set(strings.map((item) => item.normalize("NFKC").toLocaleLowerCase("zh-CN"))).size !== strings.length) {
		throw new Error(`Duplicate ${label}`);
	}
	return strings;
}

function assertDeepSeekConversationUrl(value: string): void {
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
		throw new Error("Page URL must be a durable DeepSeek conversation URL");
	}
}

function assertNoSecretShapedFields(value: unknown): void {
	if (Array.isArray(value)) {
		for (const item of value) assertNoSecretShapedFields(item);
		return;
	}
	if (!isRecord(value)) return;
	for (const [key, nested] of Object.entries(value)) {
		if (SECRET_KEY.test(key)) throw new Error("Reviewed manifest contains a secret-shaped field");
		assertNoSecretShapedFields(nested);
	}
}

function assertLiteral<T extends string | number>(actual: unknown, expected: T): asserts actual is T {
	if (actual !== expected) throw new Error("Manifest does not match the frozen DeepSeek contract");
}

function integer(value: unknown, minimum: number, maximum: number, label: string): number {
	if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
		throw new Error(`Invalid ${label}`);
	}
	return value;
}

function boundedString(value: unknown, minimum: number, maximum: number, label: string): string {
	if (typeof value !== "string" || value.length < minimum || value.length > maximum) {
		throw new Error(`Invalid ${label}`);
	}
	return value;
}

function recordValue(value: unknown, message: string): Record<string, unknown> {
	if (!isRecord(value)) throw new Error(message);
	return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(record: Record<string, unknown>, allowed: readonly string[], label: string): void {
	const expected = [...allowed].sort();
	const actual = Object.keys(record).sort();
	if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
		throw new Error(`${label} contains unexpected or missing fields`);
	}
}

function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
	if (isRecord(value)) {
		return `{${Object.keys(value)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}
