import { createHash } from "node:crypto";

const PROMPTS = [
	"国内有哪些主流大模型公司？",
	"国内有哪些大模型服务商？",
	"阶跃星辰 StepFun 是一家什么公司？",
] as const;

type PromptIndex = 1 | 2 | 3;
type SampleIndex = 1 | 2 | 3 | 4 | 5 | 6;

export type ReviewedConsumerObservation = {
	externalId: string;
	promptIndex: PromptIndex;
	sampleIndex: SampleIndex;
	promptText: (typeof PROMPTS)[number];
	answerText: string;
	observedAt: string;
	pageUrl: string;
	webSearchObserved: boolean | null;
	webQueries: string[];
	citations: Array<{ url: string; title: string; citationIndex: number }>;
	evidence: { screenshotSha256: string; pageSnapshotSha256: string };
};

export type ReviewedConsumerCohort = {
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
	observations: ReviewedConsumerObservation[];
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

export function parseReviewedConsumerCohort(value: unknown): ReviewedConsumerCohort {
	assertNoSecretShapedFields(value);
	const record = objectValue(value, "Reviewed cohort must be an object");
	assertExactKeys(record, MANIFEST_KEYS, "Reviewed cohort");
	for (const [key, expected] of Object.entries({
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
	})) {
		if (record[key] !== expected) throw new Error("Manifest does not match the frozen DeepSeek contract");
	}
	if (!Array.isArray(record.observations)) throw new Error("Import must contain the exact reviewed 3 by 6 cohort");
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

export function reviewedConsumerCohortFingerprint(manifest: ReviewedConsumerCohort): string {
	return createHash("sha256")
		.update(canonicalJson(parseReviewedConsumerCohort(manifest)), "utf8")
		.digest("hex");
}

export function buildReviewedConsumerSourceKey(observation: ReviewedConsumerObservation): string {
	return `reviewed-consumer-cohort:stepfun-local-pc-deepseek-18-20260814:${observation.externalId}`;
}

function parseObservation(value: unknown): ReviewedConsumerObservation {
	const record = objectValue(value, "Reviewed observation must be an object");
	assertExactKeys(record, OBSERVATION_KEYS, "Reviewed observation");
	const promptIndex = integer(record.promptIndex, 1, 3, "promptIndex") as PromptIndex;
	const sampleIndex = integer(record.sampleIndex, 1, 6, "sampleIndex") as SampleIndex;
	const promptText = stringValue(record.promptText, 1, 50_000, "promptText");
	const answerText = stringValue(record.answerText, 1, 500_000, "answerText");
	if (!answerText.trim() || answerText.normalize("NFKC") === promptText.normalize("NFKC")) {
		throw new Error("Answer must be a valid completed response");
	}
	const observedAt = stringValue(record.observedAt, 1, 100, "observedAt");
	if (Number.isNaN(new Date(observedAt).getTime())) throw new Error("Invalid observedAt");
	const pageUrl = stringValue(record.pageUrl, 1, 10_000, "pageUrl");
	assertDeepSeekConversationUrl(pageUrl);
	if (record.webSearchObserved !== null && typeof record.webSearchObserved !== "boolean") {
		throw new Error("Invalid webSearchObserved");
	}
	const webQueries = stringList(record.webQueries, 32, "webQueries");
	const citations = citationList(record.citations);
	const evidence = objectValue(record.evidence, "Invalid evidence");
	assertExactKeys(evidence, ["screenshotSha256", "pageSnapshotSha256"], "Reviewed evidence");
	const screenshotSha256 = stringValue(evidence.screenshotSha256, 64, 64, "evidence digest");
	const pageSnapshotSha256 = stringValue(evidence.pageSnapshotSha256, 64, 64, "evidence digest");
	if (!SHA256.test(screenshotSha256) || !SHA256.test(pageSnapshotSha256)) throw new Error("Invalid evidence digest");
	return {
		externalId: stringValue(record.externalId, 1, 200, "externalId"),
		promptIndex,
		sampleIndex,
		promptText: promptText as ReviewedConsumerObservation["promptText"],
		answerText,
		observedAt,
		pageUrl,
		webSearchObserved: record.webSearchObserved,
		webQueries,
		citations,
		evidence: { screenshotSha256, pageSnapshotSha256 },
	};
}

function assertExactObservationSet(observations: readonly ReviewedConsumerObservation[]): void {
	if (observations.length !== 18) throw new Error("Import must contain the exact reviewed 3 by 6 cohort");
	for (let index = 0; index < observations.length; index += 1) {
		const promptIndex = ((index % 3) + 1) as PromptIndex;
		const sampleIndex = (Math.floor(index / 3) + 1) as SampleIndex;
		const expectedId = `stepfun-local-pc-deepseek-20260814-${String(index + 1).padStart(2, "0")}-p${promptIndex}-s${sampleIndex}`;
		const observation = observations[index];
		if (
			!observation ||
			observation.externalId !== expectedId ||
			observation.promptIndex !== promptIndex ||
			observation.sampleIndex !== sampleIndex ||
			observation.promptText !== PROMPTS[promptIndex - 1]
		) {
			throw new Error("Import must contain the exact reviewed 3 by 6 cohort");
		}
	}
}

function citationList(value: unknown): ReviewedConsumerObservation["citations"] {
	if (!Array.isArray(value) || value.length > 100) throw new Error("Invalid citations");
	const citations = value.map((item, index) => {
		const record = objectValue(item, "Invalid citation");
		assertExactKeys(record, ["url", "title", "citationIndex"], "Reviewed citation");
		const url = externalUrl(record.url, "citation URL");
		const title = stringValue(record.title, 1, 2_000, "citation title").trim();
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

function stringList(value: unknown, maximum: number, label: string): string[] {
	if (!Array.isArray(value) || value.length > maximum) throw new Error(`Invalid ${label}`);
	const values = value.map((item) => stringValue(item, 1, 2_000, label).trim());
	if (values.some((item) => !item)) throw new Error(`Invalid ${label}`);
	if (new Set(values.map((item) => item.normalize("NFKC").toLocaleLowerCase("zh-CN"))).size !== values.length) {
		throw new Error(`Duplicate ${label}`);
	}
	return values;
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

function externalUrl(value: unknown, label: string): string {
	const text = stringValue(value, 1, 10_000, label);
	const url = new URL(text);
	if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
		throw new Error(`Invalid ${label}`);
	}
	return text;
}

function assertNoSecretShapedFields(value: unknown): void {
	if (Array.isArray(value)) {
		for (const item of value) assertNoSecretShapedFields(item);
		return;
	}
	if (!isRecord(value)) return;
	for (const [key, nested] of Object.entries(value)) {
		if (SECRET_KEY.test(key)) throw new Error("Reviewed cohort contains a secret-shaped field");
		assertNoSecretShapedFields(nested);
	}
}

function integer(value: unknown, minimum: number, maximum: number, label: string): number {
	if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
		throw new Error(`Invalid ${label}`);
	}
	return value;
}

function stringValue(value: unknown, minimum: number, maximum: number, label: string): string {
	if (typeof value !== "string" || value.length < minimum || value.length > maximum) {
		throw new Error(`Invalid ${label}`);
	}
	return value;
}

function objectValue(value: unknown, message: string): Record<string, unknown> {
	if (!isRecord(value)) throw new Error(message);
	return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(record: Record<string, unknown>, expectedKeys: readonly string[], label: string): void {
	const expected = [...expectedKeys].sort();
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
