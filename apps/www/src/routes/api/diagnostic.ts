import { createFileRoute } from "@tanstack/react-router";
import { createDiagnosticLeadHandler, sendLeadWithResend } from "@/lib/diagnostic-delivery.server";

const handleDiagnosticLead = createDiagnosticLeadHandler({
	getEnv: () => process.env,
	deliver: sendLeadWithResend,
	now: Date.now,
});

export const Route = createFileRoute("/api/diagnostic")({
	server: {
		handlers: {
			POST: ({ request }) => handleDiagnosticLead(request),
		},
	},
});
