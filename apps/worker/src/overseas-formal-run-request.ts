import { readFile, realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { EXPECTED_STEPFUN_PROMPTS } from "./sampling-batch-request";

export const OVERSEAS_FORMAL_RUN_REQUEST_ID = "stepfun-us-chatgpt-1x-20260816";
export const OVERSEAS_FORMAL_DESTINATION_SCOPE_KEY = "us-en-chatgpt-one-shot-20260816";

export const EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST = {
	schemaVersion: 1,
	operation: "run-overseas-formal-one-shot",
	requestId: OVERSEAS_FORMAL_RUN_REQUEST_ID,
	brand: { nameExact: "StepFun" },
	sourceScope: { keyExact: "cn-zh-scored" },
	destinationScope: {
		keyExact: OVERSEAS_FORMAL_DESTINATION_SCOPE_KEY,
		nameExact: "US · English · ChatGPT one-shot 2026-08-16",
		marketExact: "US",
		localeExact: "en-US",
		timezoneExact: "Asia/Shanghai",
		evaluationRoleExact: "scored",
		automaticTargetKeys: [] as const,
	},
	prompts: { enabledCountExact: 3, textsExact: EXPECTED_STEPFUN_PROMPTS },
	target: {
		model: "chatgpt",
		provider: "brightdata",
		surfaceTargetKey: "chatgpt.consumer_web",
		captureRouteKey: "brightdata.chatgpt_dataset",
		webSearch: true,
		samplesPerPrompt: 1,
	},
	dailyAutomationEnabled: false,
} as const;

export type OverseasFormalRunRequest = typeof EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST;

export class OverseasFormalRunRequestError extends Error {
	constructor(
		readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "OverseasFormalRunRequestError";
	}
}

export function parseOverseasFormalRunRequest(value: unknown): OverseasFormalRunRequest {
	if (!isDeepStrictEqual(value, EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST)) {
		throw new OverseasFormalRunRequestError(
			"request_contract_mismatch",
			"Overseas formal run request does not match the fixed reviewed contract",
		);
	}
	return structuredClone(EXPECTED_OVERSEAS_FORMAL_RUN_REQUEST);
}

const REQUEST_DIRECTORY = resolve(__dirname, "overseas-formal-run-requests");
const MAX_REQUEST_BYTES = 16 * 1024;

export async function readOverseasFormalRunRequestFile(inputPath: string): Promise<OverseasFormalRunRequest> {
	if (!inputPath || !isAbsolute(inputPath) || extname(inputPath).toLowerCase() !== ".json") {
		throw new OverseasFormalRunRequestError("invalid_request_path", "Request path must be an absolute JSON file");
	}
	const [requestRoot, resolvedPath] = await Promise.all([realpath(REQUEST_DIRECTORY), realpath(inputPath)]);
	const relativePath = relative(requestRoot, resolvedPath);
	if (
		!relativePath ||
		relativePath.startsWith("..") ||
		isAbsolute(relativePath) ||
		relativePath.includes("/") ||
		relativePath.includes("\\")
	) {
		throw new OverseasFormalRunRequestError(
			"invalid_request_path",
			"Request must be a direct file in the fixed request directory",
		);
	}
	const metadata = await stat(resolvedPath);
	if (!metadata.isFile() || metadata.size < 2 || metadata.size > MAX_REQUEST_BYTES) {
		throw new OverseasFormalRunRequestError("invalid_request_file", "Request file size or type is invalid");
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(await readFile(resolvedPath, "utf8"));
	} catch {
		throw new OverseasFormalRunRequestError("invalid_request_json", "Request file is not valid JSON");
	}
	return parseOverseasFormalRunRequest(parsed);
}
