import { createFileRoute } from "@tanstack/react-router";
import { permanentRedirectResponse } from "@/lib/permanent-redirect";
import { getRedirect } from "@/lib/site-manifest";

const redirect = getRedirect("/agent/methodology");
if (!redirect) throw new Error("Missing manifest redirect for /agent/methodology");

export const Route = createFileRoute("/agent/methodology")({
	server: { handlers: { GET: ({ request }) => permanentRedirectResponse(request, redirect.to) } },
});
