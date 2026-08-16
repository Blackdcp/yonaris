import { readFile, realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";

export const SAMPLING_BATCH_SURFACE_TARGET = "doubao.consumer_web";
export const SAMPLING_BATCH_CAPTURE_ROUTE = "browser_runner.doubao";
export const SAMPLING_BATCH_REQUEST_ID = "stepfun-cn-doubao-6x-20260816-v5";
export const SAMPLING_BATCH_IDEMPOTENCY_KEY = "sampling:stepfun:cn-zh-scored:doubao:6x:2026-08-16-v5";
export const SAMPLING_BATCH_NAME = "StepFun CN Doubao formal sampling 2026-08-16 - 6x - v5";
export const SAMPLING_BATCH_WINDOW_STARTS_AT = "2026-08-16T00:00:00+08:00";
export const SAMPLING_BATCH_WINDOW_ENDS_AT = "2026-08-23T23:59:59+08:00";

export const EXPECTED_STEPFUN_PROMPTS = [
	"国内有哪些主流大模型公司?",
	"如果我要选择国产大模型服务商,有哪些推荐?",
	"阶跃星辰 StepFun 是一家什么公司?",
] as const;

export type SamplingBatchCliMode = "dry-run" | "apply" | "status-only";

export type SamplingBatchCliOptions = {
	requestFile: string;
	mode: SamplingBatchCliMode;
};

export type SamplingBatchRequest = {
	schemaVersion: 1;
	requestId: typeof SAMPLING_BATCH_REQUEST_ID;
	batch: {
		idempotencyKey: typeof SAMPLING_BATCH_IDEMPOTENCY_KEY;
		name: typeof SAMPLING_BATCH_NAME;
	};
	brand: { nameExact: "StepFun" };
	scope: {
		keyExact: "cn-zh-scored";
		marketExact: "CN";
		localeExact: "zh-CN";
		timezoneExact: "Asia/Shanghai";
		evaluationRoleExact: "scored";
	};
	promptSelection: {
		enabledCountExact: 3;
		textsExact: typeof EXPECTED_STEPFUN_PROMPTS;
	};
	execution: {
		mode: "browser_runner";
		surfaceTargetKey: typeof SAMPLING_BATCH_SURFACE_TARGET;
		captureRouteKey: typeof SAMPLING_BATCH_CAPTURE_ROUTE;
		samplesPerPrompt: 6;
		sessionRequirement: "dedicated_sampling_profile";
		searchRequirement: "platform_default";
	};
	measurementWindow: {
		startsAt: typeof SAMPLING_BATCH_WINDOW_STARTS_AT;
		endsAt: typeof SAMPLING_BATCH_WINDOW_ENDS_AT;
		timezone: "Asia/Shanghai";
	};
};

export class SamplingBatchRequestError extends Error {
	constructor(
		readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "SamplingBatchRequestError";
	}
}

const DEFAULT_REQUEST_DIRECTORY = resolve(__dirname, "sampling-batch-requests");
const MAX_REQUEST_BYTES = 16 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
	const actual = Object.keys(value).sort();
	const expected = [...keys].sort();
	return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function parseSamplingBatchCliOptions(argv: string[]): SamplingBatchCliOptions {
	let requestFile: string | undefined;
	let apply = false;
	let statusOnly = false;

	for (let index = 0; index < argv.length; index++) {
		const argument = argv[index];
		if (argument === "--apply" || argument === "--status-only") {
			if ((argument === "--apply" && apply) || (argument === "--status-only" && statusOnly)) {
				throw new SamplingBatchRequestError("duplicate_option", "An option was supplied more than once");
			}
			if (argument === "--apply") apply = true;
			else statusOnly = true;
			continue;
		}
		if (argument !== "--request-file") {
			throw new SamplingBatchRequestError("unknown_option", "Unknown option");
		}
		if (requestFile !== undefined) {
			throw new SamplingBatchRequestError("duplicate_option", "An option was supplied more than once");
		}
		const value = argv[index + 1];
		if (!value || value.startsWith("--")) {
			throw new SamplingBatchRequestError("missing_request_file", "--request-file requires a value");
		}
		requestFile = value;
		index++;
	}

	if (!requestFile) {
		throw new SamplingBatchRequestError("request_file_required", "--request-file is required");
	}
	if (apply && statusOnly) {
		throw new SamplingBatchRequestError("conflicting_mode", "--apply cannot be combined with --status-only");
	}
	return { requestFile, mode: statusOnly ? "status-only" : apply ? "apply" : "dry-run" };
}

function exactPromptSet(value: unknown): value is string[] {
	if (!Array.isArray(value) || value.length !== EXPECTED_STEPFUN_PROMPTS.length) return false;
	if (value.some((entry) => typeof entry !== "string")) return false;
	const actual = [...value].sort();
	const expected = [...EXPECTED_STEPFUN_PROMPTS].sort();
	return actual.every((entry, index) => entry === expected[index]);
}

export function parseSamplingBatchRequest(value: unknown): SamplingBatchRequest {
	if (
		!isRecord(value) ||
		!exactKeys(value, [
			"schemaVersion",
			"requestId",
			"batch",
			"brand",
			"scope",
			"promptSelection",
			"execution",
			"measurementWindow",
		])
	) {
		throw new SamplingBatchRequestError("invalid_manifest_shape", "The request manifest has an invalid shape");
	}
	if (value.schemaVersion !== 1 || value.requestId !== SAMPLING_BATCH_REQUEST_ID) {
		throw new SamplingBatchRequestError(
			"invalid_request_identity",
			"The request identity is not the reviewed one-shot",
		);
	}
	if (
		!isRecord(value.batch) ||
		!exactKeys(value.batch, ["idempotencyKey", "name"]) ||
		value.batch.idempotencyKey !== SAMPLING_BATCH_IDEMPOTENCY_KEY ||
		value.batch.name !== SAMPLING_BATCH_NAME
	) {
		throw new SamplingBatchRequestError("invalid_batch_identity", "The batch identity is not the reviewed one-shot");
	}
	if (!isRecord(value.brand) || !exactKeys(value.brand, ["nameExact"]) || value.brand.nameExact !== "StepFun") {
		throw new SamplingBatchRequestError("invalid_brand_contract", "The request must target StepFun exactly");
	}
	if (
		!isRecord(value.scope) ||
		!exactKeys(value.scope, ["keyExact", "marketExact", "localeExact", "timezoneExact", "evaluationRoleExact"]) ||
		value.scope.keyExact !== "cn-zh-scored" ||
		value.scope.marketExact !== "CN" ||
		value.scope.localeExact !== "zh-CN" ||
		value.scope.timezoneExact !== "Asia/Shanghai" ||
		value.scope.evaluationRoleExact !== "scored"
	) {
		throw new SamplingBatchRequestError(
			"invalid_scope_contract",
			"The request must target the StepFun CN scored scope",
		);
	}
	if (
		!isRecord(value.promptSelection) ||
		!exactKeys(value.promptSelection, ["enabledCountExact", "textsExact"]) ||
		value.promptSelection.enabledCountExact !== 3 ||
		!exactPromptSet(value.promptSelection.textsExact)
	) {
		throw new SamplingBatchRequestError(
			"invalid_prompt_contract",
			"The request must contain exactly the three reviewed enabled prompt texts",
		);
	}
	if (
		!isRecord(value.execution) ||
		!exactKeys(value.execution, [
			"mode",
			"surfaceTargetKey",
			"captureRouteKey",
			"samplesPerPrompt",
			"sessionRequirement",
			"searchRequirement",
		]) ||
		value.execution.mode !== "browser_runner" ||
		value.execution.surfaceTargetKey !== SAMPLING_BATCH_SURFACE_TARGET ||
		value.execution.captureRouteKey !== SAMPLING_BATCH_CAPTURE_ROUTE ||
		value.execution.samplesPerPrompt !== 6 ||
		value.execution.sessionRequirement !== "dedicated_sampling_profile" ||
		value.execution.searchRequirement !== "platform_default"
	) {
		throw new SamplingBatchRequestError(
			"invalid_execution_contract",
			"The request must use the fixed Doubao Browser Runner 3x6 execution contract",
		);
	}
	if (
		!isRecord(value.measurementWindow) ||
		!exactKeys(value.measurementWindow, ["startsAt", "endsAt", "timezone"]) ||
		value.measurementWindow.startsAt !== SAMPLING_BATCH_WINDOW_STARTS_AT ||
		value.measurementWindow.endsAt !== SAMPLING_BATCH_WINDOW_ENDS_AT ||
		value.measurementWindow.timezone !== "Asia/Shanghai"
	) {
		throw new SamplingBatchRequestError(
			"invalid_measurement_window",
			"The request must use the reviewed Beijing measurement window",
		);
	}

	return {
		schemaVersion: 1,
		requestId: SAMPLING_BATCH_REQUEST_ID,
		batch: { idempotencyKey: SAMPLING_BATCH_IDEMPOTENCY_KEY, name: SAMPLING_BATCH_NAME },
		brand: { nameExact: "StepFun" },
		scope: {
			keyExact: "cn-zh-scored",
			marketExact: "CN",
			localeExact: "zh-CN",
			timezoneExact: "Asia/Shanghai",
			evaluationRoleExact: "scored",
		},
		promptSelection: { enabledCountExact: 3, textsExact: [...EXPECTED_STEPFUN_PROMPTS] },
		execution: {
			mode: "browser_runner",
			surfaceTargetKey: SAMPLING_BATCH_SURFACE_TARGET,
			captureRouteKey: SAMPLING_BATCH_CAPTURE_ROUTE,
			samplesPerPrompt: 6,
			sessionRequirement: "dedicated_sampling_profile",
			searchRequirement: "platform_default",
		},
		measurementWindow: {
			startsAt: SAMPLING_BATCH_WINDOW_STARTS_AT,
			endsAt: SAMPLING_BATCH_WINDOW_ENDS_AT,
			timezone: "Asia/Shanghai",
		},
	};
}

export async function readSamplingBatchRequestFile(
	requestFile: string,
	requestDirectory = DEFAULT_REQUEST_DIRECTORY,
): Promise<SamplingBatchRequest> {
	let requestRoot: string;
	let requestedPath: string;
	try {
		requestRoot = await realpath(requestDirectory);
		requestedPath = await realpath(resolve(process.cwd(), requestFile));
	} catch {
		throw new SamplingBatchRequestError("request_file_unreadable", "The request manifest could not be read");
	}
	const pathWithinRoot = relative(requestRoot, requestedPath);
	if (
		pathWithinRoot === "" ||
		pathWithinRoot === ".." ||
		pathWithinRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
		isAbsolute(pathWithinRoot) ||
		extname(requestedPath).toLowerCase() !== ".json"
	) {
		throw new SamplingBatchRequestError(
			"request_file_outside_allowlist",
			"The request manifest must be a checked JSON file under src/sampling-batch-requests",
		);
	}
	const metadata = await stat(requestedPath);
	if (!metadata.isFile() || metadata.size > MAX_REQUEST_BYTES) {
		throw new SamplingBatchRequestError("request_file_invalid", "The request manifest is not an allowed file");
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(await readFile(requestedPath, "utf8"));
	} catch {
		throw new SamplingBatchRequestError("request_file_invalid", "The request manifest is not valid JSON");
	}
	return parseSamplingBatchRequest(parsed);
}
