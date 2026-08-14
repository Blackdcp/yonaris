import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
	responseSnapshotAccessActionEnum,
	responseSnapshotAccessEvents,
	responseSnapshotContentSourceEnum,
	responseSnapshotOutbox,
	responseSnapshotStatusEnum,
	responseSnapshots,
} from "./schema";

describe("response snapshot archive schema", () => {
	it("supports only the reviewed lifecycle and content-source values", () => {
		expect(responseSnapshotStatusEnum.enumValues).toEqual(["pending", "ready", "failed", "expired"]);
		expect(responseSnapshotContentSourceEnum.enumValues).toEqual([
			"native_answer_html",
			"browser_answer_html",
			"rendered_from_structured_response",
			"reconstructed_from_historical_run",
		]);
		expect(responseSnapshotAccessActionEnum.enumValues).toEqual([
			"view_html",
			"download_html",
			"download_json",
			"download_manifest",
			"export",
		]);
	});

	it("enforces one current immutable revision and complete lifecycle metadata", () => {
		const config = getTableConfig(responseSnapshots);
		const indexNames = config.indexes.map((index) => index.config.name);
		const checkNames = config.checks.map((constraint) => constraint.name);
		const columnNames = config.columns.map((column) => column.name);

		expect(columnNames).toEqual(
			expect.arrayContaining([
				"prompt_run_id",
				"brand_id",
				"scope_id",
				"prompt_id",
				"revision",
				"is_current",
				"status",
				"storage_backend",
				"storage_key",
				"html_sha256",
				"json_sha256",
				"manifest_sha256",
				"observed_at",
				"expires_at",
			]),
		);
		expect(indexNames).toContain("response_snapshots_prompt_run_revision_uidx");
		expect(indexNames).toContain("response_snapshots_prompt_run_current_uidx");
		expect(checkNames).toEqual(
			expect.arrayContaining([
				"response_snapshots_positive_revision",
				"response_snapshots_artifact_metadata_consistent",
				"response_snapshots_state_consistent",
				"response_snapshots_valid_retention",
			]),
		);
	});

	it("bounds temporary payloads and keeps access audit content-free", () => {
		const outbox = getTableConfig(responseSnapshotOutbox);
		const audit = getTableConfig(responseSnapshotAccessEvents);

		expect(outbox.checks.map((constraint) => constraint.name)).toEqual(
			expect.arrayContaining([
				"response_snapshot_outbox_bounded_payload",
				"response_snapshot_outbox_valid_expiry",
				"response_snapshot_outbox_nonnegative_attempts",
			]),
		);
		expect(audit.columns.map((column) => column.name)).toEqual([
			"id",
			"snapshot_id",
			"brand_id",
			"actor_user_id",
			"action",
			"created_at",
		]);
	});
});
