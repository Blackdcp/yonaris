import { createFileRoute } from "@tanstack/react-router";
import { browserRunnerErrorResponse, requireBrowserRunner } from "@/server/browser-runner-auth";

export const Route = createFileRoute("/api/internal/browser-runner/v1/bootstrap/status")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) => {
				try {
					const runner = await requireBrowserRunner(request);
					return Response.json(
						{
							ready: true,
							runner: {
								id: runner.id,
								market: runner.market,
								locale: runner.locale,
								timezone: runner.timezone,
							},
						},
						{ headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
					);
				} catch (error) {
					return browserRunnerErrorResponse(error);
				}
			},
		},
	},
});
