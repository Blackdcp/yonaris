import type { AdapterError, ConsumerWebAdapter } from "./contracts";
import { createDeepSeekAdapter } from "./deepseek";
import { createDocumentDomPort } from "./dom-port";
import { createDoubaoAdapter } from "./doubao";

type AdapterCommand =
	| { kind: "yonaris_adapter"; action: "preflight" | "open_new_conversation" }
	| { kind: "yonaris_adapter"; action: "prepare" | "submit_once" | "confirm_submitted"; promptText: string }
	| { kind: "yonaris_adapter"; action: "collect_current_answer" };

const port = createDocumentDomPort(document, location);
const adapter = createAdapterForHost(location.hostname, port);

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
	if (!isAdapterCommand(message)) return false;
	void execute(adapter, message)
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

function createAdapterForHost(hostname: string, domPort: ReturnType<typeof createDocumentDomPort>): ConsumerWebAdapter {
	if (hostname === "chat.deepseek.com") return createDeepSeekAdapter(domPort);
	if (hostname === "doubao.com" || hostname.endsWith(".doubao.com")) return createDoubaoAdapter(domPort);
	throw new Error("Browser adapter is not approved for this host");
}

async function execute(adapter: ConsumerWebAdapter, command: AdapterCommand): Promise<unknown> {
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
		case "collect_current_answer":
			return adapter.collectCurrentAnswer();
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
			"collect_current_answer",
		].includes(value.action)
	)
		return false;
	return (
		!["prepare", "submit_once", "confirm_submitted"].includes(value.action) ||
		("promptText" in value && typeof value.promptText === "string")
	);
}
