import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, link, mkdtemp, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { readBrokerEvidence } from "./broker-evidence.js";
import type { BrokerEvidenceDescriptor } from "./broker-protocol.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

test("control rejects a broker evidence path outside the private handoff root", async () => {
	const root = await temporaryDirectory();
	const descriptor = evidenceDescriptor(path.resolve(root, "..", "escaped.png"), Buffer.from("png"));
	await assert.rejects(
		() => readBrokerEvidence(descriptor, { evidenceRoot: root, expectedOwnerUid: 0, expectedGroupGid: 0 }),
		/escaped/i,
	);
});

test("control reads the already-open regular file only after owner, mode, size, link count, and digest checks", {
	skip: process.platform === "win32",
}, async () => {
	const root = await temporaryDirectory();
	const content = Buffer.from("verified browser evidence");
	const filePath = path.join(root, "artifact.png");
	await writeFile(filePath, content, { mode: 0o640, flag: "wx" });
	await chmod(filePath, 0o640);
	const fileStat = await stat(filePath);
	const actual = await readBrokerEvidence(evidenceDescriptor(filePath, content), {
		evidenceRoot: root,
		expectedOwnerUid: fileStat.uid,
		expectedGroupGid: fileStat.gid,
	});
	assert.deepEqual(actual, content);
});

test("control rejects symlinked and hard-linked broker evidence", { skip: process.platform === "win32" }, async () => {
	const root = await temporaryDirectory();
	const content = Buffer.from("evidence");
	const originalPath = path.join(root, "original.png");
	const hardLinkPath = path.join(root, "hard-link.png");
	const symbolicLinkPath = path.join(root, "symbolic-link.png");
	await writeFile(originalPath, content, { mode: 0o640, flag: "wx" });
	await chmod(originalPath, 0o640);
	await link(originalPath, hardLinkPath);
	await symlink(originalPath, symbolicLinkPath);
	const fileStat = await stat(originalPath);
	const options = { evidenceRoot: root, expectedOwnerUid: fileStat.uid, expectedGroupGid: fileStat.gid };

	await assert.rejects(() => readBrokerEvidence(evidenceDescriptor(hardLinkPath, content), options), /link count/i);
	await assert.rejects(
		() => readBrokerEvidence(evidenceDescriptor(symbolicLinkPath, content), options),
		/symbolic link/i,
	);
});

test("control rejects content that does not match the broker descriptor", {
	skip: process.platform === "win32",
}, async () => {
	const root = await temporaryDirectory();
	const actual = Buffer.from("actual evidence");
	const filePath = path.join(root, "artifact.png");
	await writeFile(filePath, actual, { mode: 0o640, flag: "wx" });
	await chmod(filePath, 0o640);
	const fileStat = await stat(filePath);
	const descriptor = evidenceDescriptor(filePath, Buffer.from("different bytes"));
	descriptor.bytes = actual.byteLength;
	await assert.rejects(
		() =>
			readBrokerEvidence(descriptor, {
				evidenceRoot: root,
				expectedOwnerUid: fileStat.uid,
				expectedGroupGid: fileStat.gid,
			}),
		/digest/i,
	);
});

async function temporaryDirectory(): Promise<string> {
	const directory = await mkdtemp(path.join(tmpdir(), "yonaris-broker-evidence-"));
	if (process.platform !== "win32") await chmod(directory, 0o750);
	temporaryDirectories.push(directory);
	return directory;
}

function evidenceDescriptor(filePath: string, content: Buffer): BrokerEvidenceDescriptor {
	return {
		artifactId: "artifact-1",
		kind: "screenshot",
		path: filePath,
		mediaType: "image/png",
		sha256: createHash("sha256").update(content).digest("hex"),
		bytes: content.byteLength,
	};
}
