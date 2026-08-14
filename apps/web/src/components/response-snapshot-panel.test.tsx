import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CustomerPromptRunDto } from "@/server/customer-data-dto";
import { ResponseSnapshotPanel } from "./response-snapshot-panel";

const readySnapshot = {
	id: "11111111-1111-4111-8111-111111111111",
	status: "ready" as const,
	contentSource: "browser_answer_html" as const,
	createdAt: "2026-08-15T00:00:00.000Z",
	expiresAt: "2026-11-13T00:00:00.000Z",
	htmlSha256: "a".repeat(64),
	jsonSha256: "b".repeat(64),
} satisfies NonNullable<CustomerPromptRunDto["snapshot"]>;

describe("ResponseSnapshotPanel", () => {
	it.each([
		["browser_answer_html", "Browser answer HTML"],
		["native_answer_html", "Provider answer HTML"],
		["rendered_from_structured_response", "Rendered structured response"],
		["reconstructed_from_historical_run", "Historical reconstruction"],
	] as const)("renders the same read-only viewer for %s", (contentSource, expectedLabel) => {
		const markup = renderToStaticMarkup(
			<ResponseSnapshotPanel snapshot={{ ...readySnapshot, contentSource }} channel="doubao.consumer_web" />,
		);

		expect(markup).toContain("Response snapshot");
		expect(markup).toContain(expectedLabel);
		expect(markup).toContain("Retained until");
		expect(markup).toContain(readySnapshot.htmlSha256);
		expect(markup).toContain(readySnapshot.jsonSha256);
		expect(markup).toContain('sandbox=""');
		expect(markup).toContain(`/${readySnapshot.id}?asset=html&amp;download=0`);
		expect(markup).toContain("Download HTML");
		expect(markup).toContain("Download JSON");
		expect(markup).toContain("Download manifest");
		expect(markup).not.toMatch(/delete|edit|extend retention/i);
	});

	it.each([
		["pending", "Snapshot is being prepared"],
		["failed", "Snapshot is unavailable"],
		["expired", "Snapshot has expired"],
	] as const)("renders an explicit %s state", (status, message) => {
		const markup = renderToStaticMarkup(
			<ResponseSnapshotPanel
				snapshot={{
					...readySnapshot,
					status,
					contentSource: status === "pending" ? null : readySnapshot.contentSource,
				}}
				channel="doubao.consumer_web"
			/>,
		);

		expect(markup).toContain(message);
		expect(markup).not.toContain("<iframe");
	});
});
