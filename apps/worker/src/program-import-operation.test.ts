import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { executeProgramImport, type ProgramImportRepository } from "./program-import-operation";
import {
	EXPECTED_PPIO_COMPETITORS,
	EXPECTED_PPIO_GLOBAL_PROMPTS,
	type ProgramImportState,
} from "./program-import-policy";

const request = {
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

function stateAbsent(): ProgramImportState {
	return {
		brandMatches: 1,
		customerMatches: 1,
		customerRole: "owner",
		programMatches: 0,
		program: null,
		prompts: [],
		competitors: [],
		history: { deliveryBatches: 0, observationAttempts: 0, promptRuns: 0, evidenceArtifacts: 0 },
	};
}

function statePresent(): ProgramImportState {
	return {
		brandMatches: 1,
		customerMatches: 1,
		customerRole: "owner",
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
		history: { deliveryBatches: 0, observationAttempts: 0, promptRuns: 0, evidenceArtifacts: 0 },
	};
}

function repository(initialState = stateAbsent()) {
	let current = structuredClone(initialState);
	let created = 0;
	const repo: ProgramImportRepository = {
		withSerializableTransaction: async (operation) => operation(),
		lockOperation: async () => undefined,
		readStateForUpdate: async () => structuredClone(current),
		createProgramWithPrompts: async () => {
			current = statePresent();
			created += 1;
		},
	};
	return { repo, created: () => created, current: () => structuredClone(current) };
}

describe("PPIO global Program import operation", () => {
	it("creates the exact Program and prompts in one transaction", async () => {
		const harness = repository();
		const receipt = await executeProgramImport(request, "apply", harness.repo);

		assert.equal(harness.created(), 1);
		assert.equal(harness.current().programMatches, 1);
		assert.deepEqual(receipt, {
			status: "complete",
			action: "created",
			locale: "en-US",
			promptCount: 10,
			historyCount: 0,
		});
	});

	it("keeps dry-run and status-only read-only", async () => {
		for (const mode of ["dry-run", "status-only"] as const) {
			const harness = repository();
			const receipt = await executeProgramImport(request, mode, harness.repo);
			assert.equal(harness.created(), 0);
			assert.equal(receipt.action, mode === "dry-run" ? "would_create" : "create_required");
		}
	});

	it("is an idempotent no-op when already present", async () => {
		const harness = repository(statePresent());
		const receipt = await executeProgramImport(request, "apply", harness.repo);
		assert.equal(harness.created(), 0);
		assert.equal(receipt.action, "unchanged");
	});

	it("fails if guarded create does not produce the exact Program", async () => {
		const harness = repository();
		harness.repo.createProgramWithPrompts = async () => undefined;
		await assert.rejects(() => executeProgramImport(request, "apply", harness.repo), /postcondition/i);
	});
});
