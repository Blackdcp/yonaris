import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CustomerPromptRunDto } from "@/server/customer-data-dto";
import { ResponseSnapshotExportControls, ResponseSnapshotPanel } from "./response-snapshot-panel";

const readySnapshot = {
	id: "11111111-1111-4111-8111-111111111111",
	status: "ready" as const,
	schemaVersion: "response-snapshot.v2",
	contentSource: "rendered_from_structured_response" as const,
	createdAt: "2026-08-15T00:00:00.000Z",
	expiresAt: "2026-11-13T00:00:00.000Z",
	htmlSha256: "a".repeat(64),
	jsonSha256: "b".repeat(64),
	visualEvidence: {
		mediaType: "image/jpeg" as const,
		sha256: "c".repeat(64),
		bytes: 12345,
	},
} satisfies NonNullable<CustomerPromptRunDto["snapshot"]>;

describe("ResponseSnapshotPanel", () => {
	it.each([
		["browser_answer_html", "Browser answer HTML"],
		["native_answer_html", "Provider answer HTML"],
		["rendered_from_structured_response", "Rendered structured response"],
		["reconstructed_from_historical_run", "Historical reconstruction"],
	] as const)("renders the same read-only viewer for %s", (contentSource, expectedLabel) => {
		const structured = contentSource === "rendered_from_structured_response";
		const markup = renderToStaticMarkup(
			<ResponseSnapshotPanel
				snapshot={{
					...readySnapshot,
					schemaVersion: structured ? "response-snapshot.v2" : "response-snapshot.v1",
					contentSource,
					visualEvidence: structured ? readySnapshot.visualEvidence : null,
				}}
				channel="doubao.consumer_web"
			/>,
		);

		expect(markup).toContain("Response snapshot");
		expect(markup).toContain(expectedLabel);
		expect(markup).toContain("Retained until");
		expect(markup).toContain(readySnapshot.htmlSha256);
		expect(markup).toContain(readySnapshot.jsonSha256);
		expect(markup).toContain('sandbox=""');
		expect(markup).toContain(`/${readySnapshot.id}?asset=html&amp;download=0`);
		if (structured) {
			expect(markup).toContain(`/${readySnapshot.id}?asset=screenshot&amp;download=0`);
			expect(markup).toContain("Captured browser evidence");
			expect(markup).toContain(readySnapshot.visualEvidence.sha256);
		} else {
			expect(markup).not.toContain("Captured browser evidence");
			expect(markup).not.toContain("asset=screenshot");
		}
		expect(markup).toContain("Download HTML");
		expect(markup.includes("Download screenshot")).toBe(structured);
		expect(markup).toContain("Download JSON");
		expect(markup).toContain("Download manifest");
		expect(markup).not.toMatch(/delete|edit|extend retention/i);
	});

	it("keeps legacy snapshots usable without showing a broken screenshot", () => {
		const markup = renderToStaticMarkup(
			<ResponseSnapshotPanel
				snapshot={{
					...readySnapshot,
					schemaVersion: "response-snapshot.v1",
					contentSource: "browser_answer_html",
					visualEvidence: null,
				}}
				channel="doubao.consumer_web"
			/>,
		);

		expect(markup).toContain("Response snapshot");
		expect(markup).toContain("Download HTML");
		expect(markup).not.toContain("Captured browser evidence");
		expect(markup).not.toContain("asset=screenshot");
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

describe("ResponseSnapshotExportControls", () => {
	it("offers a bounded read-only date range export", () => {
		const markup = renderToStaticMarkup(<ResponseSnapshotExportControls brandId="stepfun" initialDate="2026-08-15" />);

		expect(markup).toContain("Export response snapshots");
		expect(markup).toContain('type="date"');
		expect(markup).toContain("Estimate export");
		expect(markup).toContain("Up to 31 days");
		expect(markup).toContain("HTML, JSON and manifest");
		expect(markup).not.toMatch(/delete|edit|extend retention/i);
	});
});
