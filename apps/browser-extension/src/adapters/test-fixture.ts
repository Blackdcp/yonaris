import type {
	AnswerDomSnapshot,
	AnswerReadRequest,
	ConsumerDomPort,
	ConsumerWebAdapter,
	DomElementRole,
	DomElementSummary,
} from "./contracts";

type FixtureAnswer = {
	text: string;
	html: string;
	queries?: string[];
	citations?: Array<{ url: string; title: string }>;
};

export type AdapterFixture = {
	pageUrl: string;
	conversationUrl: string;
	conversationUrlTimeline: string[];
	composerMatches: number;
	composerMatchTimeline: number[];
	composerReadyDelayMs: number;
	sendMatches: number;
	sendMatchesBeforeFill: number;
	newConversationLabels: string[];
	signedOut: boolean;
	captcha: boolean;
	captchaDurationAfterSubmitMs: number;
	rateLimited: boolean;
	accountRestricted: boolean;
	blankConversationDelayMs: number;
	priorAnswers: FixtureAnswer[];
	answer: FixtureAnswer;
	answerTimeline: string[];
	newAnswerCount: number;
	newAnswerCountTimeline: number[];
	submittedPrompt: string | null;
	submittedPromptCopies: number;
	submittedPromptTexts: string[] | null;
	initiallySubmitted: boolean;
	conversationUrlDelayMs: number;
	generatingDurationMs: number;
	completionReadyDelayMs: number;
	completionState: "bound" | "unbound" | "ambiguous";
	searchUsedCount: number;
	searchNotUsedCount: number;
};

export function createAdapterFixture(
	override: Partial<AdapterFixture> & { newConversationMatches?: number } = {},
): AdapterFixture {
	const newConversationLabels =
		override.newConversationLabels ??
		Array.from({ length: override.newConversationMatches ?? 1 }, () => "New conversation");
	return {
		pageUrl: "https://chat.deepseek.com/",
		conversationUrl: "https://chat.deepseek.com/a/chat/s/test-session",
		conversationUrlTimeline: [],
		composerMatches: 1,
		composerMatchTimeline: [],
		composerReadyDelayMs: 0,
		sendMatches: 1,
		sendMatchesBeforeFill: override.sendMatches ?? 1,
		signedOut: false,
		captcha: false,
		captchaDurationAfterSubmitMs: 0,
		rateLimited: false,
		accountRestricted: false,
		blankConversationDelayMs: 0,
		priorAnswers: [],
		answer: { text: "Current answer", html: "<div>Current answer</div>" },
		answerTimeline: [],
		newAnswerCount: 1,
		newAnswerCountTimeline: [],
		submittedPrompt: null,
		submittedPromptCopies: 1,
		submittedPromptTexts: null,
		initiallySubmitted: false,
		conversationUrlDelayMs: 0,
		generatingDurationMs: 2_000,
		completionReadyDelayMs: 2_000,
		completionState: "bound",
		searchUsedCount: 0,
		searchNotUsedCount: 0,
		...override,
		newConversationLabels,
	};
}

export class FixtureDomPort implements ConsumerDomPort {
	readonly #fixture: AdapterFixture;
	#now = Date.parse("2026-08-17T00:00:00.000Z");
	#submitted = false;
	#filledPrompt = "";
	#conversationOpened = false;
	#newConversationClickedAt: number | null = null;
	#composerQueryCount = 0;
	clickedText: string | null = null;
	submitCount = 0;
	elapsedMs = 0;

	constructor(fixture: AdapterFixture) {
		this.#fixture = fixture;
		this.#submitted = fixture.initiallySubmitted;
		this.#conversationOpened = fixture.initiallySubmitted;
	}

	currentUrl(): string {
		if (!this.#submitted || this.elapsedMs < this.#fixture.conversationUrlDelayMs) return this.#fixture.pageUrl;
		const timelineUrl =
			this.#fixture.conversationUrlTimeline[
				Math.min(Math.floor(this.elapsedMs / 1_000), this.#fixture.conversationUrlTimeline.length - 1)
			];
		return timelineUrl ?? this.#fixture.conversationUrl;
	}

	now(): number {
		return this.#now;
	}

	async query(role: DomElementRole, _selector: string): Promise<readonly DomElementSummary[]> {
		switch (role) {
			case "composer": {
				if (this.elapsedMs < this.#fixture.composerReadyDelayMs) return [];
				const composerMatches =
					this.#fixture.composerMatchTimeline[
						Math.min(this.#composerQueryCount, this.#fixture.composerMatchTimeline.length - 1)
					] ?? this.#fixture.composerMatches;
				this.#composerQueryCount += 1;
				return elements(composerMatches, "");
			}
			case "send":
				return elements(this.#filledPrompt ? this.#fixture.sendMatches : this.#fixture.sendMatchesBeforeFill, "");
			case "new_conversation":
				return this.#fixture.newConversationLabels.map((text) => ({ text, visible: true }));
			case "login_wall":
				return this.#fixture.signedOut ? elements(1, "") : [];
			case "captcha":
				return this.#fixture.captcha || (this.#submitted && this.elapsedMs < this.#fixture.captchaDurationAfterSubmitMs)
					? elements(1, "")
					: [];
			case "rate_limit":
				return this.#fixture.rateLimited ? elements(1, "") : [];
			case "account_restricted":
				return this.#fixture.accountRestricted
					? [{ text: "由于违反用户使用规范，你的账号已被禁言至 2026 年 8 月 19 日 00:43", visible: true }]
					: [];
			case "user_message":
				if (this.#oldDialogueStillVisible()) return [{ text: "Old prompt", visible: true }];
				return this.#submitted
					? (this.#fixture.submittedPromptTexts?.map((text) => ({ text, visible: true })) ??
							elements(this.#fixture.submittedPromptCopies, this.#fixture.submittedPrompt ?? this.#filledPrompt))
					: [];
			case "generating":
				return this.#submitted && this.elapsedMs < this.#fixture.generatingDurationMs ? elements(1, "") : [];
			case "completion":
				return this.#submitted && this.elapsedMs >= this.#fixture.completionReadyDelayMs ? elements(1, "") : [];
			case "answer":
				return this.#answers();
		}
	}

	async readCompletionState(): Promise<"missing" | "bound" | "unbound" | "ambiguous"> {
		if (!this.#submitted || this.elapsedMs < this.#fixture.completionReadyDelayMs) return "missing";
		return this.#fixture.completionState;
	}

	async click(role: DomElementRole, _selector: string, index: number): Promise<void> {
		if (role === "new_conversation") {
			this.clickedText = this.#fixture.newConversationLabels[index] ?? null;
			this.#conversationOpened = true;
			this.#newConversationClickedAt = this.elapsedMs;
			return;
		}
		if (role === "send") {
			this.#conversationOpened = true;
			this.#submitted = true;
			this.submitCount += 1;
		}
	}

	async fill(_role: "composer", _selector: string, _index: number, value: string): Promise<void> {
		this.#filledPrompt = value;
	}

	async readAnswer(request: AnswerReadRequest): Promise<AnswerDomSnapshot> {
		const text = this.#currentAnswerText();
		return {
			text,
			html: this.#fixture.answer.text === text ? this.#fixture.answer.html : `<div>${text}</div>`,
			evidenceViewportRect: { x: 200, y: 100, width: 800, height: 500, devicePixelRatio: 1 },
			searchUsedCount: request.searchUsedSelector || request.searchEvidence ? this.#fixture.searchUsedCount : 0,
			searchNotUsedCount: request.searchNotUsedSelector ? this.#fixture.searchNotUsedCount : 0,
			webQueries: request.queryItemSelector || request.searchEvidence ? [...(this.#fixture.answer.queries ?? [])] : [],
			citations:
				request.citationLinkSelector || request.searchEvidence ? [...(this.#fixture.answer.citations ?? [])] : [],
			searchEvidenceContext: {
				acceptedAnswer: {} as Element,
				document: {} as Document,
				isVisible: () => true,
				readVisibleText: () => this.#fixture.answer.text,
				readStructuredEvidence: async () => ({
					searchUsedCount: this.#fixture.searchUsedCount,
					webQueries: [...(this.#fixture.answer.queries ?? [])],
					citations: [...(this.#fixture.answer.citations ?? [])],
				}),
			},
		};
	}

	async wait(milliseconds: number): Promise<void> {
		this.elapsedMs += milliseconds;
		this.#now += milliseconds;
	}

	async completeOneTask(adapter: ConsumerWebAdapter, prompt: string): Promise<void> {
		await adapter.openNewConversation();
		await adapter.prepare(prompt);
		await adapter.submitOnce(prompt);
		await adapter.confirmSubmitted(prompt);
	}

	#answers(): DomElementSummary[] {
		if (this.#oldDialogueStillVisible()) return [{ text: "Old answer", visible: true }];
		const prior = this.#fixture.priorAnswers.map(({ text }) => ({ text, visible: false }));
		if (!this.#submitted || !this.#conversationOpened) return prior;
		const newAnswerCount =
			this.#fixture.newAnswerCountTimeline[
				Math.min(Math.floor(this.elapsedMs / 1_000), this.#fixture.newAnswerCountTimeline.length - 1)
			] ?? this.#fixture.newAnswerCount;
		return [
			...prior,
			...Array.from({ length: newAnswerCount }, () => ({
				text: this.#currentAnswerText(),
				visible: true,
			})),
		];
	}

	#oldDialogueStillVisible(): boolean {
		return (
			this.#newConversationClickedAt !== null &&
			this.elapsedMs - this.#newConversationClickedAt < this.#fixture.blankConversationDelayMs
		);
	}

	#currentAnswerText(): string {
		if (this.#fixture.answerTimeline.length === 0) return this.#fixture.answer.text;
		const index = Math.min(Math.floor(this.elapsedMs / 1_000), this.#fixture.answerTimeline.length - 1);
		return this.#fixture.answerTimeline[index] ?? this.#fixture.answer.text;
	}
}

function elements(count: number, text: string): DomElementSummary[] {
	return Array.from({ length: count }, () => ({ text, visible: true }));
}
