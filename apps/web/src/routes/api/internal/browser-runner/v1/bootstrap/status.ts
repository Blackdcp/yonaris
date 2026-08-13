import { createFileRoute } from "@tanstack/react-router";
import { browserRunnerErrorResponse, requireBrowserRunner } from "@/server/browser-runner-auth";

export const Route = createFileRoute("/api/internal/browser-runner/v1/bootstrap/status")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) => {
				try {
					return Response.json(
						{ ready: true, runner: requireBrowserRunner(request) },
						{ headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
					);
				} catch (error) {
					return browserRunnerErrorResponse(error);
				}
			},
		},
	},
});
