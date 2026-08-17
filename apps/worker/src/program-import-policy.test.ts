import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	assessProgramImport,
	EXPECTED_PPIO_COMPETITORS,
	EXPECTED_PPIO_GLOBAL_PROMPTS,
	ProgramImportError,
	type ProgramImportState,
	parseProgramImportRequest,
} from "./program-import-policy";

const validRequest = {
	schemaVersion: 2,
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
	prompts: { exact: EXPECTED_PPIO_GLOBAL_PROMPTS },
	competitors: { exact: EXPECTED_PPIO_COMPETITORS },
} as const;

function validState(overrides: Partial<ProgramImportState> = {}): ProgramImportState {
	return {
		brandMatches: 1,
		customerMatches: 1,
		customerRole: "owner",
		programMatches: 0,
		program: null,
		prompts: [],
		competitors: [],
		history: { deliveryBatches: 0, observationAttempts: 0, promptRuns: 0, evidenceArtifacts: 0 },
		...overrides,
	};
}

describe("PPIO global Program import request", () => {
	it("accepts only the fixed PPIO global Program import contract", () => {
		assert.deepEqual(parseProgramImportRequest(validRequest), validRequest);
		assert.throws(
			() =>
				parseProgramImportRequest({
					...validRequest,
					program: { ...validRequest.program, timezoneExact: "America/Los_Angeles" },
				}),
			(error: unknown) => error instanceof ProgramImportError && error.code === "invalid_program_contract",
		);
	});

	it("rejects missing, changed, duplicated, or extra prompts", () => {
		for (const exact of [
			EXPECTED_PPIO_GLOBAL_PROMPTS.slice(0, 9),
			[...EXPECTED_PPIO_GLOBAL_PROMPTS.slice(0, 9), { ...EXPECTED_PPIO_GLOBAL_PROMPTS[9], value: "changed" }],
			[EXPECTED_PPIO_GLOBAL_PROMPTS[0], ...EXPECTED_PPIO_GLOBAL_PROMPTS.slice(0, 9)],
			[...EXPECTED_PPIO_GLOBAL_PROMPTS, EXPECTED_PPIO_GLOBAL_PROMPTS[0]],
		]) {
			assert.throws(
				() => parseProgramImportRequest({ ...validRequest, prompts: { exact } }),
				(error: unknown) => error instanceof ProgramImportError && error.code === "invalid_prompt_contract",
			);
		}
	});
});

describe("PPIO global Program import assessment", () => {
	it("plans a create for the absent exact Program", () => {
		assert.deepEqual(assessProgramImport(validRequest, validState()), {
			action: "create",
			promptCount: 10,
			historyCount: 0,
		});
	});

	it("is idempotent when the exact Program and prompts already exist", () => {
		const state = validState({
			programMatches: 1,
			program: {
				key: "global-market",
				name: "Global Market",
				market: "US",
				locale: "en-US",
				timezone: "UTC",
				evaluationRole: "scored",
				automaticTargetKeys: [],
				enabled: true,
				isDefault: false,
			},
			prompts: [...EXPECTED_PPIO_GLOBAL_PROMPTS],
			competitors: [...EXPECTED_PPIO_COMPETITORS],
		});
		assert.equal(assessProgramImport(validRequest, state).action, "unchanged");
	});

	it("treats the exact prompt set as idempotent regardless of database row order", () => {
		const state = validState({
			programMatches: 1,
			program: {
				key: "global-market",
				name: "Global Market",
				market: "US",
				locale: "en-US",
				timezone: "UTC",
				evaluationRole: "scored",
				automaticTargetKeys: [],
				enabled: true,
				isDefault: false,
			},
			prompts: [...EXPECTED_PPIO_GLOBAL_PROMPTS].reverse(),
			competitors: [...EXPECTED_PPIO_COMPETITORS].reverse(),
		});
		assert.equal(assessProgramImport(validRequest, state).action, "unchanged");
	});

	it("fails closed on identity or prompt drift", () => {
		const baseExactState = validState({
			programMatches: 1,
			program: {
				key: "global-market",
				name: "Global Market",
				market: "US",
				locale: "en-US",
				timezone: "UTC",
				evaluationRole: "scored",
				automaticTargetKeys: [],
				enabled: true,
				isDefault: false,
			},
			prompts: [...EXPECTED_PPIO_GLOBAL_PROMPTS],
			competitors: [...EXPECTED_PPIO_COMPETITORS],
		});
		const cases: Array<[Partial<ProgramImportState>, string]> = [
			[{ brandMatches: 2 }, "brand_ambiguous"],
			[{ customerMatches: 0 }, "customer_not_found"],
			[{ customerRole: "admin" }, "customer_role_mismatch"],
			[{ programMatches: 2 }, "program_ambiguous"],
			[
				{
					programMatches: 1,
					program: { ...baseExactState.program!, locale: "en-GB" },
				},
				"program_identity_mismatch",
			],
			[
				{
					programMatches: 1,
					program: baseExactState.program,
					prompts: EXPECTED_PPIO_GLOBAL_PROMPTS.slice(1),
				},
				"prompt_identity_mismatch",
			],
			[
				{
					programMatches: 1,
					program: baseExactState.program,
					competitors: EXPECTED_PPIO_COMPETITORS.slice(1),
				},
				"competitor_identity_mismatch",
			],
		];

		for (const [overrides, code] of cases) {
			assert.throws(
				() => assessProgramImport(validRequest, { ...baseExactState, ...overrides }),
				(error: unknown) => error instanceof ProgramImportError && error.code === code,
			);
		}
	});
});
