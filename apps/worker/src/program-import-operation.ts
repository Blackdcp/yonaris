import { assessProgramImport, type ProgramImportRequest, ProgramImportError, type ProgramImportState } from "./program-import-policy";

export type ProgramImportMode = "status-only" | "dry-run" | "apply";

export type ProgramImportReceipt = {
	status: "complete";
	action: "create_required" | "would_create" | "created" | "unchanged";
	locale: "en-US";
	promptCount: 10;
	historyCount: number;
};

export type ProgramImportRepository = {
	withSerializableTransaction<T>(operation: () => Promise<T>): Promise<T>;
	lockOperation(): Promise<void>;
	readStateForUpdate(): Promise<ProgramImportState>;
	createProgramWithPrompts(request: ProgramImportRequest): Promise<void>;
};

function buildReceipt(
	action: ProgramImportReceipt["action"],
	historyCount: number,
): ProgramImportReceipt {
	return {
		status: "complete",
		action,
		locale: "en-US",
		promptCount: 10,
		historyCount,
	};
}

export async function executeProgramImport(
	request: ProgramImportRequest,
	mode: ProgramImportMode,
	repository: ProgramImportRepository,
): Promise<ProgramImportReceipt> {
	return repository.withSerializableTransaction(async () => {
		await repository.lockOperation();

		const before = await repository.readStateForUpdate();
		const assessment = assessProgramImport(request, before);

		if (assessment.action === "unchanged") {
			return buildReceipt("unchanged", assessment.historyCount);
		}

		if (mode === "status-only") return buildReceipt("create_required", 0);
		if (mode === "dry-run") return buildReceipt("would_create", 0);

		await repository.createProgramWithPrompts(request);

		const after = await repository.readStateForUpdate();
		const postAssessment = assessProgramImport(request, after);
		if (postAssessment.action !== "unchanged") {
			throw new ProgramImportError("postcondition_failed", "The Program import did not reach the approved postcondition");
		}

		return buildReceipt("created", postAssessment.historyCount);
	});
}
