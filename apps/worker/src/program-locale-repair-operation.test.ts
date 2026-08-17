import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EXPECTED_PPIO_DOMESTIC_PROMPTS, type ProgramLocaleRepairState } from "./program-locale-repair-policy";
import {
	executeProgramLocaleRepair,
	type ProgramLocaleRepairRepository,
} from "./program-locale-repair-operation";

const request = {
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

function state(locale = "zn-CN"): ProgramLocaleRepairState {
	return {
		brandMatches: 1,
		customerMatches: 1,
		customerRole: "owner",
		programMatches: 1,
		program: {
			name: "China Market",
			market: "CN",
			locale,
			timezone: "Asia/Shanghai",
			evaluationRole: "scored",
			automaticTargetKeys: [],
			enabled: true,
		},
		enabledPromptTexts: [...EXPECTED_PPIO_DOMESTIC_PROMPTS],
		totalPromptCount: 10,
		history: { deliveryBatches: 0, observationAttempts: 0, promptRuns: 0, evidenceArtifacts: 0 },
	};
}

function repository(initialState = state()) {
	let current = structuredClone(initialState);
	let updates = 0;
	const repo: ProgramLocaleRepairRepository = {
		withSerializableTransaction: async (operation) => operation(),
		lockOperation: async () => undefined,
		readStateForUpdate: async () => structuredClone(current),
		updateLocale: async (from, to) => {
			if (current.program.locale !== from) return 0;
			current.program.locale = to;
			updates++;
			return 1;
		},
	};
	return { repo, updates: () => updates, current: () => current };
}

describe("PPIO Program locale repair operation", () => {
	it("updates exactly one Program and verifies the postcondition in the same transaction", async () => {
		const harness = repository();
		const receipt = await executeProgramLocaleRepair(request, "apply", harness.repo);

		assert.equal(harness.updates(), 1);
		assert.equal(harness.current().program.locale, "zh-CN");
		assert.deepEqual(receipt, {
			status: "complete",
			action: "repaired",
			locale: "zh-CN",
			promptCount: 10,
			historyCount: 0,
		});
	});

	it("keeps dry-run and status-only read-only", async () => {
		for (const mode of ["dry-run", "status-only"] as const) {
			const harness = repository();
			const receipt = await executeProgramLocaleRepair(request, mode, harness.repo);
			assert.equal(harness.updates(), 0);
			assert.equal(receipt.action, mode === "dry-run" ? "would_repair" : "repair_required");
		}
	});

	it("is an idempotent no-op after repair", async () => {
		const harness = repository(state("zh-CN"));
		const receipt = await executeProgramLocaleRepair(request, "apply", harness.repo);
		assert.equal(harness.updates(), 0);
		assert.equal(receipt.action, "unchanged");
	});

	it("does not write when execution history exists", async () => {
		const invalid = state();
		invalid.history.promptRuns = 1;
		const harness = repository(invalid);
		await assert.rejects(() => executeProgramLocaleRepair(request, "apply", harness.repo), /execution history/i);
		assert.equal(harness.updates(), 0);
	});

	it("fails if the guarded update does not affect exactly one row", async () => {
		const harness = repository();
		harness.repo.updateLocale = async () => 0;
		await assert.rejects(() => executeProgramLocaleRepair(request, "apply", harness.repo), /exactly one Program/i);
	});
});
