import { createFileRoute } from "@tanstack/react-router";
import { renderAgentDocument } from "@/lib/machine-documents";
import { machineDocumentResponse } from "@/lib/machine-response";

export const Route = createFileRoute("/agent/approach")({
	server: { handlers: { GET: () => machineDocumentResponse(renderAgentDocument("approach")) } },
});
