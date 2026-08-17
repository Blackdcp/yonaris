export const EXPECTED_PPIO_GLOBAL_PROMPTS = [
	{
		value: "independent Agentic Cloud platforms",
		tagsExact: ["p0_brand_diagnostic_v1", "brand-observation", "agentic-cloud", "os-001"],
	},
	{
		value: "multi-model API platforms for production AI",
		tagsExact: ["p0_result_core_v1", "result-monitoring", "model-api", "os-002"],
	},
	{
		value: "OpenAI- and Anthropic-compatible model gateways",
		tagsExact: ["p0_result_core_v1", "result-monitoring", "model-api", "os-003"],
	},
	{
		value: "secure code-execution sandboxes for AI agents",
		tagsExact: ["p0_result_core_v1", "result-monitoring", "agent-sandbox", "os-004"],
	},
	{
		value: "AI agent Skills and MCP integrations",
		tagsExact: ["p0_result_core_v1", "result-monitoring", "agent-tools", "os-005"],
	},
	{
		value: "GPU container cloud for AI workloads",
		tagsExact: ["p0_result_core_v1", "result-monitoring", "gpu-cloud", "os-006"],
	},
	{
		value: "serverless GPU inference",
		tagsExact: ["p0_result_core_v1", "result-monitoring", "serverless-gpus", "os-007"],
	},
	{
		value: "AI inference performance, reliability and rate limits",
		tagsExact: ["p0_trend_context_v1", "trend-observation", "ai-infra", "os-008"],
	},
	{
		value: "edge CDN and live-video delivery",
		tagsExact: ["p0_result_core_v1", "result-monitoring", "edge-cdn", "os-009"],
	},
	{
		value: "enterprise AI security and data governance",
		tagsExact: ["p0_brand_diagnostic_v1", "brand-observation", "enterprise", "os-010"],
	},
] as const;

export type ProgramImportRequest = {
	schemaVersion: 1;
	requestId: "ppio-global-en-20260817";
	brand: { nameExact: "PPIO"; websiteExact: "https://ppio.com/" };
	customer: { emailExact: "ppio@admin.com"; roleExact: "owner" };
	program: {
		keyExact: "global-market";
		nameExact: "Global Market";
		marketExact: "US";
		localeExact: "en-US";
		timezoneExact: "UTC";
		evaluationRoleExact: "scored";
		manualOnlyExact: true;
		enabledExact: true;
		isDefaultExact: false;
	};
	prompts: { exact: readonly { value: string; tagsExact: readonly string[] }[] };
};

export type ProgramImportState = {
	brandMatches: number;
	customerMatches: number;
	customerRole: string | null;
	programMatches: number;
	program: null | {
		key: string;
		name: string;
		market: string;
		locale: string;
		timezone: string;
		evaluationRole: string | null;
		automaticTargetKeys: string[] | null;
		enabled: boolean;
		isDefault: boolean;
	};
	prompts: readonly { value: string; tagsExact: readonly string[] }[];
	history: {
		deliveryBatches: number;
		observationAttempts: number;
		promptRuns: number;
		evidenceArtifacts: number;
	};
};

export type ProgramImportAssessment = {
	action: "create" | "unchanged";
	promptCount: 10;
	historyCount: number;
};

export class ProgramImportError extends Error {
	constructor(
		readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "ProgramImportError";
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
	const actual = Object.keys(value).sort();
	const expected = [...keys].sort();
	return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function promptsEqual(
	left: readonly { value: string; tagsExact: readonly string[] }[],
	right: readonly { value: string; tagsExact: readonly string[] }[],
) {
	return (
		left.length === right.length &&
		left.every(
			(prompt, index) =>
				prompt.value === right[index]?.value &&
				prompt.tagsExact.length === right[index]?.tagsExact.length &&
				prompt.tagsExact.every((tag, tagIndex) => tag === right[index]?.tagsExact[tagIndex]),
		)
	);
}

export function parseProgramImportRequest(value: unknown): ProgramImportRequest {
	if (
		!isRecord(value) ||
		!hasExactKeys(value, ["schemaVersion", "requestId", "brand", "customer", "program", "prompts"]) ||
		value.schemaVersion !== 1 ||
		value.requestId !== "ppio-global-en-20260817"
	) {
		throw new ProgramImportError("invalid_request_contract", "The Program import request contract is invalid");
	}

	const brand = value.brand;
	if (
		!isRecord(brand) ||
		!hasExactKeys(brand, ["nameExact", "websiteExact"]) ||
		brand.nameExact !== "PPIO" ||
		brand.websiteExact !== "https://ppio.com/"
	) {
		throw new ProgramImportError("invalid_brand_contract", "The Program import brand contract is invalid");
	}

	const customer = value.customer;
	if (
		!isRecord(customer) ||
		!hasExactKeys(customer, ["emailExact", "roleExact"]) ||
		customer.emailExact !== "ppio@admin.com" ||
		customer.roleExact !== "owner"
	) {
		throw new ProgramImportError("invalid_customer_contract", "The Program import customer contract is invalid");
	}

	const program = value.program;
	if (
		!isRecord(program) ||
		!hasExactKeys(program, [
			"keyExact",
			"nameExact",
			"marketExact",
			"localeExact",
			"timezoneExact",
			"evaluationRoleExact",
			"manualOnlyExact",
			"enabledExact",
			"isDefaultExact",
		]) ||
		program.keyExact !== "global-market" ||
		program.nameExact !== "Global Market" ||
		program.marketExact !== "US" ||
		program.localeExact !== "en-US" ||
		program.timezoneExact !== "UTC" ||
		program.evaluationRoleExact !== "scored" ||
		program.manualOnlyExact !== true ||
		program.enabledExact !== true ||
		program.isDefaultExact !== false
	) {
		throw new ProgramImportError("invalid_program_contract", "The Program import Program contract is invalid");
	}

	const prompts = value.prompts;
	if (!isRecord(prompts) || !hasExactKeys(prompts, ["exact"]) || !Array.isArray(prompts.exact)) {
		throw new ProgramImportError("invalid_prompt_contract", "The Program import prompt contract is invalid");
	}

	const exact = prompts.exact.map((entry) => {
		if (
			!isRecord(entry) ||
			!hasExactKeys(entry, ["value", "tagsExact"]) ||
			typeof entry.value !== "string" ||
			!Array.isArray(entry.tagsExact) ||
			!entry.tagsExact.every((tag) => typeof tag === "string")
		) {
			throw new ProgramImportError("invalid_prompt_contract", "The Program import prompt contract is invalid");
		}
		return { value: entry.value, tagsExact: [...entry.tagsExact] };
	});

	if (exact.length !== 10 || !promptsEqual(exact, EXPECTED_PPIO_GLOBAL_PROMPTS)) {
		throw new ProgramImportError("invalid_prompt_contract", "The Program import prompt contract is invalid");
	}

	return {
		schemaVersion: 1,
		requestId: "ppio-global-en-20260817",
		brand: { nameExact: "PPIO", websiteExact: "https://ppio.com/" },
		customer: { emailExact: "ppio@admin.com", roleExact: "owner" },
		program: {
			keyExact: "global-market",
			nameExact: "Global Market",
			marketExact: "US",
			localeExact: "en-US",
			timezoneExact: "UTC",
			evaluationRoleExact: "scored",
			manualOnlyExact: true,
			enabledExact: true,
			isDefaultExact: false,
		},
		prompts: { exact },
	};
}

export function assessProgramImport(request: ProgramImportRequest, state: ProgramImportState): ProgramImportAssessment {
	if (state.brandMatches === 0) throw new ProgramImportError("brand_not_found", "PPIO brand was not found");
	if (state.brandMatches !== 1) throw new ProgramImportError("brand_ambiguous", "PPIO brand is ambiguous");
	if (state.customerMatches === 0) throw new ProgramImportError("customer_not_found", "PPIO customer owner was not found");
	if (state.customerMatches !== 1) throw new ProgramImportError("customer_ambiguous", "PPIO customer owner is ambiguous");
	if (state.customerRole !== request.customer.roleExact) {
		throw new ProgramImportError("customer_role_mismatch", "PPIO customer role does not match");
	}

	if (state.programMatches === 0) {
		return {
			action: "create",
			promptCount: 10,
			historyCount: 0,
		};
	}
	if (state.programMatches !== 1 || !state.program) {
		throw new ProgramImportError("program_ambiguous", "Program is ambiguous");
	}

	const programIdentityMatches =
		state.program.key === request.program.keyExact &&
		state.program.name === request.program.nameExact &&
		state.program.market === request.program.marketExact &&
		state.program.locale === request.program.localeExact &&
		state.program.timezone === request.program.timezoneExact &&
		state.program.evaluationRole === request.program.evaluationRoleExact &&
		state.program.enabled === request.program.enabledExact &&
		state.program.isDefault === request.program.isDefaultExact &&
		Array.isArray(state.program.automaticTargetKeys) &&
		state.program.automaticTargetKeys.length === 0;
	if (!programIdentityMatches) {
		throw new ProgramImportError("program_identity_mismatch", "Program identity does not match");
	}

	if (!promptsEqual(state.prompts, request.prompts.exact)) {
		throw new ProgramImportError("prompt_identity_mismatch", "Program prompts do not match");
	}

	const historyCount = Object.values(state.history).reduce((total, count) => total + count, 0);
	return {
		action: "unchanged",
		promptCount: 10,
		historyCount,
	};
}
