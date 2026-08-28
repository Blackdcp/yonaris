import type { BrowserExtensionSurface } from "../contracts";
import type {
	SearchEvidenceDiagnostics,
	SearchEvidenceQueryAvailability,
	SearchEvidenceReadContext,
} from "./search-evidence-adapter";

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
	allowedSearchPattern?: string | null;
	conversationSearchPattern?: string | null;
	composer: string;
	send: string;
	newConversation: string;
	newConversationLabel: string | null;
	userMessage: string;
	answer: string;
	generating: string;
	completion: string | null;
	completionCompanion: string | null;
	loginWall: string;
	captcha: string;
	rateLimit: string;
	rateLimitTextPattern?: string | null;
	accountRestricted: string;
	accountRestrictedTextPattern: string;
	searchUsed: string | null;
	searchNotUsed: string | null;
	citationLink: string | null;
	queryItem: string | null;
	searchEvidence: SearchEvidenceContract | null;
};

export type SearchEvidenceContract = {
	container: string;
	disclosure: string;
	summaryTextPattern: string;
	queryItem: string;
	queryTextPattern: string;
	citationLink: string;
	citationTitlePrefixPattern: string;
};

export type CollectedCitation = {
	url: string;
	title: string;
};

export type EvidenceViewportRect = {
	x: number;
	y: number;
	width: number;
	height: number;
	devicePixelRatio: number;
};

export type CollectedAnswer = {
	answerText: string;
	evidenceViewportRect: EvidenceViewportRect;
	pageUrl: string;
	observedAt: string;
	webSearchObserved: boolean | null;
	queryAvailability: SearchEvidenceQueryAvailability;
	webQueries: string[];
	citations: CollectedCitation[];
	searchEvidenceDiagnostics: SearchEvidenceDiagnostics;
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
	searchEvidence: SearchEvidenceContract | null;
	deferSearchEvidence?: boolean;
	evidenceViewport?: {
		promptSelector: string;
		promptText?: string;
		completionSelector: string | null;
		companionSelector: string | null;
	};
};

export type AnswerDomSnapshot = {
	text: string;
	html: string;
	evidenceViewportRect: EvidenceViewportRect | null;
	searchUsedCount: number;
	searchNotUsedCount: number;
	webQueries: string[];
	citations: CollectedCitation[];
	searchEvidenceContext?: SearchEvidenceReadContext;
};

export type CompletionReadRequest = {
	answerSelector: string;
	completionSelector: string;
	companionSelector: string;
};

export type CompletionDomState = "missing" | "bound" | "unbound" | "ambiguous";

export interface ConsumerDomPort {
	currentUrl(): string;
	now(): number;
	query(role: DomElementRole, selector: string): Promise<readonly DomElementSummary[]>;
	readCompletionState?(request: CompletionReadRequest): Promise<CompletionDomState>;
	click(role: DomElementRole, selector: string, index: number): Promise<void>;
	fill(role: "composer", selector: string, index: number, value: string): Promise<void>;
	readAnswer(request: AnswerReadRequest): Promise<AnswerDomSnapshot>;
	wait(milliseconds: number): Promise<void>;
}
