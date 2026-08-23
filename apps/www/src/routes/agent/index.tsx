import { createFileRoute } from "@tanstack/react-router";
import { renderAgentIndex } from "@/lib/machine-documents";
import { machineDocumentResponse } from "@/lib/machine-response";

export const Route = createFileRoute("/agent/")({
	server: {
		handlers: {
			GET: () => machineDocumentResponse(renderAgentIndex()),
		},
	},
});
