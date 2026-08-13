import { chmod, lstat, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RunnerTask } from "./contracts.js";
import { BrowserRunnerError } from "./errors.js";

const DEDICATED_PROFILE_MARKER = ".yonaris-dedicated-profile.json";
const ACTIVE_SESSION_MARKER = ".yonaris-active-browser-session.json";
const MAX_MARKER_BYTES = 4_096;

const DEDICATED_PROFILE_IDENTITY = {
	schemaVersion: 1,
	surface: "doubao",
	purpose: "dedicated_sampling_profile",
} as const;

export function dedicatedProfileDirectory(stateDirectory: string): string {
	const root = path.resolve(stateDirectory);
	const profileDirectory = path.resolve(root, "dedicated-profiles", "doubao");
	const relative = path.relative(root, profileDirectory);
	if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
		throw new Error("Dedicated browser profile escaped its configured state directory");
	}
	return profileDirectory;
}

/**
 * This marker is written only after an operator has manually authenticated
 * the dedicated browser profile. Runtime task execution never creates it.
 */
export async function initializeDedicatedProfile(profileDirectory: string): Promise<void> {
	await mkdir(profileDirectory, { recursive: true, mode: 0o700 });
	await chmod(profileDirectory, 0o700);
	const markerPath = path.join(profileDirectory, DEDICATED_PROFILE_MARKER);
	try {
		await writeFile(markerPath, `${JSON.stringify(DEDICATED_PROFILE_IDENTITY)}\n`, {
			encoding: "utf8",
			flag: "wx",
			mode: 0o600,
		});
		await chmod(markerPath, 0o600);
	} catch (cause) {
		throw new BrowserRunnerError(
			"dedicated_profile_initialization_failed",
			"session_open",
			"needs_human",
			"The operator-ready Doubao profile marker could not be initialized",
			{ cause },
		);
	}
}

export async function assertDedicatedProfileReady(profileDirectory: string): Promise<void> {
	try {
		const directoryStat = await lstat(profileDirectory);
		if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) throw new Error("unsafe profile directory");
	} catch (cause) {
		throw new BrowserRunnerError(
			"dedicated_profile_missing",
			"session_open",
			"needs_human",
			"The manually authenticated Doubao sampling profile is missing",
			{ cause },
		);
	}

	const markerPath = path.join(profileDirectory, DEDICATED_PROFILE_MARKER);
	let actual: unknown;
	try {
		actual = await readMarker(markerPath);
	} catch (cause) {
		const code = isMissingFile(cause) ? "dedicated_profile_missing" : "dedicated_profile_mismatch";
		throw new BrowserRunnerError(
			code,
			"session_open",
			"needs_human",
			code === "dedicated_profile_missing"
				? "The manually authenticated Doubao sampling profile marker is missing"
				: "The Doubao profile marker is invalid or belongs to another purpose",
			{ cause },
		);
	}
	if (JSON.stringify(actual) !== JSON.stringify(DEDICATED_PROFILE_IDENTITY)) {
		throw new BrowserRunnerError(
			"dedicated_profile_mismatch",
			"session_open",
			"needs_human",
			"The Doubao profile marker is invalid or belongs to another purpose",
		);
	}
}

export async function acquireDedicatedProfileSession(
	profileDirectory: string,
	task: RunnerTask,
	sessionId: string,
): Promise<void> {
	await assertDedicatedProfileReady(profileDirectory);
	const markerPath = path.join(profileDirectory, ACTIVE_SESSION_MARKER);
	try {
		await writeFile(markerPath, `${JSON.stringify(activeSessionIdentity(task, sessionId))}\n`, {
			encoding: "utf8",
			flag: "wx",
			mode: 0o600,
		});
		await chmod(markerPath, 0o600);
	} catch (cause) {
		throw new BrowserRunnerError(
			isExistingFile(cause) ? "dedicated_profile_busy" : "dedicated_session_initialization_failed",
			"session_open",
			"needs_human",
			isExistingFile(cause)
				? "The dedicated Doubao profile has an active or unreconciled task session"
				: "The dedicated Doubao task session marker could not be created",
			{ cause },
		);
	}
}

export async function assertDedicatedProfileSession(
	profileDirectory: string,
	task: RunnerTask,
	expectedSessionId: string,
): Promise<void> {
	await assertDedicatedProfileReady(profileDirectory);
	let actual: unknown;
	try {
		actual = await readMarker(path.join(profileDirectory, ACTIVE_SESSION_MARKER));
	} catch (cause) {
		throw new BrowserRunnerError(
			"dedicated_session_mismatch",
			"post_submit",
			"needs_human",
			"The dedicated Doubao profile has no valid active task session",
			{ cause },
		);
	}
	if (JSON.stringify(actual) !== JSON.stringify(activeSessionIdentity(task, expectedSessionId))) {
		throw new BrowserRunnerError(
			"dedicated_session_mismatch",
			"post_submit",
			"needs_human",
			"The dedicated Doubao profile belongs to a different task or server attempt",
		);
	}
}

export async function releaseDedicatedProfileSession(
	profileDirectory: string,
	task: RunnerTask,
	expectedSessionId: string,
): Promise<void> {
	await assertDedicatedProfileSession(profileDirectory, task, expectedSessionId);
	await unlink(path.join(profileDirectory, ACTIVE_SESSION_MARKER));
}

function activeSessionIdentity(task: RunnerTask, sessionId: string) {
	return {
		schemaVersion: 1,
		taskId: task.id,
		sessionId,
	};
}

async function readMarker(markerPath: string): Promise<unknown> {
	const markerStat = await lstat(markerPath);
	if (
		!markerStat.isFile() ||
		markerStat.isSymbolicLink() ||
		markerStat.size <= 0 ||
		markerStat.size > MAX_MARKER_BYTES
	) {
		throw new Error("invalid marker file");
	}
	return JSON.parse(await readFile(markerPath, "utf8"));
}

function isMissingFile(error: unknown): boolean {
	return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

function isExistingFile(error: unknown): boolean {
	return Boolean(error && typeof error === "object" && "code" in error && error.code === "EEXIST");
}
