import { createHash } from "node:crypto";
import { chmod, mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { EvidenceCapture, SurfaceResponse } from "./contracts.js";
import {
	buildDeepSeekSlots,
	type DeepSeekCapturedObservation,
	deepSeekManifestFingerprint,
	parseDeepSeekCapturedObservation,
	parseDeepSeekReviewedManifest,
} from "./deepseek-capture-contract.js";

export type DeepSeekCapturePhase = "pre_submit" | "submit" | "post_submit" | "evidence";

export class DeepSeekCaptureFailure extends Error {
	readonly code: string;
	readonly phase: DeepSeekCapturePhase;
	readonly retryable: boolean;
	readonly context: { pageUrl?: string };

	constructor(code: string, phase: DeepSeekCapturePhase, retryable: boolean, context: { pageUrl?: string } = {}) {
		super(code);
		this.name = "DeepSeekCaptureFailure";
		this.code = code;
		this.phase = phase;
		this.retryable = retryable;
		this.context = context;
	}
}

export interface DeepSeekCaptureSession {
	openNewConversation(): Promise<void>;
	prepare(): Promise<void>;
	submit(promptText: string): Promise<void>;
	confirmSubmission(promptText: string): Promise<void>;
	collectResponse(): Promise<SurfaceResponse>;
	captureEvidence(): Promise<EvidenceCapture>;
	close(): Promise<void>;
}

export interface DeepSeekCaptureSessionFactory {
	create(externalId: string, promptText: string): Promise<DeepSeekCaptureSession>;
	resume(externalId: string, promptText: string, pageUrl: string): Promise<DeepSeekCaptureSession>;
}

export type DeepSeekUatApproval = {
	selectorFingerprint: string;
	profileIdentityHash: string;
	browserMajor: number;
	approvedAt: string;
};

export type DeepSeekCohortReceipt = {
	status: "complete" | "incomplete";
	planned: 18;
	captured: number;
	needsHuman: number;
	manifestFingerprint: string | null;
	manifestPath: string | null;
};

type SlotState = {
	externalId: string;
	promptSha256: string;
	selectorFingerprint: string;
	phase: "intent" | "captured";
	pageUrl: string | null;
	observation: DeepSeekCapturedObservation | null;
};

type RunOptions = {
	stateDirectory: string;
	outputPath: string;
	selectorFingerprint: string;
	sessionFactory: DeepSeekCaptureSessionFactory;
};

type UatOptions = {
	stateDirectory: string;
	selectorFingerprint: string;
	profileIdentityHash: string;
	browserMajor: number;
	sessionFactory: DeepSeekCaptureSessionFactory;
	now?: () => Date;
};

const UAT_APPROVAL_FILE = "deepseek-uat-approved.json";
const UAT_INTENT_FILE = "deepseek-uat-intent.json";
const UAT_EXTERNAL_ID = "deepseek-nonscored-uat";
const UAT_PROMPT = "请仅回复：测试通过。";

export async function approveDeepSeekUat(stateDirectory: string, approval: DeepSeekUatApproval): Promise<void> {
	validateUatApproval(approval);
	const root = path.resolve(stateDirectory);
	await secureDirectory(root);
	await writeExclusiveJson(path.join(root, UAT_APPROVAL_FILE), approval);
}

export async function runDeepSeekUatOnce(
	options: UatOptions,
): Promise<{ status: "approved"; selectorFingerprint: string }> {
	const root = path.resolve(options.stateDirectory);
	await secureDirectory(root);
	const intentPath = containedPath(root, UAT_INTENT_FILE);
	try {
		await stat(intentPath);
		throw new Error("DeepSeek UAT intent already exists; use a fresh profile instead of resubmitting");
	} catch (error) {
		if (!isNodeError(error, "ENOENT")) throw error;
	}
	let session: DeepSeekCaptureSession | undefined;
	try {
		session = await options.sessionFactory.create(UAT_EXTERNAL_ID, UAT_PROMPT);
		await session.openNewConversation();
		await session.prepare();
		await writeExclusiveJson(intentPath, {
			schemaVersion: 1,
			externalId: UAT_EXTERNAL_ID,
			promptSha256: sha256(UAT_PROMPT),
			selectorFingerprint: options.selectorFingerprint,
			profileIdentityHash: options.profileIdentityHash,
			createdAt: (options.now ?? (() => new Date()))().toISOString(),
		});
		await session.submit(UAT_PROMPT);
		await session.confirmSubmission(UAT_PROMPT);
		const response = await session.collectResponse();
		if (!response.answerText.trim()) throw new DeepSeekCaptureFailure("uat_empty_answer", "post_submit", false);
		const evidence = await session.captureEvidence();
		await persistEvidence(containedPath(root, "uat-evidence"), UAT_EXTERNAL_ID, evidence);
		await approveDeepSeekUat(root, {
			selectorFingerprint: options.selectorFingerprint,
			profileIdentityHash: options.profileIdentityHash,
			browserMajor: options.browserMajor,
			approvedAt: (options.now ?? (() => new Date()))().toISOString(),
		});
		await session.close();
		return { status: "approved", selectorFingerprint: options.selectorFingerprint };
	} catch (error) {
		await session?.close().catch(() => undefined);
		throw error;
	}
}

export async function runDeepSeekCohort(options: RunOptions): Promise<DeepSeekCohortReceipt> {
	const root = path.resolve(options.stateDirectory);
	const outputPath = path.resolve(options.outputPath);
	await secureDirectory(root);
	await assertApprovedUat(root, options.selectorFingerprint);
	const slotsDirectory = containedPath(root, "slots");
	const evidenceDirectory = containedPath(root, "evidence");
	await secureDirectory(slotsDirectory);
	await secureDirectory(evidenceDirectory);

	const observations: DeepSeekCapturedObservation[] = [];
	let needsHuman = 0;
	for (const slot of buildDeepSeekSlots()) {
		const statePath = containedPath(slotsDirectory, `${slot.externalId}.json`);
		const state = await readSlotState(statePath, slot.externalId, slot.promptText, options.selectorFingerprint);
		if (state?.phase === "captured" && state.observation) {
			observations.push(state.observation);
			continue;
		}
		if (state?.phase === "intent") {
			if (!state.pageUrl) {
				needsHuman += 1;
				continue;
			}
			const recovered = await recoverSubmittedSlot({
				slot,
				state,
				statePath,
				evidenceDirectory,
				selectorFingerprint: options.selectorFingerprint,
				sessionFactory: options.sessionFactory,
			});
			if (recovered) observations.push(recovered);
			else needsHuman += 1;
			continue;
		}

		const captured = await captureNewSlot({
			slot,
			statePath,
			evidenceDirectory,
			selectorFingerprint: options.selectorFingerprint,
			sessionFactory: options.sessionFactory,
		});
		if (captured) observations.push(captured);
		else needsHuman += 1;
	}

	if (observations.length !== 18 || needsHuman !== 0) {
		return {
			status: "incomplete",
			planned: 18,
			captured: observations.length,
			needsHuman,
			manifestFingerprint: null,
			manifestPath: null,
		};
	}

	observations.sort((left, right) => left.externalId.localeCompare(right.externalId));
	const manifest = parseDeepSeekReviewedManifest({
		schemaVersion: 1,
		importId: "stepfun-local-pc-deepseek-18-20260814",
		brandId: "stepfun",
		scopeKey: "cn-zh-scored",
		market: "CN",
		locale: "zh-CN",
		timezone: "Asia/Shanghai",
		evaluationRole: "scored",
		model: "deepseek",
		surfaceTargetKey: "deepseek.consumer_web",
		captureRouteKey: "assisted_browser.generic",
		sessionMode: "dedicated_sampling_profile",
		searchMode: "native_auto",
		observations,
	});
	const fingerprint = deepSeekManifestFingerprint(manifest);
	await writeManifestIdempotently(outputPath, manifest, fingerprint);
	return {
		status: "complete",
		planned: 18,
		captured: 18,
		needsHuman: 0,
		manifestFingerprint: fingerprint,
		manifestPath: outputPath,
	};
}

async function captureNewSlot(input: {
	slot: ReturnType<typeof buildDeepSeekSlots>[number];
	statePath: string;
	evidenceDirectory: string;
	selectorFingerprint: string;
	sessionFactory: DeepSeekCaptureSessionFactory;
}): Promise<DeepSeekCapturedObservation | null> {
	for (let attempt = 1; attempt <= 2; attempt += 1) {
		let session: DeepSeekCaptureSession | undefined;
		let intentRecorded = false;
		try {
			session = await input.sessionFactory.create(input.slot.externalId, input.slot.promptText);
			await session.openNewConversation();
			await session.prepare();
			const state: SlotState = {
				externalId: input.slot.externalId,
				promptSha256: sha256(input.slot.promptText),
				selectorFingerprint: input.selectorFingerprint,
				phase: "intent",
				pageUrl: null,
				observation: null,
			};
			await writeExclusiveJson(input.statePath, state);
			intentRecorded = true;
			await session.submit(input.slot.promptText);
			await session.confirmSubmission(input.slot.promptText);
			const observation = await completeSlot(input, session);
			await session.close();
			return observation;
		} catch (error) {
			await session?.close().catch(() => undefined);
			const failure = toCaptureFailure(error, intentRecorded);
			if (!intentRecorded && failure.phase === "pre_submit" && failure.retryable && attempt === 1) continue;
			if (intentRecorded) {
				await updateIntentStateWithPageUrl(input.statePath, failure.context.pageUrl ?? null);
			}
			return null;
		}
	}
	return null;
}

async function recoverSubmittedSlot(input: {
	slot: ReturnType<typeof buildDeepSeekSlots>[number];
	state: SlotState;
	statePath: string;
	evidenceDirectory: string;
	selectorFingerprint: string;
	sessionFactory: DeepSeekCaptureSessionFactory;
}): Promise<DeepSeekCapturedObservation | null> {
	if (!input.state.pageUrl) return null;
	let session: DeepSeekCaptureSession | undefined;
	try {
		session = await input.sessionFactory.resume(input.slot.externalId, input.slot.promptText, input.state.pageUrl);
		await session.confirmSubmission(input.slot.promptText);
		const observation = await completeSlot(input, session);
		await session.close();
		return observation;
	} catch {
		await session?.close().catch(() => undefined);
		return null;
	}
}

async function completeSlot(
	input: {
		slot: ReturnType<typeof buildDeepSeekSlots>[number];
		statePath: string;
		evidenceDirectory: string;
		selectorFingerprint: string;
	},
	session: DeepSeekCaptureSession,
): Promise<DeepSeekCapturedObservation> {
	const response = await session.collectResponse();
	const evidence = await session.captureEvidence();
	const digests = await persistEvidence(input.evidenceDirectory, input.slot.externalId, evidence);
	const observation = parseDeepSeekCapturedObservation({
		...input.slot,
		answerText: response.answerText,
		observedAt: response.observedAt,
		pageUrl: response.pageUrl,
		webSearchObserved: response.webSearchObserved ?? null,
		webQueries: response.webQueries,
		citations: response.citations.map((citation, citationIndex) => ({
			url: citation.url,
			title: citation.title ?? new URL(citation.url).hostname,
			citationIndex,
		})),
		evidence: digests,
	});
	await writeAtomicJson(input.statePath, {
		externalId: input.slot.externalId,
		promptSha256: sha256(input.slot.promptText),
		selectorFingerprint: input.selectorFingerprint,
		phase: "captured",
		pageUrl: observation.pageUrl,
		observation,
	} satisfies SlotState);
	return observation;
}

async function persistEvidence(
	evidenceRoot: string,
	externalId: string,
	evidence: EvidenceCapture,
): Promise<{ screenshotSha256: string; pageSnapshotSha256: string }> {
	const directory = containedPath(evidenceRoot, externalId);
	await secureDirectory(directory);
	const screenshot = new Uint8Array(evidence.screenshotPng);
	const snapshot = Buffer.from(evidence.domSnapshot, "utf8");
	if (screenshot.byteLength < 8 || screenshot.byteLength > 7_500_000 || snapshot.byteLength > 7_500_000) {
		throw new DeepSeekCaptureFailure("evidence_size_invalid", "evidence", false);
	}
	await writeExclusiveBytes(containedPath(directory, "screenshot.png"), screenshot);
	await writeExclusiveBytes(containedPath(directory, "page.html"), snapshot);
	return { screenshotSha256: sha256(screenshot), pageSnapshotSha256: sha256(snapshot) };
}

async function assertApprovedUat(root: string, selectorFingerprint: string): Promise<void> {
	let approval: DeepSeekUatApproval;
	try {
		approval = JSON.parse(await readFile(containedPath(root, UAT_APPROVAL_FILE), "utf8")) as DeepSeekUatApproval;
	} catch {
		throw new Error("An approved DeepSeek UAT is required before scored capture");
	}
	validateUatApproval(approval);
	if (approval.selectorFingerprint !== selectorFingerprint) {
		throw new Error("An approved DeepSeek UAT matching the selector contract is required before scored capture");
	}
}

function validateUatApproval(approval: DeepSeekUatApproval): void {
	if (
		!/^deepseek-[A-Za-z0-9._:-]{8,100}$/.test(approval.selectorFingerprint) ||
		!/^[0-9a-f]{64}$/.test(approval.profileIdentityHash) ||
		!Number.isInteger(approval.browserMajor) ||
		approval.browserMajor < 100 ||
		approval.browserMajor > 999 ||
		Number.isNaN(new Date(approval.approvedAt).getTime())
	) {
		throw new Error("Invalid approved DeepSeek UAT marker");
	}
}

async function readSlotState(
	statePath: string,
	externalId: string,
	promptText: string,
	selectorFingerprint: string,
): Promise<SlotState | null> {
	try {
		const state = JSON.parse(await readFile(statePath, "utf8")) as SlotState;
		if (
			state.externalId !== externalId ||
			state.selectorFingerprint !== selectorFingerprint ||
			(state.phase !== "intent" && state.phase !== "captured") ||
			(state.phase === "captured" && !state.observation)
		) {
			throw new Error("DeepSeek slot state does not match the frozen capture contract");
		}
		if (state.promptSha256 !== sha256(promptText)) {
			throw new Error("DeepSeek slot prompt hash does not match the frozen capture contract");
		}
		return state;
	} catch (error) {
		if (isNodeError(error, "ENOENT")) return null;
		throw error;
	}
}

async function updateIntentStateWithPageUrl(statePath: string, pageUrl: string | null): Promise<void> {
	const state = JSON.parse(await readFile(statePath, "utf8")) as SlotState;
	if (state.phase !== "intent") throw new Error("DeepSeek submit intent state is not recoverable");
	await writeAtomicJson(statePath, { ...state, pageUrl });
}

async function writeManifestIdempotently(outputPath: string, manifest: unknown, fingerprint: string): Promise<void> {
	try {
		const existing = parseDeepSeekReviewedManifest(JSON.parse(await readFile(outputPath, "utf8")));
		if (deepSeekManifestFingerprint(existing) !== fingerprint) {
			throw new Error("Reviewed DeepSeek manifest already exists with a different fingerprint");
		}
		return;
	} catch (error) {
		if (!isNodeError(error, "ENOENT")) throw error;
	}
	await mkdir(path.dirname(outputPath), { recursive: true });
	await writeExclusiveJson(outputPath, manifest);
}

async function writeExclusiveJson(filePath: string, value: unknown): Promise<void> {
	await writeExclusiveBytes(filePath, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"));
}

async function writeExclusiveBytes(filePath: string, value: Uint8Array): Promise<void> {
	const handle = await open(filePath, "wx", 0o600);
	try {
		await handle.writeFile(value);
		await handle.sync();
	} finally {
		await handle.close();
	}
	await chmod(filePath, 0o600);
}

async function writeAtomicJson(filePath: string, value: unknown): Promise<void> {
	const candidate = `${filePath}.${process.pid}.${Date.now()}.tmp`;
	await writeExclusiveJson(candidate, value);
	try {
		await rename(candidate, filePath);
	} catch (error) {
		await rm(candidate, { force: true }).catch(() => undefined);
		throw error;
	}
}

async function secureDirectory(directory: string): Promise<void> {
	await mkdir(directory, { recursive: true, mode: 0o700 });
	await chmod(directory, 0o700);
	const info = await stat(directory);
	if (!info.isDirectory()) throw new Error("DeepSeek state path must be a directory");
}

function containedPath(root: string, child: string): string {
	const resolvedRoot = path.resolve(root);
	const resolved = path.resolve(resolvedRoot, child);
	if (resolved === resolvedRoot || !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
		throw new Error("DeepSeek state path escaped its private root");
	}
	return resolved;
}

function toCaptureFailure(error: unknown, afterIntent: boolean): DeepSeekCaptureFailure {
	if (error instanceof DeepSeekCaptureFailure) return error;
	return new DeepSeekCaptureFailure(
		afterIntent ? "post_submit_unknown" : "pre_submit_unknown",
		afterIntent ? "post_submit" : "pre_submit",
		false,
	);
}

function sha256(value: string | Uint8Array): string {
	return createHash("sha256").update(value).digest("hex");
}

function isNodeError(error: unknown, code: string): boolean {
	return error instanceof Error && "code" in error && error.code === code;
}
