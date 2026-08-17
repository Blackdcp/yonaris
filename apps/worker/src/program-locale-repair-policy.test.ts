import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	assessProgramLocaleRepair,
	EXPECTED_PPIO_DOMESTIC_PROMPTS,
	parseProgramLocaleRepairRequest,
	ProgramLocaleRepairError,
	type ProgramLocaleRepairState,
} from "./program-locale-repair-policy";

const validRequest = {
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
	prompts: { enabledTextsExact: EXPECTED_PPIO_DOMESTIC_PROMPTS },
} as const;

function validState(overrides: Partial<ProgramLocaleRepairState> = {}): ProgramLocaleRepairState {
	return {
		brandMatches: 1,
		customerMatches: 1,
		customerRole: "owner",
		programMatches: 1,
		program: {
			name: "China Market",
			market: "CN",
			locale: "zn-CN",
			timezone: "Asia/Shanghai",
			evaluationRole: "scored",
			automaticTargetKeys: [],
			enabled: true,
		},
		enabledPromptTexts: [...EXPECTED_PPIO_DOMESTIC_PROMPTS],
		totalPromptCount: 10,
		history: { deliveryBatches: 0, observationAttempts: 0, promptRuns: 0, evidenceArtifacts: 0 },
		...overrides,
	};
}

describe("PPIO Program locale repair request", () => {
	it("accepts only the fixed PPIO China Market repair contract", () => {
		assert.deepEqual(parseProgramLocaleRepairRequest(validRequest), validRequest);
		assert.throws(
			() =>
				parseProgramLocaleRepairRequest({
					...validRequest,
					program: { ...validRequest.program, localeTo: "en-US" },
				}),
			(error: unknown) => error instanceof ProgramLocaleRepairError && error.code === "invalid_program_contract",
		);
	});

	it("rejects any missing, changed, duplicated, or extra prompt", () => {
		for (const enabledTextsExact of [
			EXPECTED_PPIO_DOMESTIC_PROMPTS.slice(0, 9),
			[...EXPECTED_PPIO_DOMESTIC_PROMPTS.slice(0, 9), "被替换的提示词"],
			[EXPECTED_PPIO_DOMESTIC_PROMPTS[0], ...EXPECTED_PPIO_DOMESTIC_PROMPTS.slice(0, 9)],
			[...EXPECTED_PPIO_DOMESTIC_PROMPTS, "额外提示词"],
		]) {
			assert.throws(
				() => parseProgramLocaleRepairRequest({ ...validRequest, prompts: { enabledTextsExact } }),
				(error: unknown) => error instanceof ProgramLocaleRepairError && error.code === "invalid_prompt_contract",
			);
		}
	});
});

describe("PPIO Program locale repair assessment", () => {
	it("plans one in-place repair for the exact unused zn-CN scope", () => {
		assert.deepEqual(assessProgramLocaleRepair(validRequest, validState()), {
			action: "repair",
			localeBefore: "zn-CN",
			localeAfter: "zh-CN",
			promptCount: 10,
			historyCount: 0,
		});
	});

	it("is idempotent when the exact scope is already zh-CN", () => {
		const state = validState({ program: { ...validState().program, locale: "zh-CN" } });
		assert.equal(assessProgramLocaleRepair(validRequest, state).action, "unchanged");
	});

	it("fails closed on identity, configuration, prompt, or history drift", () => {
		const cases: Array<[Partial<ProgramLocaleRepairState>, string]> = [
			[{ brandMatches: 2 }, "brand_ambiguous"],
			[{ customerMatches: 0 }, "customer_not_found"],
			[{ customerRole: "admin" }, "customer_role_mismatch"],
			[{ programMatches: 2 }, "program_ambiguous"],
			[{ program: { ...validState().program, market: "US" } }, "program_identity_mismatch"],
			[{ enabledPromptTexts: EXPECTED_PPIO_DOMESTIC_PROMPTS.slice(1) }, "prompt_identity_mismatch"],
			[{ totalPromptCount: 11 }, "prompt_identity_mismatch"],
			[
				{ history: { deliveryBatches: 1, observationAttempts: 0, promptRuns: 0, evidenceArtifacts: 0 } },
				"execution_history_present",
			],
		];

		for (const [overrides, code] of cases) {
			assert.throws(
				() => assessProgramLocaleRepair(validRequest, validState(overrides)),
				(error: unknown) => error instanceof ProgramLocaleRepairError && error.code === code,
			);
		}
	});
});
