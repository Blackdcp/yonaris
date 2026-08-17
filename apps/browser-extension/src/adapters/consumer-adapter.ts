import type {
	AnswerDomSnapshot,
	CollectedAnswer,
	CollectedCitation,
	ConsumerDomPort,
	ConsumerWebAdapter,
	DomElementRole,
	DomElementSummary,
	SelectorContract,
} from "./contracts";
import { AdapterError } from "./contracts";

const PROMPT_MAX_CHARACTERS = 20_000;
const ANSWER_MAX_CHARACTERS = 500_000;
const QUERY_MAX_COUNT = 32;
const CITATION_MAX_COUNT = 100;
const CONFIRM_TIMEOUT_MS = 30_000;
const RESPONSE_TIMEOUT_MS = 180_000;
const STABLE_ANSWER_MS = 8_000;
const POLL_INTERVAL_MS = 250;
const PAGE_READY_TIMEOUT_MS = 15_000;
const NEW_CONVERSATION_TIMEOUT_MS = 15_000;

export function createConsumerAdapter(port: ConsumerDomPort, contract: SelectorContract): ConsumerWebAdapter {
	return new ConsumerAdapter(port, validateSelectorContract(contract));
}

class ConsumerAdapter implements ConsumerWebAdapter {
	readonly surface;
	readonly launchUrl;
	readonly adapterVersion;
	readonly #port: ConsumerDomPort;
	readonly #contract: SelectorContract;
	#answerCountBeforeSubmit = 0;
	#preparedPrompt: string | null = null;
	#submitted = false;

	constructor(port: ConsumerDomPort, contract: SelectorContract) {
		this.#port = port;
		this.#contract = contract;
		this.surface = contract.surface;
		this.launchUrl = contract.launchUrl;
		this.adapterVersion = contract.version;
	}

	async preflight(): Promise<void> {
		this.#assertApprovedUrl(false);
		await this.#waitForPageReady();
	}

	async openNewConversation(): Promise<void> {
		await this.preflight();
		const action = await this.#newConversationAction();
		await this.#port.click("new_conversation", this.#contract.newConversation, action.index);
		const timeoutAt = this.#port.now() + NEW_CONVERSATION_TIMEOUT_MS;
		while (this.#port.now() <= timeoutAt) {
			this.#assertApprovedUrl(false);
			await this.#assertUnblocked();
			const answers = visibleElements(await this.#port.query("answer", this.#contract.answer));
			const messages = visibleElements(await this.#port.query("user_message", this.#contract.userMessage));
			if (answers.length === 0 && messages.length === 0) return;
			await this.#port.wait(POLL_INTERVAL_MS);
		}
		throw this.#error("page_drift", "New conversation did not become a blank dialogue");
	}

	async prepare(promptText: string): Promise<void> {
		const prompt = validatePrompt(promptText);
		this.#assertApprovedUrl(false);
		await this.#assertUnblocked();
		await this.#waitForUniqueVisible("composer", this.#contract.composer);
		if (this.surface !== "doubao.consumer_web") await this.#waitForUniqueVisible("send", this.#contract.send);
		this.#answerCountBeforeSubmit = visibleElements(await this.#port.query("answer", this.#contract.answer)).length;
		this.#preparedPrompt = prompt;
	}

	async submitOnce(promptText: string): Promise<void> {
		const prompt = validatePrompt(promptText);
		if (this.#preparedPrompt !== prompt) throw this.#error("page_drift", "Prompt does not match the prepared task");
		if (this.#submitted) throw this.#error("post_submit_unknown", "Prompt submission was already attempted");
		await this.#assertUnblocked();
		const composer = await this.#waitForUniqueVisible("composer", this.#contract.composer);
		await this.#port.fill("composer", this.#contract.composer, composer.index, prompt);
		const send = await this.#waitForUniqueVisible("send", this.#contract.send);
		this.#submitted = true;
		await this.#port.click("send", this.#contract.send, send.index);
	}

	async confirmSubmitted(promptText: string): Promise<void> {
		const prompt = validatePrompt(promptText);
		if (!this.#submitted || this.#preparedPrompt !== prompt) {
			throw this.#error("post_submit_unknown", "Submission intent is not present in this page session");
		}
		const timeoutAt = this.#port.now() + CONFIRM_TIMEOUT_MS;
		while (this.#port.now() < timeoutAt) {
			await this.#assertUnblocked();
			const messages = visibleElements(await this.#port.query("user_message", this.#contract.userMessage));
			const latest = messages.at(-1)?.element.text;
			if (latest && normalizeText(latest) === normalizeText(prompt)) return;
			await this.#port.wait(POLL_INTERVAL_MS);
		}
		throw this.#error("post_submit_unknown", "The exact submitted prompt did not appear in the conversation");
	}

	async resumeSubmitted(promptText: string): Promise<void> {
		const prompt = validatePrompt(promptText);
		this.#submitted = true;
		this.#assertApprovedUrl(true);
		await this.#assertUnblocked();
		const messages = visibleElements(await this.#port.query("user_message", this.#contract.userMessage));
		if (messages.length !== 1 || normalizeText(messages[0]?.element.text ?? "") !== normalizeText(prompt)) {
			throw this.#error("post_submit_unknown", "Preserved conversation does not contain the exact submitted prompt");
		}
		const answers = visibleElements(await this.#port.query("answer", this.#contract.answer));
		if (answers.length > 1) {
			throw this.#error("page_drift", "Preserved conversation contains more than one answer container");
		}
		this.#preparedPrompt = prompt;
		this.#answerCountBeforeSubmit = 0;
	}

	async collectCurrentAnswer(): Promise<CollectedAnswer> {
		if (!this.#submitted) throw this.#error("post_submit_unknown", "Prompt was not submitted in this page session");
		const timeoutAt = this.#port.now() + RESPONSE_TIMEOUT_MS;
		let generatingSeen = false;
		let stableText = "";
		let stableSince = 0;
		let answerContainersAmbiguous = false;
		while (this.#port.now() < timeoutAt) {
			this.#assertApprovedUrl(false);
			await this.#assertUnblocked();
			const generating = visibleElements(await this.#port.query("generating", this.#contract.generating)).length;
			if (generating > 1) throw this.#error("page_drift", "Generation state is ambiguous");
			if (generating === 1) generatingSeen = true;
			const completion = this.#contract.completion
				? visibleElements(await this.#port.query("completion", this.#contract.completion)).length
				: 0;
			if (completion > 1) throw this.#error("page_drift", "Completion state is ambiguous");
			const answers = visibleElements(await this.#port.query("answer", this.#contract.answer));
			if (answers.length > this.#answerCountBeforeSubmit + 1) {
				answerContainersAmbiguous = true;
				stableText = "";
				stableSince = 0;
				await this.#port.wait(POLL_INTERVAL_MS);
				continue;
			}
			answerContainersAmbiguous = false;
			const latest = answers.at(-1)?.element.text.trim() ?? "";
			if (answers.length === this.#answerCountBeforeSubmit + 1 && latest) {
				if (latest !== stableText) {
					stableText = latest;
					stableSince = this.#port.now();
				} else if (
					(generatingSeen || completion === 1) &&
					generating === 0 &&
					this.#port.now() - stableSince >= STABLE_ANSWER_MS
				) {
					return this.#readAcceptedAnswer(answers.at(-1)?.index ?? -1, stableText);
				}
			}
			await this.#port.wait(POLL_INTERVAL_MS);
		}
		if (answerContainersAmbiguous) {
			throw this.#error("page_drift", "Submission still has more than one answer container after timeout");
		}
		throw this.#error("response_timeout", "Timed out waiting for one complete answer");
	}

	async #readAcceptedAnswer(answerIndex: number, expectedText: string): Promise<CollectedAnswer> {
		if (answerIndex < 0) throw this.#error("page_drift", "Current answer container disappeared");
		const snapshot = await this.#port.readAnswer({
			answerSelector: this.#contract.answer,
			answerIndex,
			searchUsedSelector: this.#contract.searchUsed,
			searchNotUsedSelector: this.#contract.searchNotUsed,
			citationLinkSelector: this.#contract.citationLink,
			queryItemSelector: this.#contract.queryItem,
		});
		const answerText = snapshot.text.trim();
		if (
			!answerText ||
			answerText.length > ANSWER_MAX_CHARACTERS ||
			normalizeText(answerText) !== normalizeText(expectedText)
		) {
			throw this.#error("page_drift", "Current answer container changed during capture");
		}
		return {
			answerText,
			answerHtml: snapshot.html,
			pageUrl: this.#approvedConversationUrl(),
			observedAt: new Date(this.#port.now()).toISOString(),
			webSearchObserved: this.#classifySearch(snapshot),
			webQueries: uniqueStrings(snapshot.webQueries, QUERY_MAX_COUNT, 2_000, "query"),
			citations: uniqueCitations(snapshot.citations),
			adapterVersion: this.adapterVersion,
		};
	}

	#classifySearch(snapshot: AnswerDomSnapshot): boolean | null {
		const used = snapshot.searchUsedCount;
		const notUsed = snapshot.searchNotUsedCount;
		if (
			!Number.isSafeInteger(used) ||
			!Number.isSafeInteger(notUsed) ||
			used < 0 ||
			notUsed < 0 ||
			used > 1 ||
			notUsed > 1 ||
			(used && notUsed)
		) {
			throw this.#error("page_drift", "Native search evidence is conflicting or ambiguous");
		}
		if (used === 1) return true;
		if (notUsed === 1) return false;
		return null;
	}

	async #assertUnblocked(): Promise<void> {
		const restrictedPattern = new RegExp(this.#contract.accountRestrictedTextPattern, "iu");
		const restricted = visibleElements(await this.#port.query("account_restricted", this.#contract.accountRestricted));
		if (restricted.some(({ element }) => restrictedPattern.test(element.text))) {
			throw this.#error("account_restricted", "Consumer account is explicitly restricted");
		}
		for (const [role, selector, code] of [
			["captcha", this.#contract.captcha, "captcha"],
			["rate_limit", this.#contract.rateLimit, "rate_limited"],
			["login_wall", this.#contract.loginWall, "signed_out"],
		] as const) {
			if (visibleElements(await this.#port.query(role, selector)).length > 0) {
				throw this.#error(code, `Consumer page reported ${code}`);
			}
		}
	}

	async #waitForPageReady(): Promise<void> {
		const timeoutAt = this.#port.now() + PAGE_READY_TIMEOUT_MS;
		let lastComposerCount = 0;
		let lastSendCount = 0;
		let lastConversationActionCount = 0;
		while (this.#port.now() <= timeoutAt) {
			this.#assertApprovedUrl(false);
			await this.#assertUnblocked();
			const composer = visibleElements(await this.#port.query("composer", this.#contract.composer));
			const send =
				this.surface === "doubao.consumer_web"
					? [{ element: { text: "", visible: true }, index: 0 }]
					: visibleElements(await this.#port.query("send", this.#contract.send));
			const conversationActions = await this.#newConversationActions();
			lastComposerCount = composer.length;
			lastSendCount = send.length;
			lastConversationActionCount = conversationActions.length;
			if (composer.length === 1 && send.length === 1 && conversationActions.length === 1) return;
			await this.#port.wait(POLL_INTERVAL_MS);
		}
		throw this.#error(
			"page_drift",
			`Consumer page controls did not become uniquely ready (composer=${lastComposerCount}, send=${lastSendCount}, newConversation=${lastConversationActionCount})`,
		);
	}

	async #waitForUniqueVisible(
		role: DomElementRole,
		selector: string,
	): Promise<{ element: DomElementSummary; index: number }> {
		const timeoutAt = this.#port.now() + PAGE_READY_TIMEOUT_MS;
		while (this.#port.now() <= timeoutAt) {
			this.#assertApprovedUrl(false);
			await this.#assertUnblocked();
			const visible = visibleElements(await this.#port.query(role, selector));
			if (visible.length === 1) return visible[0];
			await this.#port.wait(POLL_INTERVAL_MS);
		}
		throw this.#error("page_drift", `${role} did not become unique and visible`);
	}

	async #newConversationAction(): Promise<{ element: DomElementSummary; index: number }> {
		const matching = await this.#newConversationActions();
		if (matching.length !== 1) throw this.#error("page_drift", "New conversation action is ambiguous or missing");
		return matching[0];
	}

	async #newConversationActions(): Promise<Array<{ element: DomElementSummary; index: number }>> {
		const visible = visibleElements(await this.#port.query("new_conversation", this.#contract.newConversation));
		const expected = this.#contract.newConversationLabel;
		return expected
			? visible.filter(({ element }) => normalizeText(element.text) === normalizeText(expected))
			: visible;
	}

	#assertApprovedUrl(requireConversation: boolean): void {
		const current = new URL(this.#port.currentUrl());
		const launch = new URL(this.#contract.launchUrl);
		const approvedHost =
			this.surface === "doubao.consumer_web"
				? current.hostname === "doubao.com" || current.hostname.endsWith(".doubao.com")
				: current.hostname === launch.hostname;
		if (
			current.protocol !== "https:" ||
			!approvedHost ||
			current.port ||
			current.username ||
			current.password ||
			current.search ||
			current.hash
		) {
			throw this.#error("page_drift", "Navigation left the approved consumer origin");
		}
		if (requireConversation && !new RegExp(this.#contract.conversationPathPattern, "u").test(current.pathname)) {
			throw this.#error("page_drift", "Consumer page did not create a durable conversation URL");
		}
	}

	#approvedConversationUrl(): string {
		this.#assertApprovedUrl(true);
		return this.#port.currentUrl();
	}

	#error(code: ConstructorParameters<typeof AdapterError>[0], message: string): AdapterError {
		return new AdapterError(code, this.#submitted ? "post_submit" : "pre_submit", message);
	}
}

function validateSelectorContract(contract: SelectorContract): SelectorContract {
	if (!/^[A-Za-z0-9._:-]{8,100}$/.test(contract.version)) throw new Error("Invalid adapter version");
	if (
		typeof contract.accountRestrictedTextPattern !== "string" ||
		!contract.accountRestrictedTextPattern ||
		contract.accountRestrictedTextPattern.length > 500
	) {
		throw new Error("Invalid account restriction text pattern");
	}
	try {
		new RegExp(contract.accountRestrictedTextPattern, "iu");
	} catch {
		throw new Error("Invalid account restriction text pattern");
	}
	const optionalSelectors = new Set(["completion", "searchUsed", "searchNotUsed", "citationLink", "queryItem"]);
	for (const [key, value] of Object.entries(contract)) {
		if (value === null && optionalSelectors.has(key)) continue;
		if (
			!key.toLowerCase().includes("url") &&
			!key.toLowerCase().includes("pattern") &&
			key !== "surface" &&
			key !== "version" &&
			key !== "newConversationLabel"
		) {
			if (
				typeof value !== "string" ||
				value.length < 2 ||
				value.length > 500 ||
				value.trim() !== value ||
				value === "*"
			) {
				throw new Error(`Invalid selector contract value: ${key}`);
			}
		}
	}
	return { ...contract };
}

function visibleElements(elements: readonly DomElementSummary[]): Array<{ element: DomElementSummary; index: number }> {
	return elements.flatMap((element, index) => (element.visible ? [{ element, index }] : []));
}

function validatePrompt(value: string): string {
	const prompt = value.trim();
	if (!prompt || prompt.length > PROMPT_MAX_CHARACTERS) throw new Error("Prompt is empty or too large");
	return prompt;
}

function normalizeText(value: string): string {
	return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function uniqueStrings(values: readonly string[], maximum: number, maxLength: number, label: string): string[] {
	if (values.length > maximum) throw new Error(`Too many ${label} values`);
	const result: string[] = [];
	const seen = new Set<string>();
	for (const value of values) {
		const trimmed = value.trim();
		if (!trimmed || trimmed.length > maxLength) throw new Error(`Invalid ${label}`);
		const identity = normalizeText(trimmed).toLocaleLowerCase("zh-CN");
		if (seen.has(identity)) continue;
		seen.add(identity);
		result.push(trimmed);
	}
	return result;
}

function uniqueCitations(values: readonly CollectedCitation[]): CollectedCitation[] {
	if (values.length > CITATION_MAX_COUNT) throw new Error("Too many citations");
	const result: CollectedCitation[] = [];
	const seen = new Set<string>();
	for (const citation of values) {
		const url = new URL(citation.url);
		if (
			(url.protocol !== "http:" && url.protocol !== "https:") ||
			url.username ||
			url.password ||
			citation.url.length > 10_000
		) {
			throw new Error("Invalid citation URL");
		}
		const title = citation.title.trim();
		if (!title || title.length > 2_000) throw new Error("Invalid citation title");
		if (seen.has(url.href)) continue;
		seen.add(url.href);
		result.push({ url: url.href, title });
	}
	return result;
}
