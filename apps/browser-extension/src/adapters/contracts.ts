import type { BrowserExtensionSurface } from "../contracts";

export type AdapterFailureCode =
	| "signed_out"
	| "captcha"
	| "rate_limited"
	| "account_restricted"
	| "page_drift"
	| "response_timeout"
	| "post_submit_unknown";

export type AdapterFailureStage = "pre_submit" | "post_submit";

export class AdapterError extends Error {
	readonly code: AdapterFailureCode;
	readonly stage: AdapterFailureStage;

	constructor(code: AdapterFailureCode, stage: AdapterFailureStage, message: string) {
		super(message);
		this.name = "AdapterError";
		this.code = code;
		this.stage = stage;
	}
}

export type SelectorContract = {
	version: string;
	surface: BrowserExtensionSurface;
	launchUrl: string;
	conversationPathPattern: string;
	composer: string;
	send: string;
	newConversation: string;
	newConversationLabel: string | null;
	userMessage: string;
	answer: string;
	generating: string;
	completion: string | null;
	loginWall: string;
	captcha: string;
	rateLimit: string;
	accountRestricted: string;
	accountRestrictedTextPattern: string;
	searchUsed: string | null;
	searchNotUsed: string | null;
	citationLink: string | null;
	queryItem: string | null;
};

export type CollectedCitation = {
	url: string;
	title: string;
};

export type CollectedAnswer = {
	answerText: string;
	answerHtml: string;
	pageUrl: string;
	observedAt: string;
	webSearchObserved: boolean | null;
	webQueries: string[];
	citations: CollectedCitation[];
	adapterVersion: string;
};

export interface ConsumerWebAdapter {
	readonly surface: BrowserExtensionSurface;
	readonly launchUrl: string;
	readonly adapterVersion: string;
	preflight(): Promise<void>;
	openNewConversation(): Promise<void>;
	prepare(promptText: string): Promise<void>;
	submitOnce(promptText: string): Promise<void>;
	confirmSubmitted(promptText: string): Promise<void>;
	resumeSubmitted(promptText: string): Promise<void>;
	collectCurrentAnswer(): Promise<CollectedAnswer>;
}

export type DomElementRole =
	| "composer"
	| "send"
	| "new_conversation"
	| "user_message"
	| "answer"
	| "generating"
	| "completion"
	| "login_wall"
	| "captcha"
	| "rate_limit"
	| "account_restricted";

export type DomElementSummary = {
	text: string;
	visible: boolean;
};

export type AnswerReadRequest = {
	answerSelector: string;
	answerIndex: number;
	searchUsedSelector: string | null;
	searchNotUsedSelector: string | null;
	citationLinkSelector: string | null;
	queryItemSelector: string | null;
};

export type AnswerDomSnapshot = {
	text: string;
	html: string;
	searchUsedCount: number;
	searchNotUsedCount: number;
	webQueries: string[];
	citations: CollectedCitation[];
};

export interface ConsumerDomPort {
	currentUrl(): string;
	now(): number;
	query(role: DomElementRole, selector: string): Promise<readonly DomElementSummary[]>;
	click(role: DomElementRole, selector: string, index: number): Promise<void>;
	fill(role: "composer", selector: string, index: number, value: string): Promise<void>;
	readAnswer(request: AnswerReadRequest): Promise<AnswerDomSnapshot>;
	wait(milliseconds: number): Promise<void>;
}
