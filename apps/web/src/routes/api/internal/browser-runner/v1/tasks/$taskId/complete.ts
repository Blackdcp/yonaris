import { createFileRoute } from "@tanstack/react-router";
import { browserRunnerErrorResponse, parseBrowserRunnerJson, requireBrowserRunner } from "@/server/browser-runner-auth";
import { browserRunnerObservationSchema, completeRunnerTask } from "@/server/browser-runner-service";

export const Route = createFileRoute("/api/internal/browser-runner/v1/tasks/$taskId/complete")({
	server: {
		handlers: {
			POST: async ({ request, params }: { request: Request; params: { taskId: string } }) => {
				try {
					const principal = await requireBrowserRunner(request);
					const input = await parseBrowserRunnerJson(request, browserRunnerObservationSchema, {
						maxBytes: 6 * 1024 * 1024,
					});
					return Response.json(await completeRunnerTask(params.taskId, input, principal.id), {
						headers: { "Cache-Control": "no-store" },
					});
				} catch (error) {
					return browserRunnerErrorResponse(error);
				}
			},
		},
	},
});
