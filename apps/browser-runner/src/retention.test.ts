import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { cleanupExpiredRunnerState } from "./retention.js";

test("bounded retention removes expired runs and retained handoff profiles", async () => {
	const root = await mkdtemp(path.join(tmpdir(), "browser-runner-retention-"));
	const now = new Date("2026-08-13T12:00:00.000Z");
	const old = new Date("2026-08-01T12:00:00.000Z");
	const runDirectory = path.join(root, "runs", "old-run");
	const profileDirectory = path.join(root, "profiles", "old-profile");
	const handoffPath = path.join(root, "handoffs", "old-handoff.json");
	try {
		await mkdir(runDirectory, { recursive: true });
		await writeFile(path.join(runDirectory, "summary.json"), "{}\n");
		await utimes(runDirectory, old, old);
		await mkdir(profileDirectory, { recursive: true });
		await writeFile(path.join(profileDirectory, "state"), "retained");
		await mkdir(path.dirname(handoffPath), { recursive: true });
		await writeFile(handoffPath, JSON.stringify({ createdAt: old.toISOString(), profileDirectory }));

		const result = await cleanupExpiredRunnerState(root, {
			now,
			retentionMs: 7 * 24 * 60 * 60 * 1_000,
		});
		assert.equal(result.blocked, 0);
		assert.equal(await exists(runDirectory), false);
		assert.equal(await exists(profileDirectory), false);
		assert.equal(await exists(handoffPath), false);
		assert.match(await readFile(path.join(root, "retention.jsonl"), "utf8"), /expired_handoff/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("retention refuses an out-of-root handoff and records the blocked cleanup", async () => {
	const root = await mkdtemp(path.join(tmpdir(), "browser-runner-retention-root-"));
	const outside = await mkdtemp(path.join(tmpdir(), "browser-runner-retention-outside-"));
	const handoffPath = path.join(root, "handoffs", "unsafe.json");
	try {
		await writeFile(path.join(outside, "do-not-delete"), "sentinel");
		await mkdir(path.dirname(handoffPath), { recursive: true });
		await writeFile(handoffPath, JSON.stringify({ createdAt: "2026-08-01T00:00:00.000Z", profileDirectory: outside }));
		const result = await cleanupExpiredRunnerState(root, {
			now: new Date("2026-08-13T12:00:00.000Z"),
			retentionMs: 7 * 24 * 60 * 60 * 1_000,
		});
		assert.equal(result.blocked, 1);
		assert.equal(await exists(path.join(outside, "do-not-delete")), true);
		assert.equal(await exists(handoffPath), true);
		assert.match(await readFile(path.join(root, "retention.jsonl"), "utf8"), /unsafe_retention_path/);
	} finally {
		await rm(root, { recursive: true, force: true });
		await rm(outside, { recursive: true, force: true });
	}
});

async function exists(target: string): Promise<boolean> {
	try {
		await stat(target);
		return true;
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
		throw error;
	}
}
