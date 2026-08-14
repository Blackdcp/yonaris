export type LocalDemoImportScopePromotion = {
	brandId: string;
	scopeId: string;
};

export type LocalDemoImportCitation = {
	url: string;
	title: string;
	citationIndex: number;
};

export type LocalDemoImportObservation = {
	externalId: string;
	promptIndex: 1 | 2 | 3;
	sampleIndex: number;
	promptText: string;
	answerText: string;
	observedAt: string;
	pageUrl: string;
	answerCharacters: number;
	webSearchObserved: true;
	webQueries: string[];
	citations: LocalDemoImportCitation[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string, min: number, max: number): string {
	const value = record[key];
	if (typeof value !== "string" || value.length < min || value.length > max) {
		throw new Error(`Invalid ${key}`);
	}
	return value;
}

function integerField(record: Record<string, unknown>, key: string, min: number, max: number): number {
	const value = record[key];
	if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
		throw new Error(`Invalid ${key}`);
	}
	return value;
}

function parseStringList(record: Record<string, unknown>, key: string, min: number, max: number): string[] {
	const value = record[key];
	if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(`Invalid ${key}`);
	const strings = value.map((item) => {
		if (typeof item !== "string" || item.trim().length < 1 || item.length > 1_000) {
			throw new Error(`Invalid ${key}`);
		}
		return item.trim();
	});
	if (new Set(strings.map((item) => item.normalize("NFKC").toLocaleLowerCase("zh-CN"))).size !== strings.length) {
		throw new Error(`Duplicate ${key}`);
	}
	return strings;
}

function parseCitations(record: Record<string, unknown>): LocalDemoImportCitation[] {
	const value = record.citations;
	if (!Array.isArray(value) || value.length < 1 || value.length > 100) throw new Error("Invalid citations");
	const citations = value.map((item, index) => {
		if (!isRecord(item)) throw new Error("Invalid citation");
		const url = stringField(item, "url", 1, 10_000);
		const parsedUrl = new URL(url);
		if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") throw new Error("Invalid citation URL");
		const title = stringField(item, "title", 1, 2_000).trim();
		if (title.length < 1) throw new Error("Invalid citation title");
		const citationIndex = integerField(item, "citationIndex", 0, 32_767);
		if (citationIndex !== index) throw new Error("Citation indexes must be contiguous and zero based");
		return { url, title, citationIndex };
	});
	if (new Set(citations.map((citation) => citation.url)).size !== citations.length) {
		throw new Error("Duplicate citation URL");
	}
	return citations;
}

export function parseLocalDemoImportObservation(value: unknown): LocalDemoImportObservation {
	if (!isRecord(value)) throw new Error("Observation must be an object");
	const externalId = stringField(value, "externalId", 1, 200);
	if (!externalId.startsWith("stepfun-local-pc-demo-20260814-")) throw new Error("Unexpected external id");
	const promptIndex = integerField(value, "promptIndex", 1, 3) as 1 | 2 | 3;
	const sampleIndex = integerField(value, "sampleIndex", 1, 32_767);
	const promptText = stringField(value, "promptText", 1, 50_000);
	const answerText = stringField(value, "answerText", 1, 500_000);
	if (answerText.normalize("NFKC") === promptText.normalize("NFKC")) {
		throw new Error("Answer must not equal the prompt");
	}
	if (answerText.length < 200) throw new Error("Answer is too short to be a valid captured response");
	const observedAt = stringField(value, "observedAt", 1, 100);
	if (Number.isNaN(new Date(observedAt).getTime())) throw new Error("Invalid observedAt");
	const pageUrl = stringField(value, "pageUrl", 1, 10_000);
	const parsedPageUrl = new URL(pageUrl);
	if (
		parsedPageUrl.protocol !== "https:" ||
		parsedPageUrl.hostname !== "www.doubao.com" ||
		!/^\/chat\/\d+$/.test(parsedPageUrl.pathname) ||
		parsedPageUrl.search !== "" ||
		parsedPageUrl.hash !== ""
	) {
		throw new Error("Page URL must be a durable Doubao conversation URL");
	}
	const answerCharacters = integerField(value, "answerCharacters", 200, 500_000);
	if (answerCharacters !== answerText.length) throw new Error("Answer character count mismatch");
	if (value.webSearchObserved !== true) throw new Error("Local demo observation must prove web search was observed");
	const webQueries = parseStringList(value, "webQueries", 1, 32);
	const citations = parseCitations(value);
	const summary = answerText.split(/\r?\n/, 1)[0]?.match(/^搜索\s*(\d+)\s*个关键词，参考\s*(\d+)\s*篇资料$/);
	if (!summary || Number(summary[1]) !== webQueries.length || Number(summary[2]) !== citations.length) {
		throw new Error("Search detail count mismatch");
	}
	return {
		externalId,
		promptIndex,
		sampleIndex,
		promptText,
		answerText,
		observedAt,
		pageUrl,
		answerCharacters,
		webSearchObserved: true,
		webQueries,
		citations,
	};
}

export function assertLocalDemoImportObservationSet(observations: readonly LocalDemoImportObservation[]): void {
	if (observations.length !== 18) throw new Error("Import must contain the exact reviewed 3 by 6 slots");
	const promptTexts = new Map<number, string>();
	const slots = new Set<string>();
	for (const observation of observations) {
		const slot = `${observation.promptIndex}:${observation.sampleIndex}`;
		const sequence = (observation.sampleIndex - 1) * 3 + observation.promptIndex;
		const expectedExternalId = `stepfun-local-pc-demo-20260814-${String(sequence).padStart(2, "0")}-p${observation.promptIndex}-s${observation.sampleIndex}`;
		if (
			observation.sampleIndex < 1 ||
			observation.sampleIndex > 6 ||
			observation.externalId !== expectedExternalId ||
			slots.has(slot)
		) {
			throw new Error("Import must contain the exact reviewed 3 by 6 slots");
		}
		slots.add(slot);
		const normalizedPrompt = observation.promptText.normalize("NFKC");
		const priorPrompt = promptTexts.get(observation.promptIndex);
		if (priorPrompt !== undefined && priorPrompt !== normalizedPrompt) {
			throw new Error("Import must contain the exact reviewed 3 by 6 slots");
		}
		promptTexts.set(observation.promptIndex, normalizedPrompt);
	}
	if (slots.size !== 18 || promptTexts.size !== 3 || new Set(promptTexts.values()).size !== 3) {
		throw new Error("Import must contain the exact reviewed 3 by 6 slots");
	}
}

export function isLocalDemoStructuredDetailCurrent(
	metadata: Record<string, unknown>,
	sampleFingerprint: string,
): boolean {
	return metadata.structuredDetailRevision === 1 && metadata.sampleFingerprint === sampleFingerprint;
}

export function toLocalDemoCitations(citations: readonly LocalDemoImportCitation[]) {
	return citations.map((citation) => ({
		...citation,
		domain: new URL(citation.url).hostname.replace(/^www\./, "").toLowerCase(),
	}));
}

export function assertLocalDemoExistingObservationIdentity(
	existing: Record<string, unknown>,
	expected: Record<string, unknown>,
): void {
	const identityKeys = [
		"promptId",
		"brandId",
		"scopeId",
		"surfaceTargetKey",
		"captureRouteKey",
		"model",
		"provider",
		"version",
		"webSearchEnabled",
		"sampleIndex",
		"importId",
		"source",
	] as const;
	if (identityKeys.some((key) => existing[key] !== expected[key])) {
		throw new Error("Existing local demo observation identity mismatch");
	}
}

export function buildLocalDemoDefaultScopePromotion(input: {
	brandId: string;
	scopeId: string;
	importId: string;
	source: string;
}): LocalDemoImportScopePromotion {
	if (input.importId !== "stepfun-local-pc-doubao-demo-20260814" || input.source !== "local_pc_demo") {
		throw new Error("unsupported_local_demo_default_scope_promotion");
	}
	return { brandId: input.brandId, scopeId: input.scopeId };
}
