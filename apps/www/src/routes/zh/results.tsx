import { createFileRoute } from "@tanstack/react-router";
import { permanentRedirectResponse } from "@/lib/permanent-redirect";
import { getRedirect } from "@/lib/site-manifest";

const redirect = getRedirect("/zh/results");
if (!redirect) throw new Error("Missing manifest redirect for /zh/results");

export const Route = createFileRoute("/zh/results")({
	server: { handlers: { GET: ({ request }) => permanentRedirectResponse(request, redirect.to) } },
});
