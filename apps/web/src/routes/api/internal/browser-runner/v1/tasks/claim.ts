import { createFileRoute } from "@tanstack/react-router";
import { browserRunnerErrorResponse, parseBrowserRunnerJson, requireBrowserRunner } from "@/server/browser-runner-auth";
import { browserRunnerClaimSchema, claimRunnerTask, getRunnerQueueState } from "@/server/browser-runner-service";

export const Route = createFileRoute("/api/internal/browser-runner/v1/tasks/claim")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				try {
					const principal = await requireBrowserRunner(request);
					const input = await parseBrowserRunnerJson(request, browserRunnerClaimSchema);
					const claim = await claimRunnerTask(input, principal);
					return Response.json(
						{ claim, ...(claim === null ? { queueState: await getRunnerQueueState(input, principal) } : {}) },
						{ headers: { "Cache-Control": "no-store" } },
					);
				} catch (error) {
					return browserRunnerErrorResponse(error);
				}
			},
		},
	},
});
