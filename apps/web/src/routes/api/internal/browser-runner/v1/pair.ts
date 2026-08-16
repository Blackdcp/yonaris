import { createFileRoute } from "@tanstack/react-router";
import { browserRunnerErrorResponse, parseBrowserRunnerJson } from "@/server/browser-runner-auth";
import { browserRunnerPairSchema, pairBrowserRunnerDevice } from "@/server/browser-runner-devices";

export const Route = createFileRoute("/api/internal/browser-runner/v1/pair")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				try {
					const input = await parseBrowserRunnerJson(request, browserRunnerPairSchema);
					return Response.json(await pairBrowserRunnerDevice(input), {
						status: 201,
						headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
					});
				} catch (error) {
					return browserRunnerErrorResponse(error);
				}
			},
		},
	},
});
