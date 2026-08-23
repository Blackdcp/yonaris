import { createFileRoute } from "@tanstack/react-router";
import { permanentRedirectResponse } from "@/lib/permanent-redirect";
import { getRedirect } from "@/lib/site-manifest";

const redirect = getRedirect("/methodology");
if (!redirect) throw new Error("Missing manifest redirect for /methodology");

export const Route = createFileRoute("/methodology")({
	server: { handlers: { GET: ({ request }) => permanentRedirectResponse(request, redirect.to) } },
});
