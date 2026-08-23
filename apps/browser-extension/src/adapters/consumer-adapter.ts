import type {
	AnswerDomSnapshot,
	CollectedAnswer,
	CollectedCitation,
	CompletionDomState,
	ConsumerDomPort,
	ConsumerWebAdapter,
	DomElementRole,
	DomElementSummary,
	SelectorContract,
} from "./contracts";
import { AdapterError } from "./contracts";
import { normalizeCitationTitle } from "./search-evidence";
import {
	fallbackUnknownSearchEvidence,
	type SearchEvidenceAdapter,
	type SearchEvidenceResult,
	validateSearchEvidenceResult,
} from "./search-evidence-adapter";

const PROMPT_MAX_CHARACTERS = 20_000;
const ANSWER_MAX_CHARACTERS = 500_000;
const QUERY_MAX_COUNT = 32;
const CITATION_MAX_COUNT = 100;
const CONFIRM_TIMEOUT_MS = 30_000;
const RESPONSE_TIMEOUT_MS = 180_000;
const ZHIPU_RESPONSE_TIMEOUT_MS = 12 * 60_000;
const STABLE_ANSWER_MS = 8_000;
const EVIDENCE_STABLE_MS = 2_000;
const EVIDENCE_POLL_INTERVAL_MS = 500;
const POLL_INTERVAL_MS = 250;
const CONFIRMED_CONVERSATION_STABILITY_MS = 1_000;
const PAGE_READY_TIMEOUT_MS = 15_000;
const NEW_CONVERSATION_TIMEOUT_MS = 15_000;
const SEND_APPEARS_AFTER_FILL_SURFACES = new Set(["qwen.consumer_web", "kimi.consumer_web", "yuanbao.consumer_web"]);

export function createConsumerAdapter(
	port: ConsumerDomPort,
	contract: SelectorContract,
	evidenceAdapter?: SearchEvidenceAdapter,
): ConsumerWebAdapter {
	return new ConsumerAdapter(port, validateSelectorContract(contract), evidenceAdapter);
}

class ConsumerAdapter implements ConsumerWebAdapter {
	readonly surface;
	readonly launchUrl;
	readonly adapterVersion;
	readonly #port: ConsumerDomPort;
	readonly #contract: SelectorContract;
	readonly #evidenceAdapter: SearchEvidenceAdapter | undefined;
	#answerCountBeforeSubmit = 0;
	#preparedPrompt: string | null = null;
	#submitted = false;
	#confirmedConversationUrl: string | null = null;

	constructor(port: ConsumerDomPort, contract: SelectorContract, evidenceAdapter?: SearchEvidenceAdapter) {
		this.#port = port;
		this.#contract = contract;
		this.#evidenceAdapter = evidenceAdapter;
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
		if (await this.#isBlankKimiLaunch()) return;
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
		if (this.surface !== "doubao.consumer_web" && !SEND_APPEARS_AFTER_FILL_SURFACES.has(this.surface)) {
			await this.#waitForUniqueVisible("send", this.#contract.send);
		}
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
		const requiredConversationStabilityMs =
			this.surface === "kimi.consumer_web" || this.surface === "yuanbao.consumer_web"
				? CONFIRMED_CONVERSATION_STABILITY_MS
				: 0;
		let candidateConversationUrl = "";
		let candidateStableSince = 0;
		while (this.#port.now() < timeoutAt) {
			this.#assertApprovedUrl(false);
			if (!(await this.#assertUnblocked())) {
				await this.#port.wait(POLL_INTERVAL_MS);
				continue;
			}
			const messages = visibleElements(await this.#port.query("user_message", this.#contract.userMessage));
			const latest = messages.at(-1)?.element.text;
			const currentUrl = new URL(this.#port.currentUrl());
			const exactPromptVisible = latest && normalizeText(latest) === normalizeText(prompt);
			const durableConversationPath = new RegExp(this.#contract.conversationPathPattern, "u").test(currentUrl.pathname);
			if (
				exactPromptVisible &&
				durableConversationPath &&
				this.#contract.conversationSearchPattern &&
				currentUrl.search === ""
			) {
				this.#assertApprovedUrl(true);
			}
			if (exactPromptVisible && durableConversationPath && this.#hasApprovedConversationSearch(currentUrl)) {
				const approvedConversationUrl = this.#approvedConversationUrl();
				if (requiredConversationStabilityMs === 0) {
					this.#confirmedConversationUrl = approvedConversationUrl;
					return;
				}
				if (approvedConversationUrl !== candidateConversationUrl) {
					candidateConversationUrl = approvedConversationUrl;
					candidateStableSince = this.#port.now();
				} else if (this.#port.now() - candidateStableSince >= requiredConversationStabilityMs) {
					this.#confirmedConversationUrl = approvedConversationUrl;
					return;
				}
			} else {
				candidateConversationUrl = "";
				candidateStableSince = 0;
			}
			await this.#port.wait(POLL_INTERVAL_MS);
		}
		throw this.#error("post_submit_unknown", "The exact submitted prompt did not appear in the conversation");
	}

	async resumeSubmitted(promptText: string): Promise<void> {
		const prompt = validatePrompt(promptText);
		this.#submitted = true;
		this.#confirmedConversationUrl = this.#approvedConversationUrl();
		await this.#assertUnblocked();
		const messages = visibleElements(await this.#port.query("user_message", this.#contract.userMessage));
		if (messages.length < 1 || !messages.some(({ element }) => normalizeText(element.text) === normalizeText(prompt))) {
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
		if (!this.#confirmedConversationUrl || !this.#preparedPrompt) {
			throw this.#error("post_submit_unknown", "Submitted conversation identity is not confirmed");
		}
		const timeoutAt =
			this.#port.now() + (this.surface === "zhipu.consumer_web" ? ZHIPU_RESPONSE_TIMEOUT_MS : RESPONSE_TIMEOUT_MS);
		let generatingSeen = false;
		let stableText = "";
		let stableSince = 0;
		let answerContainersAmbiguous = false;
		const runtimeCompletionSelector = this.surface === "doubao.consumer_web" ? null : this.#contract.completion;
		while (this.#port.now() < timeoutAt) {
			this.#assertConfirmedConversation();
			if (!(await this.#assertUnblocked())) {
				await this.#port.wait(POLL_INTERVAL_MS);
				continue;
			}
			const generating = visibleElements(await this.#port.query("generating", this.#contract.generating)).length;
			if (generating > 1) throw this.#error("page_drift", "Generation state is ambiguous");
			if (generating === 1) generatingSeen = true;
			let completionConfirmed = runtimeCompletionSelector ? generatingSeen : true;
			if (runtimeCompletionSelector) {
				if (!this.#contract.completionCompanion || !this.#port.readCompletionState) {
					throw this.#error("page_drift", "Completion binding contract is unavailable");
				}
				let completionState: CompletionDomState;
				try {
					completionState = await this.#port.readCompletionState({
						answerSelector: this.#contract.answer,
						completionSelector: runtimeCompletionSelector,
						companionSelector: this.#contract.completionCompanion,
					});
				} catch {
					throw this.#error("page_drift", "Completion binding could not be inspected");
				}
				if (completionState === "ambiguous" || completionState === "unbound") {
					throw this.#error("page_drift", "Completion state is not bound to the current answer");
				}
				completionConfirmed = completionState === "bound";
			}
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
				} else if (completionConfirmed && generating === 0 && this.#port.now() - stableSince >= STABLE_ANSWER_MS) {
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
		const pageUrl = this.#assertConfirmedConversation();
		await this.#assertSubmittedPromptStillCurrent();
		let snapshot: AnswerDomSnapshot;
		try {
			const captureCompletionSelector = this.surface === "doubao.consumer_web" ? null : this.#contract.completion;
			snapshot = await this.#port.readAnswer({
				answerSelector: this.#contract.answer,
				answerIndex,
				searchUsedSelector: this.#contract.searchUsed,
				searchNotUsedSelector: this.#contract.searchNotUsed,
				citationLinkSelector: this.#contract.citationLink,
				queryItemSelector: this.#contract.queryItem,
				searchEvidence: this.#contract.searchEvidence,
				deferSearchEvidence: true,
				evidenceViewport: {
					promptSelector: this.#contract.userMessage,
					promptText: this.#preparedPrompt ?? "",
					completionSelector: captureCompletionSelector,
					companionSelector: captureCompletionSelector ? this.#contract.completionCompanion : null,
				},
			});
		} catch {
			throw this.#error("page_drift", "Current answer search or citation evidence changed during capture");
		}
		this.#assertConfirmedConversation();
		const answerText = snapshot.text.trim();
		if (
			!answerText ||
			answerText.length > ANSWER_MAX_CHARACTERS ||
			normalizeText(answerText) !== normalizeText(expectedText)
		) {
			throw this.#error("page_drift", "Current answer container changed during capture");
		}
		let legacyCitations: CollectedCitation[];
		try {
			legacyCitations = uniqueCitations(snapshot.citations);
		} catch {
			throw this.#error("page_drift", "Current answer search or citation values violate the approved contract");
		}
		let evidence: SearchEvidenceResult;
		if (this.#evidenceAdapter) {
			evidence = await this.#readSettledSearchEvidence(snapshot, legacyCitations);
		} else {
			const webSearchObserved = this.#classifySearch(snapshot);
			const webQueries = uniqueStrings(snapshot.webQueries, QUERY_MAX_COUNT, 2_000, "query");
			evidence = {
				webSearchObserved,
				queryAvailability:
					webSearchObserved === false
						? "not_searched"
						: webSearchObserved === true
							? webQueries.length > 0
								? "exposed"
								: "unavailable"
							: "unknown",
				webQueries,
				citations: legacyCitations,
				diagnostics: {
					extractorVersion: `${this.adapterVersion}:legacy`,
					evidenceSource: webSearchObserved !== null || legacyCitations.length > 0 ? "dom" : "none",
					searchBlockCount: snapshot.searchUsedCount + snapshot.searchNotUsedCount,
					queryCandidateCount: webQueries.length,
					citationCandidateCount: legacyCitations.length,
				},
			};
		}
		let webQueries: string[];
		let citations: CollectedCitation[];
		try {
			webQueries = uniqueStrings(evidence.webQueries, QUERY_MAX_COUNT, 2_000, "query");
			citations = uniqueCitations(evidence.citations);
		} catch {
			evidence = fallbackUnknownSearchEvidence(
				this.#evidenceAdapter?.version ?? `${this.adapterVersion}:legacy`,
				legacyCitations,
			);
			webQueries = [];
			citations = legacyCitations;
		}
		if (!snapshot.evidenceViewportRect) {
			throw this.#error("page_drift", "Current answer has no verified visual evidence region");
		}
		return {
			answerText,
			evidenceViewportRect: snapshot.evidenceViewportRect,
			pageUrl,
			observedAt: new Date(this.#port.now()).toISOString(),
			webSearchObserved: evidence.webSearchObserved,
			queryAvailability: evidence.queryAvailability,
			webQueries,
			citations,
			searchEvidenceDiagnostics: evidence.diagnostics,
			adapterVersion: this.adapterVersion,
		};
	}

	async #readSettledSearchEvidence(
		snapshot: AnswerDomSnapshot,
		legacyCitations: CollectedCitation[],
	): Promise<SearchEvidenceResult> {
		const adapter = this.#evidenceAdapter;
		if (!adapter) throw new Error("Search evidence adapter is unavailable");
		const settleTimeoutMs = adapter.settleTimeoutMs ?? 0;
		const deadline = this.#port.now() + settleTimeoutMs;
		let stableSignature = "";
		let stableSince = this.#port.now();
		let latest = fallbackUnknownSearchEvidence(adapter.version, legacyCitations);
		while (true) {
			try {
				latest = validateSearchEvidenceResult(
					await adapter.read(requiredSearchEvidenceContext(snapshot)),
					adapter.version,
				);
			} catch {
				latest = fallbackUnknownSearchEvidence(adapter.version, legacyCitations);
			}
			const signature = searchEvidenceSignature(latest);
			if (signature !== stableSignature) {
				stableSignature = signature;
				stableSince = this.#port.now();
			}
			const searchStateIsDefinitive = latest.webSearchObserved !== null || latest.queryAvailability !== "unknown";
			if (
				settleTimeoutMs === 0 ||
				(searchStateIsDefinitive && this.#port.now() - stableSince >= EVIDENCE_STABLE_MS) ||
				this.#port.now() >= deadline
			) {
				return latest;
			}
			await this.#port.wait(Math.min(EVIDENCE_POLL_INTERVAL_MS, deadline - this.#port.now()));
			this.#assertConfirmedConversation();
			await this.#assertSubmittedPromptStillCurrent();
		}
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

	async #assertUnblocked(): Promise<boolean> {
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
				if (code === "captcha" && this.surface === "qwen.consumer_web" && this.#submitted) return false;
				throw this.#error(code, `Consumer page reported ${code}`);
			}
		}
		return true;
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
				this.surface === "doubao.consumer_web" || SEND_APPEARS_AFTER_FILL_SURFACES.has(this.surface)
					? [{ element: { text: "", visible: true }, index: 0 }]
					: visibleElements(await this.#port.query("send", this.#contract.send));
			const conversationActions = await this.#newConversationActions();
			lastComposerCount = composer.length;
			lastSendCount = send.length;
			lastConversationActionCount = conversationActions.length;
			const blankKimiLaunch = await this.#isBlankKimiLaunch();
			if (composer.length === 1 && send.length === 1 && (conversationActions.length === 1 || blankKimiLaunch)) return;
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
			? visible.filter(({ element }) => firstVisibleTextLine(element.text) === normalizeText(expected))
			: visible;
	}

	async #isBlankKimiLaunch(): Promise<boolean> {
		if (this.surface !== "kimi.consumer_web") return false;
		let current: URL;
		try {
			current = new URL(this.#port.currentUrl());
		} catch {
			return false;
		}
		if (current.pathname !== "/") return false;
		const answers = visibleElements(await this.#port.query("answer", this.#contract.answer));
		const messages = visibleElements(await this.#port.query("user_message", this.#contract.userMessage));
		return answers.length === 0 && messages.length === 0;
	}

	#assertApprovedUrl(requireConversation: boolean): void {
		let current: URL;
		try {
			current = new URL(this.#port.currentUrl());
		} catch {
			throw this.#error("page_drift", "Navigation no longer has a valid consumer URL");
		}
		const launch = new URL(this.#contract.launchUrl);
		const allowedSearchPatterns = [
			this.#contract.allowedSearchPattern,
			this.#contract.conversationSearchPattern,
		].filter((pattern): pattern is string => Boolean(pattern));
		const allowedSearch =
			!requireConversation ||
			current.search === "" ||
			allowedSearchPatterns.some((pattern) => new RegExp(pattern, "u").test(current.search));
		const approvedConversationSearch = !requireConversation || this.#hasApprovedConversationSearch(current);
		const approvedHost =
			this.surface === "doubao.consumer_web"
				? current.hostname === "doubao.com" || current.hostname.endsWith(".doubao.com")
				: this.surface === "qwen.consumer_web"
					? current.hostname === "qianwen.com" || current.hostname === "www.qianwen.com"
					: current.hostname === launch.hostname;
		if (
			current.protocol !== "https:" ||
			!approvedHost ||
			current.port ||
			current.username ||
			current.password ||
			!allowedSearch ||
			!approvedConversationSearch ||
			current.hash
		) {
			throw this.#error(
				"page_drift",
				`Navigation left the approved consumer origin (host=${current.hostname}, launchHost=${launch.hostname}, search=${current.search ? "present" : "none"}, hash=${current.hash ? "present" : "none"})`,
			);
		}
		if (requireConversation && !new RegExp(this.#contract.conversationPathPattern, "u").test(current.pathname)) {
			throw this.#error("page_drift", "Consumer page did not create a durable conversation URL");
		}
	}

	#hasApprovedConversationSearch(current: URL): boolean {
		return (
			!this.#contract.conversationSearchPattern ||
			new RegExp(this.#contract.conversationSearchPattern, "u").test(current.search)
		);
	}

	#approvedConversationUrl(): string {
		this.#assertApprovedUrl(true);
		const approved = new URL(this.#port.currentUrl());
		if (this.surface === "doubao.consumer_web") approved.hostname = "doubao.com";
		if (this.surface === "qwen.consumer_web") approved.hostname = "www.qianwen.com";
		if (!this.#contract.conversationSearchPattern) approved.search = "";
		return approved.toString();
	}

	#assertConfirmedConversation(): string {
		const current = this.#approvedConversationUrl();
		if (!this.#confirmedConversationUrl || current !== this.#confirmedConversationUrl) {
			throw this.#error("page_drift", "Navigation left the confirmed submitted conversation");
		}
		return current;
	}

	async #assertSubmittedPromptStillCurrent(): Promise<void> {
		const messages = visibleElements(await this.#port.query("user_message", this.#contract.userMessage));
		if (
			messages.length < 1 ||
			!this.#preparedPrompt ||
			!messages.some(({ element }) => normalizeText(element.text) === normalizeText(this.#preparedPrompt ?? ""))
		) {
			throw this.#error("page_drift", "Confirmed conversation no longer contains the exact submitted prompt");
		}
	}

	#error(code: ConstructorParameters<typeof AdapterError>[0], message: string): AdapterError {
		return new AdapterError(code, this.#submitted ? "post_submit" : "pre_submit", message);
	}
}

function requiredSearchEvidenceContext(snapshot: AnswerDomSnapshot) {
	if (!snapshot.searchEvidenceContext) throw new Error("Search evidence context is unavailable");
	return snapshot.searchEvidenceContext;
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
		if (contract.allowedSearchPattern) new RegExp(contract.allowedSearchPattern, "u");
		if (contract.conversationSearchPattern) new RegExp(contract.conversationSearchPattern, "u");
	} catch {
		throw new Error("Invalid selector contract pattern");
	}
	validateSearchEvidenceContract(contract.searchEvidence);
	const optionalSelectors = new Set([
		"completion",
		"completionCompanion",
		"searchUsed",
		"searchNotUsed",
		"citationLink",
		"queryItem",
		"searchEvidence",
	]);
	if (Boolean(contract.completion) !== Boolean(contract.completionCompanion)) {
		throw new Error("Completion and companion selectors must be configured together");
	}
	for (const [key, value] of Object.entries(contract)) {
		if (value === null && optionalSelectors.has(key)) continue;
		if (key === "searchEvidence") continue;
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

function validateSearchEvidenceContract(contract: SelectorContract["searchEvidence"]): void {
	if (!contract) return;
	for (const [key, value] of Object.entries(contract)) {
		if (typeof value !== "string" || value.length < 2 || value.length > 500 || value.trim() !== value) {
			throw new Error(`Invalid search evidence contract value: ${key}`);
		}
	}
	for (const pattern of [contract.summaryTextPattern, contract.queryTextPattern, contract.citationTitlePrefixPattern]) {
		try {
			new RegExp(pattern, "u");
		} catch {
			throw new Error("Invalid search evidence text pattern");
		}
	}
	if (
		contract.summaryTextPattern.includes("(?<queries>") === false ||
		contract.summaryTextPattern.includes("(?<citations>") === false
	) {
		throw new Error("Search evidence summary pattern must expose counts");
	}
	if (contract.queryTextPattern.includes("(?<query>") === false) {
		throw new Error("Search evidence query pattern must expose a query");
	}
}

function searchEvidenceSignature(evidence: SearchEvidenceResult): string {
	return JSON.stringify({
		webSearchObserved: evidence.webSearchObserved,
		queryAvailability: evidence.queryAvailability,
		webQueries: evidence.webQueries,
		citations: evidence.citations,
		diagnostics: evidence.diagnostics,
	});
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

function firstVisibleTextLine(value: string): string {
	return normalizeText(value.split(/\r?\n/u).find((line) => line.trim()) ?? "");
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
		const title = normalizeCitationTitle(citation.title);
		if (seen.has(url.href)) continue;
		seen.add(url.href);
		result.push({ url: url.href, title });
	}
	return result;
}
