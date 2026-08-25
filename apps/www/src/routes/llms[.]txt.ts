import { createFileRoute } from "@tanstack/react-router";
import { renderLlmsIndex } from "@/lib/machine-documents";
import { machineDocumentResponse } from "@/lib/machine-response";

export const Route = createFileRoute("/llms.txt")({
	server: {
		handlers: {
			GET: () =>
				machineDocumentResponse(renderLlmsIndex(), {
					language: ["en", "zh"],
					contentType: "text/plain; charset=utf-8",
					contentLocation: "/llms.txt",
					links: [
						{ href: "/llms.txt", rel: "canonical", type: "text/plain" },
						{ href: "/llms-full.txt", rel: "alternate", type: "text/plain" },
					],
				}),
			HEAD: () =>
				machineDocumentResponse(null, {
					language: ["en", "zh"],
					contentType: "text/plain; charset=utf-8",
					contentLocation: "/llms.txt",
					links: [
						{ href: "/llms.txt", rel: "canonical", type: "text/plain" },
						{ href: "/llms-full.txt", rel: "alternate", type: "text/plain" },
					],
				}),
		},
	},
});
