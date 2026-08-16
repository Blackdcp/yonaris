import { createFileRoute } from "@tanstack/react-router";
import { browserRunnerErrorResponse, parseBrowserRunnerJson, requireBrowserRunner } from "@/server/browser-runner-auth";
import { browserRunnerSessionLeaseSchema, recordRunnerSubmitConfirmed } from "@/server/browser-runner-service";

export const Route = createFileRoute("/api/internal/browser-runner/v1/tasks/$taskId/submit-confirmed")({
	server: {
		handlers: {
			POST: async ({ request, params }: { request: Request; params: { taskId: string } }) => {
				try {
					const principal = await requireBrowserRunner(request);
					const input = await parseBrowserRunnerJson(request, browserRunnerSessionLeaseSchema);
					return Response.json(await recordRunnerSubmitConfirmed(params.taskId, input, principal), {
						headers: { "Cache-Control": "no-store" },
					});
				} catch (error) {
					return browserRunnerErrorResponse(error);
				}
			},
		},
	},
});
