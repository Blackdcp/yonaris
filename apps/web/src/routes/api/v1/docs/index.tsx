import { createFileRoute } from "@tanstack/react-router";
import spec from "@workspace/api-spec";

export const Route = createFileRoute("/api/v1/docs/")({
	server: {
		handlers: {
			GET: () => Response.json(spec),
		},
	},
	component: () => null,
});
