import { createHash } from "node:crypto";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EvidenceArtifact, EvidenceCapture } from "./contracts.js";

// Leave transport overhead beneath the server's strict 8 MiB per-file limit.
export const RUNNER_EVIDENCE_MAX_BYTES = 7_500_000;

export async function saveEvidence(input: {
	runDirectory: string;
	taskId: string;
	attempt: number;
	capture: EvidenceCapture;
}): Promise<EvidenceArtifact[]> {
	const taskDirectory = path.join(input.runDirectory, "evidence", safeName(input.taskId), `attempt-${input.attempt}`);
	await mkdir(taskDirectory, { recursive: true, mode: 0o700 });
	await chmod(taskDirectory, 0o700);

	const domBytes = Buffer.from(input.capture.domSnapshot, "utf8");
	const screenshotBytes = Buffer.from(input.capture.screenshotPng);
	if (domBytes.length > RUNNER_EVIDENCE_MAX_BYTES || screenshotBytes.length > RUNNER_EVIDENCE_MAX_BYTES) {
		throw new Error(`Each evidence artifact must not exceed ${RUNNER_EVIDENCE_MAX_BYTES} bytes`);
	}
	const domPath = path.join(taskDirectory, "page.html");
	const screenshotPath = path.join(taskDirectory, "page.png");
	await Promise.all([
		writeFile(domPath, domBytes, { flag: "wx", mode: 0o600 }),
		writeFile(screenshotPath, screenshotBytes, { flag: "wx", mode: 0o600 }),
	]);
	await Promise.all([chmod(domPath, 0o600), chmod(screenshotPath, 0o600)]);

	return [
		{
			kind: "page_snapshot",
			path: domPath,
			mediaType: "text/html",
			sha256: createHash("sha256").update(domBytes).digest("hex"),
			bytes: domBytes.length,
		},
		{
			kind: "screenshot",
			path: screenshotPath,
			mediaType: "image/png",
			sha256: createHash("sha256").update(screenshotBytes).digest("hex"),
			bytes: screenshotBytes.length,
		},
	];
}

function safeName(value: string): string {
	return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160);
}
