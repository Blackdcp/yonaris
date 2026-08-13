import { createFileRoute } from "@tanstack/react-router";
import { BrowserRunnerBootstrapError, createBrowserRunnerBootstrapEnvelope } from "@/server/browser-runner-bootstrap";

const responseHeaders = {
	"Cache-Control": "no-store",
	"Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
	"X-Content-Type-Options": "nosniff",
};

export const Route = createFileRoute("/api/internal/browser-runner/v1/bootstrap")({
	server: {
		handlers: {
			GET: async () => {
				try {
					return Response.json(createBrowserRunnerBootstrapEnvelope(), { headers: responseHeaders });
				} catch (error) {
					if (error instanceof BrowserRunnerBootstrapError) {
						return Response.json(
							{ error: error.name, message: error.message },
							{ status: error.status, headers: responseHeaders },
						);
					}
					console.error("Browser Runner bootstrap failed:", error);
					return Response.json(
						{ error: "BrowserRunnerBootstrapError", message: "Browser Runner bootstrap is unavailable" },
						{ status: 503, headers: responseHeaders },
					);
				}
			},
		},
	},
});
