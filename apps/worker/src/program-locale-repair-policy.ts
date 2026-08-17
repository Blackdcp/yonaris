export const EXPECTED_PPIO_DOMESTIC_PROMPTS = [
	"PPIO 派欧云是什么，主要提供哪些云服务？",
	"国内聚合大模型 API 平台怎么选？",
	"怎么把使用 OpenAI SDK 的应用迁移到 PPIO？",
	"PPIO Agent 沙箱是什么，适合哪些场景？",
	"PPIO 有哪些可供 Agent 调用的 Skills 和 MCP 工具？",
	"PPIO GPU 容器实例适合训练、推理还是渲染？",
	"PPIO Serverless GPUs 与 GPU 容器实例有什么区别？",
	"2026 年 AI 推理成本优化有哪些有效方法？",
	"PPIO 边缘 CDN 如何降低时延并提升下载体验？",
	"企业采购 PPIO 前需要确认哪些安全与合规事项？",
] as const;

export type ProgramLocaleRepairRequest = {
	schemaVersion: 1;
	requestId: "ppio-cn-zh-20260817";
	brand: { nameExact: "PPIO"; websiteExact: "https://ppio.com/" };
	customer: { emailExact: "ppio@admin.com"; roleExact: "owner" };
	program: {
		nameExact: "China Market";
		marketExact: "CN";
		localeFrom: "zn-CN";
		localeTo: "zh-CN";
		timezoneExact: "Asia/Shanghai";
		evaluationRoleExact: "scored";
		manualOnlyExact: true;
		enabledExact: true;
	};
	prompts: { enabledTextsExact: readonly string[] };
};

export type ProgramLocaleRepairState = {
	brandMatches: number;
	customerMatches: number;
	customerRole: string | null;
	programMatches: number;
	program: {
		name: string;
		market: string;
		locale: string;
		timezone: string;
		evaluationRole: string | null;
		automaticTargetKeys: string[] | null;
		enabled: boolean;
	};
	enabledPromptTexts: readonly string[];
	totalPromptCount: number;
	history: {
		deliveryBatches: number;
		observationAttempts: number;
		promptRuns: number;
		evidenceArtifacts: number;
	};
};

export type ProgramLocaleRepairAssessment = {
	action: "repair" | "unchanged";
	localeBefore: "zn-CN" | "zh-CN";
	localeAfter: "zh-CN";
	promptCount: 10;
	historyCount: 0;
};

export class ProgramLocaleRepairError extends Error {
	constructor(
		readonly code: string,
		message: string,
	) {
		super(message);
		this.name = "ProgramLocaleRepairError";
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

function stringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function stringMultisetsEqual(left: readonly string[], right: readonly string[]): boolean {
	return stringArraysEqual([...left].sort(), [...right].sort());
}

export function parseProgramLocaleRepairRequest(value: unknown): ProgramLocaleRepairRequest {
	if (
		!isRecord(value) ||
		!hasExactKeys(value, ["schemaVersion", "requestId", "brand", "customer", "program", "prompts"]) ||
		value.schemaVersion !== 1 ||
		value.requestId !== "ppio-cn-zh-20260817"
	) {
		throw new ProgramLocaleRepairError("invalid_request_contract", "The repair request contract is invalid");
	}

	const brand = value.brand;
	if (
		!isRecord(brand) ||
		!hasExactKeys(brand, ["nameExact", "websiteExact"]) ||
		brand.nameExact !== "PPIO" ||
		brand.websiteExact !== "https://ppio.com/"
	) {
		throw new ProgramLocaleRepairError("invalid_brand_contract", "The repair request brand contract is invalid");
	}

	const customer = value.customer;
	if (
		!isRecord(customer) ||
		!hasExactKeys(customer, ["emailExact", "roleExact"]) ||
		customer.emailExact !== "ppio@admin.com" ||
		customer.roleExact !== "owner"
	) {
		throw new ProgramLocaleRepairError("invalid_customer_contract", "The repair request customer contract is invalid");
	}

	const program = value.program;
	if (
		!isRecord(program) ||
		!hasExactKeys(program, [
			"nameExact",
			"marketExact",
			"localeFrom",
			"localeTo",
			"timezoneExact",
			"evaluationRoleExact",
			"manualOnlyExact",
			"enabledExact",
		]) ||
		program.nameExact !== "China Market" ||
		program.marketExact !== "CN" ||
		program.localeFrom !== "zn-CN" ||
		program.localeTo !== "zh-CN" ||
		program.timezoneExact !== "Asia/Shanghai" ||
		program.evaluationRoleExact !== "scored" ||
		program.manualOnlyExact !== true ||
		program.enabledExact !== true
	) {
		throw new ProgramLocaleRepairError("invalid_program_contract", "The repair request Program contract is invalid");
	}

	const prompts = value.prompts;
	if (
		!isRecord(prompts) ||
		!hasExactKeys(prompts, ["enabledTextsExact"]) ||
		!Array.isArray(prompts.enabledTextsExact) ||
		!prompts.enabledTextsExact.every((prompt) => typeof prompt === "string") ||
		!stringArraysEqual(prompts.enabledTextsExact as string[], EXPECTED_PPIO_DOMESTIC_PROMPTS)
	) {
		throw new ProgramLocaleRepairError("invalid_prompt_contract", "The repair request prompt contract is invalid");
	}

	return {
		schemaVersion: 1,
		requestId: "ppio-cn-zh-20260817",
		brand: { nameExact: "PPIO", websiteExact: "https://ppio.com/" },
		customer: { emailExact: "ppio@admin.com", roleExact: "owner" },
		program: {
			nameExact: "China Market",
			marketExact: "CN",
			localeFrom: "zn-CN",
			localeTo: "zh-CN",
			timezoneExact: "Asia/Shanghai",
			evaluationRoleExact: "scored",
			manualOnlyExact: true,
			enabledExact: true,
		},
		prompts: { enabledTextsExact: [...EXPECTED_PPIO_DOMESTIC_PROMPTS] },
	};
}

export function assessProgramLocaleRepair(
	request: ProgramLocaleRepairRequest,
	state: ProgramLocaleRepairState,
): ProgramLocaleRepairAssessment {
	if (state.brandMatches === 0) throw new ProgramLocaleRepairError("brand_not_found", "PPIO brand was not found");
	if (state.brandMatches !== 1) throw new ProgramLocaleRepairError("brand_ambiguous", "PPIO brand is ambiguous");
	if (state.customerMatches === 0) {
		throw new ProgramLocaleRepairError("customer_not_found", "PPIO customer owner was not found");
	}
	if (state.customerMatches !== 1) {
		throw new ProgramLocaleRepairError("customer_ambiguous", "PPIO customer owner is ambiguous");
	}
	if (state.customerRole !== request.customer.roleExact) {
		throw new ProgramLocaleRepairError("customer_role_mismatch", "PPIO customer role does not match");
	}
	if (state.programMatches === 0) throw new ProgramLocaleRepairError("program_not_found", "Program was not found");
	if (state.programMatches !== 1) throw new ProgramLocaleRepairError("program_ambiguous", "Program is ambiguous");

	const programIdentityMatches =
		state.program.name === request.program.nameExact &&
		state.program.market === request.program.marketExact &&
		state.program.timezone === request.program.timezoneExact &&
		state.program.evaluationRole === request.program.evaluationRoleExact &&
		state.program.enabled === request.program.enabledExact &&
		Array.isArray(state.program.automaticTargetKeys) &&
		state.program.automaticTargetKeys.length === 0;
	if (!programIdentityMatches) {
		throw new ProgramLocaleRepairError("program_identity_mismatch", "Program identity does not match");
	}

	if (
		state.totalPromptCount !== EXPECTED_PPIO_DOMESTIC_PROMPTS.length ||
		!stringMultisetsEqual(state.enabledPromptTexts, request.prompts.enabledTextsExact)
	) {
		throw new ProgramLocaleRepairError("prompt_identity_mismatch", "Program prompts do not match");
	}

	const historyCount = Object.values(state.history).reduce((total, count) => total + count, 0);
	if (historyCount !== 0) {
		throw new ProgramLocaleRepairError("execution_history_present", "Program already has execution history");
	}

	if (state.program.locale !== request.program.localeFrom && state.program.locale !== request.program.localeTo) {
		throw new ProgramLocaleRepairError("locale_mismatch", "Program locale is outside the approved repair contract");
	}

	return {
		action: state.program.locale === request.program.localeFrom ? "repair" : "unchanged",
		localeBefore: state.program.locale,
		localeAfter: "zh-CN",
		promptCount: 10,
		historyCount: 0,
	};
}
