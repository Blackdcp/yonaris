import { createFileRoute } from "@tanstack/react-router";
import { renderAgentDocument } from "@/lib/marketing-content";

export const Route = createFileRoute("/agent/methodology")({ server: { handlers: { GET: () => new Response(renderAgentDocument("methodology"), { headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=300" } }) } } });
