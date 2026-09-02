import { isApprovedDoubaoConversationUrl } from "../surface-qualification-client";
import {
	type ExtensionSurfaceDefinition,
	extensionSurfaceForUrl,
	isApprovedSurfaceConversationUrl,
} from "../surface-registry";
import type { AdapterError, ConsumerWebAdapter } from "./contracts";
import { createDocumentDomPort, isDomElementVisible, readStructuredSearchEvidence } from "./dom-port";
import { doubaoSelectorContract } from "./doubao";
import { createDocumentEvidenceCaptureSessionManager } from "./evidence-capture-session";
import { probeSearchEvidenceCandidates } from "./evidence-probe";
import { inspectLatestStructuredSearchEvidenceAsync } from "./search-evidence";

type AdapterCommand =
	| { kind: "yonaris_adapter"; action: "preflight" | "open_new_conversation" }
	| {
			kind: "yonaris_adapter";
			action: "prepare" | "submit_once" | "confirm_submitted" | "resume_submitted";
			promptText: string;
	  }
	| { kind: "yonaris_adapter"; action: "collect_current_answer" }
	| { kind: "yonaris_adapter"; action: "begin_evidence_capture"; promptText: string }
	| {
			kind: "yonaris_adapter";
			action: "advance_evidence_capture" | "end_evidence_capture";
			sessionId: string;
	  }
	| { kind: "yonaris_adapter"; action: "inspect_search_evidence" | "inspect_search_candidates" };

type ContentEntryDocument = Document & {
	__yonarisBrowserRunnerContentEntryInstalledV1__?: boolean;
};

const contentEntryDocument = document as ContentEntryDocument;
if (!contentEntryDocument.__yonarisBrowserRunnerContentEntryInstalledV1__) {
	installContentEntry();
	contentEntryDocument.__yonarisBrowserRunnerContentEntryInstalledV1__ = true;
}

function installContentEntry(): void {
	const port = createDocumentDomPort(document, location);
	const surfaceDefinition = extensionSurfaceForUrl(new URL(location.href));
	const adapter = surfaceDefinition.createAdapter(port);
	const evidenceCapture = createDocumentEvidenceCaptureSessionManager(document);

	chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
		if (!isAdapterCommand(message)) return false;
		void execute(adapter, surfaceDefinition, message, () => location.href, evidenceCapture)
			.then((value) => sendResponse({ ok: true, value }))
			.catch((error: unknown) => {
				const adapterError = error as Partial<AdapterError>;
				sendResponse({
					ok: false,
					error: {
						code: adapterError.code ?? "page_drift",
						stage: adapterError.stage ?? "pre_submit",
						message: error instanceof Error ? error.message : "Adapter failed",
					},
				});
			});
		return true;
	});

	if (typeof chrome.runtime.sendMessage === "function") {
		void chrome.runtime.sendMessage({ type: "browser-runner:surface-document-ready" }).catch(() => undefined);
	}
}

async function execute(
	adapter: ConsumerWebAdapter,
	surfaceDefinition: ExtensionSurfaceDefinition,
	command: AdapterCommand,
	readPageUrl: () => string,
	evidenceCapture: ReturnType<typeof createDocumentEvidenceCaptureSessionManager>,
): Promise<unknown> {
	switch (command.action) {
		case "preflight":
			return adapter.preflight();
		case "open_new_conversation":
			return adapter.openNewConversation();
		case "prepare":
			return adapter.prepare(command.promptText);
		case "submit_once":
			return adapter.submitOnce(command.promptText);
		case "confirm_submitted":
			return adapter.confirmSubmitted(command.promptText);
		case "resume_submitted":
			return adapter.resumeSubmitted(command.promptText);
		case "collect_current_answer":
			return adapter.collectCurrentAnswer();
		case "begin_evidence_capture":
			assertApprovedCapturePage(surfaceDefinition, readPageUrl());
			return evidenceCapture.begin({
				promptSelector: surfaceDefinition.contract.userMessage,
				promptText: command.promptText,
				answerSelector: surfaceDefinition.contract.answer,
				completionSelector: surfaceDefinition.contract.completion,
			});
		case "advance_evidence_capture":
			assertApprovedCapturePage(surfaceDefinition, readPageUrl());
			return evidenceCapture.advance(command.sessionId);
		case "end_evidence_capture":
			return evidenceCapture.end(command.sessionId);
		case "inspect_search_candidates": {
			const initialConversationUrl = readPageUrl();
			if (!isApprovedSurfaceConversationUrl(surfaceDefinition, initialConversationUrl)) {
				throw new Error("Candidate inspection requires an approved consumer conversation URL");
			}
			const currentConversationUrl = readPageUrl();
			if (
				currentConversationUrl !== initialConversationUrl ||
				!isApprovedSurfaceConversationUrl(surfaceDefinition, currentConversationUrl)
			) {
				throw new Error("Candidate inspection left the approved conversation URL");
			}
			return await probeSearchEvidenceCandidates(document, {
				surface: surfaceDefinition.surface,
				answerSelector: surfaceDefinition.contract.answer,
				candidateTextPattern: surfaceDefinition.probeTextPattern,
				maximumCandidates: 200,
				pageUrl: currentConversationUrl,
			});
		}
		case "inspect_search_evidence": {
			const initialConversationUrl = readPageUrl();
			if (!isApprovedDoubaoConversationUrl(initialConversationUrl)) {
				throw new Error("Search-evidence inspection requires an approved Doubao conversation URL");
			}
			await adapter.preflight();
			const currentConversationUrl = readPageUrl();
			if (
				currentConversationUrl !== initialConversationUrl ||
				!isApprovedDoubaoConversationUrl(currentConversationUrl)
			) {
				throw new Error("Search-evidence inspection left the approved Doubao conversation URL during preflight");
			}
			return await inspectLatestStructuredSearchEvidenceAsync(
				document,
				doubaoSelectorContract.answer,
				doubaoSelectorContract.searchEvidence,
				isDomElementVisible,
				doubaoSelectorContract.completion,
				doubaoSelectorContract.generating,
				doubaoSelectorContract.completionCompanion,
				readStructuredSearchEvidence,
			);
		}
	}
}

function isAdapterCommand(value: unknown): value is AdapterCommand {
	if (!value || typeof value !== "object" || !("kind" in value) || value.kind !== "yonaris_adapter") return false;
	if (!("action" in value) || typeof value.action !== "string") return false;
	if (
		![
			"preflight",
			"open_new_conversation",
			"prepare",
			"submit_once",
			"confirm_submitted",
			"resume_submitted",
			"collect_current_answer",
			"begin_evidence_capture",
			"advance_evidence_capture",
			"end_evidence_capture",
			"inspect_search_evidence",
			"inspect_search_candidates",
		].includes(value.action)
	)
		return false;
	return (
		(!["prepare", "submit_once", "confirm_submitted", "resume_submitted", "begin_evidence_capture"].includes(
			value.action,
		) ||
			("promptText" in value && typeof value.promptText === "string")) &&
		(!["advance_evidence_capture", "end_evidence_capture"].includes(value.action) ||
			("sessionId" in value && typeof value.sessionId === "string"))
	);
}

function assertApprovedCapturePage(surfaceDefinition: ExtensionSurfaceDefinition, pageUrl: string): void {
	if (!isApprovedSurfaceConversationUrl(surfaceDefinition, pageUrl)) {
		throw new Error("Visual evidence capture requires the approved consumer conversation URL");
	}
}
