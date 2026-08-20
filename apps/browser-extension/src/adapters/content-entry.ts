import { isApprovedDoubaoConversationUrl } from "../surface-qualification-client";
import { extensionSurfaceForUrl } from "../surface-registry";
import type { AdapterError, ConsumerWebAdapter } from "./contracts";
import { createDocumentDomPort, isDomElementVisible, readStructuredSearchEvidence } from "./dom-port";
import { doubaoSelectorContract } from "./doubao";
import { inspectLatestStructuredSearchEvidenceAsync } from "./search-evidence";

type AdapterCommand =
	| { kind: "yonaris_adapter"; action: "preflight" | "open_new_conversation" }
	| {
			kind: "yonaris_adapter";
			action: "prepare" | "submit_once" | "confirm_submitted" | "resume_submitted";
			promptText: string;
	  }
	| { kind: "yonaris_adapter"; action: "collect_current_answer" }
	| { kind: "yonaris_adapter"; action: "inspect_search_evidence" };

const port = createDocumentDomPort(document, location);
const adapter = extensionSurfaceForUrl(new URL(location.href)).createAdapter(port);

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
	if (!isAdapterCommand(message)) return false;
	void execute(adapter, message, () => location.href)
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

async function execute(
	adapter: ConsumerWebAdapter,
	command: AdapterCommand,
	readPageUrl: () => string,
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
			"inspect_search_evidence",
		].includes(value.action)
	)
		return false;
	return (
		!["prepare", "submit_once", "confirm_submitted", "resume_submitted"].includes(value.action) ||
		("promptText" in value && typeof value.promptText === "string")
	);
}
