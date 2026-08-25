import { createFileRoute } from "@tanstack/react-router";
import { renderLlmsFull } from "@/lib/machine-documents";
import { machineDocumentResponse } from "@/lib/machine-response";

export const Route = createFileRoute("/llms-full.txt")({
	server: {
		handlers: {
			GET: () =>
				machineDocumentResponse(renderLlmsFull(), {
					language: ["en", "zh"],
					contentType: "text/plain; charset=utf-8",
					contentLocation: "/llms-full.txt",
					links: [
						{ href: "/llms-full.txt", rel: "canonical", type: "text/plain" },
						{ href: "/llms.txt", rel: "describedby", type: "text/plain" },
					],
				}),
			HEAD: () =>
				machineDocumentResponse(null, {
					language: ["en", "zh"],
					contentType: "text/plain; charset=utf-8",
					contentLocation: "/llms-full.txt",
					links: [
						{ href: "/llms-full.txt", rel: "canonical", type: "text/plain" },
						{ href: "/llms.txt", rel: "describedby", type: "text/plain" },
					],
				}),
		},
	},
});
