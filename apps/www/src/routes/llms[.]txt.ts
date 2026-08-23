import { createFileRoute } from "@tanstack/react-router";
import { renderLlmsIndex } from "@/lib/machine-documents";
import { machineDocumentResponse } from "@/lib/machine-response";

export const Route = createFileRoute("/llms.txt")({
	server: {
		handlers: {
			GET() {
				return machineDocumentResponse(renderLlmsIndex(), { contentType: "text/plain; charset=utf-8" });
			},
		},
	},
});
