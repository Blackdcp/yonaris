import { createFileRoute } from "@tanstack/react-router";
import { browserRunnerErrorResponse, parseBrowserRunnerJson, requireBrowserRunner } from "@/server/browser-runner-auth";
import {
	browserRunnerDeviceHeartbeatSchema,
	updateBrowserRunnerDeviceHeartbeat,
} from "@/server/browser-runner-devices";

export const Route = createFileRoute("/api/internal/browser-runner/v1/device/heartbeat")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => {
				try {
					const principal = await requireBrowserRunner(request);
					const input = await parseBrowserRunnerJson(request, browserRunnerDeviceHeartbeatSchema);
					return Response.json(await updateBrowserRunnerDeviceHeartbeat(principal, input), {
						headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
					});
				} catch (error) {
					return browserRunnerErrorResponse(error);
				}
			},
		},
	},
});
