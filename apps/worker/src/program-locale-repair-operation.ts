import {
	assessProgramLocaleRepair,
	type ProgramLocaleRepairRequest,
	ProgramLocaleRepairError,
	type ProgramLocaleRepairState,
} from "./program-locale-repair-policy";

export type ProgramLocaleRepairMode = "status-only" | "dry-run" | "apply";

export type ProgramLocaleRepairReceipt = {
	status: "complete";
	action: "repair_required" | "would_repair" | "repaired" | "unchanged";
	locale: "zh-CN";
	promptCount: 10;
	historyCount: 0;
};

export type ProgramLocaleRepairRepository = {
	withSerializableTransaction<T>(operation: () => Promise<T>): Promise<T>;
	lockOperation(): Promise<void>;
	readStateForUpdate(): Promise<ProgramLocaleRepairState>;
	updateLocale(from: string, to: string): Promise<number>;
};

function buildReceipt(
	action: ProgramLocaleRepairReceipt["action"],
): ProgramLocaleRepairReceipt {
	return {
		status: "complete",
		action,
		locale: "zh-CN",
		promptCount: 10,
		historyCount: 0,
	};
}

export async function executeProgramLocaleRepair(
	request: ProgramLocaleRepairRequest,
	mode: ProgramLocaleRepairMode,
	repository: ProgramLocaleRepairRepository,
): Promise<ProgramLocaleRepairReceipt> {
	return repository.withSerializableTransaction(async () => {
		await repository.lockOperation();

		const before = await repository.readStateForUpdate();
		const assessment = assessProgramLocaleRepair(request, before);

		if (assessment.action === "unchanged") {
			return buildReceipt("unchanged");
		}

		if (mode === "status-only") {
			return buildReceipt("repair_required");
		}

		if (mode === "dry-run") {
			return buildReceipt("would_repair");
		}

		const updated = await repository.updateLocale(
			request.program.localeFrom,
			request.program.localeTo,
		);
		if (updated !== 1) {
			throw new ProgramLocaleRepairError(
				"locale_update_conflict",
				"Expected to update exactly one Program locale row",
			);
		}

		const after = await repository.readStateForUpdate();
		const postAssessment = assessProgramLocaleRepair(request, after);
		if (postAssessment.action !== "unchanged") {
			throw new ProgramLocaleRepairError(
				"postcondition_failed",
				"The Program locale repair did not reach the approved zh-CN postcondition",
			);
		}

		return buildReceipt("repaired");
	});
}
