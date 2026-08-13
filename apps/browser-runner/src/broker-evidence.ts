import { createHash } from "node:crypto";
import { constants, type Stats } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import type { BrokerEvidenceDescriptor } from "./broker-protocol.js";

export type BrokerEvidenceReadOptions = {
	evidenceRoot: string;
	expectedOwnerUid: number;
	expectedGroupGid: number;
};

export async function readBrokerEvidence(
	descriptor: BrokerEvidenceDescriptor,
	options: BrokerEvidenceReadOptions,
): Promise<Buffer> {
	const root = path.resolve(options.evidenceRoot);
	const filePath = path.resolve(descriptor.path);
	if (!path.isAbsolute(descriptor.path) || path.dirname(filePath) !== root) {
		throw new Error("Broker evidence path escaped its private handoff root");
	}

	const rootStat = await lstat(root);
	if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("Broker evidence root is unsafe");
	if (process.platform !== "win32") {
		if (rootStat.uid !== options.expectedOwnerUid || rootStat.gid !== options.expectedGroupGid) {
			throw new Error("Broker evidence root owner is invalid");
		}
		if ((rootStat.mode & 0o777) !== 0o750) throw new Error("Broker evidence root mode must be 0750");
		if ((await realpath(root)) !== root) throw new Error("Broker evidence root resolves to another path");
	}

	const pathStat = await lstat(filePath);
	if (pathStat.isSymbolicLink()) throw new Error("Broker evidence path is a symbolic link");
	const handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
	try {
		const before = await handle.stat();
		validateOpenedEvidence(before, descriptor, options);
		const content = await handle.readFile();
		const after = await handle.stat();
		if (
			before.dev !== after.dev ||
			before.ino !== after.ino ||
			before.size !== after.size ||
			before.mtimeMs !== after.mtimeMs ||
			before.ctimeMs !== after.ctimeMs
		) {
			throw new Error("Broker evidence changed while it was being read");
		}
		const digest = createHash("sha256").update(content).digest("hex");
		if (digest !== descriptor.sha256) throw new Error("Broker evidence digest does not match its descriptor");
		return content;
	} finally {
		await handle.close();
	}
}

function validateOpenedEvidence(
	fileStat: Stats,
	descriptor: BrokerEvidenceDescriptor,
	options: BrokerEvidenceReadOptions,
): void {
	if (!fileStat.isFile()) throw new Error("Broker evidence is not a regular file");
	if (fileStat.nlink !== 1) throw new Error("Broker evidence link count must be one");
	if (fileStat.size <= 0 || fileStat.size > 7_500_000 || fileStat.size !== descriptor.bytes) {
		throw new Error("Broker evidence size does not match its descriptor");
	}
	if (process.platform !== "win32") {
		if (fileStat.uid !== options.expectedOwnerUid || fileStat.gid !== options.expectedGroupGid) {
			throw new Error("Broker evidence owner is invalid");
		}
		if ((fileStat.mode & 0o777) !== 0o640) throw new Error("Broker evidence mode must be 0640");
	}
}
