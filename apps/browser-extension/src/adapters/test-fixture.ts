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
	composerMatches: number;
	composerMatchTimeline: number[];
	composerReadyDelayMs: number;
	sendMatches: number;
	sendMatchesBeforeFill: number;
	newConversationLabels: string[];
	signedOut: boolean;
	captcha: boolean;
	rateLimited: boolean;
	accountRestricted: boolean;
	blankConversationDelayMs: number;
	priorAnswers: FixtureAnswer[];
	answer: FixtureAnswer;
	answerTimeline: string[];
	newAnswerCount: number;
	newAnswerCountTimeline: number[];
	submittedPrompt: string | null;
	initiallySubmitted: boolean;
	conversationUrlDelayMs: number;
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
		composerMatches: 1,
		composerMatchTimeline: [],
		composerReadyDelayMs: 0,
		sendMatches: 1,
		sendMatchesBeforeFill: override.sendMatches ?? 1,
		signedOut: false,
		captcha: false,
		rateLimited: false,
		accountRestricted: false,
		blankConversationDelayMs: 0,
		priorAnswers: [],
		answer: { text: "Current answer", html: "<div>Current answer</div>" },
		answerTimeline: [],
		newAnswerCount: 1,
		newAnswerCountTimeline: [],
		submittedPrompt: null,
		initiallySubmitted: false,
		conversationUrlDelayMs: 0,
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
		return this.#submitted && this.elapsedMs >= this.#fixture.conversationUrlDelayMs
			? this.#fixture.conversationUrl
			: this.#fixture.pageUrl;
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
				return this.#fixture.captcha ? elements(1, "") : [];
			case "rate_limit":
				return this.#fixture.rateLimited ? elements(1, "") : [];
			case "account_restricted":
				return this.#fixture.accountRestricted
					? [{ text: "由于违反用户使用规范，你的账号已被禁言至 2026 年 8 月 19 日 00:43", visible: true }]
					: [];
			case "user_message":
				if (this.#oldDialogueStillVisible()) return [{ text: "Old prompt", visible: true }];
				return this.#submitted ? [{ text: this.#fixture.submittedPrompt ?? this.#filledPrompt, visible: true }] : [];
			case "generating":
				return this.#submitted && this.elapsedMs < 2_000 ? elements(1, "") : [];
			case "answer":
				return this.#answers();
		}
	}

	async click(role: DomElementRole, _selector: string, index: number): Promise<void> {
		if (role === "new_conversation") {
			this.clickedText = this.#fixture.newConversationLabels[index] ?? null;
			this.#conversationOpened = true;
			this.#newConversationClickedAt = this.elapsedMs;
			return;
		}
		if (role === "send") {
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
			searchUsedCount: request.searchUsedSelector ? this.#fixture.searchUsedCount : 0,
			searchNotUsedCount: request.searchNotUsedSelector ? this.#fixture.searchNotUsedCount : 0,
			webQueries: request.queryItemSelector ? [...(this.#fixture.answer.queries ?? [])] : [],
			citations: request.citationLinkSelector ? [...(this.#fixture.answer.citations ?? [])] : [],
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
