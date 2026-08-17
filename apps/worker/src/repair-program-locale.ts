import { readFile } from "node:fs/promises";
import { db } from "@workspace/lib/db/db";
import {
	brands,
	deliveryBatches,
	evidenceArtifacts,
	measurementScopes,
	observationAttempts,
	promptRuns,
	prompts,
} from "@workspace/lib/db/schema";
import { and, asc, count, eq, sql } from "drizzle-orm";
import {
	executeProgramLocaleRepair,
	type ProgramLocaleRepairMode,
	type ProgramLocaleRepairRepository,
} from "./program-locale-repair-operation";
import {
	parseProgramLocaleRepairRequest,
	type ProgramLocaleRepairRequest,
	type ProgramLocaleRepairState,
	ProgramLocaleRepairError,
} from "./program-locale-repair-policy";

type ProgramLocaleCliOptions = {
	mode: ProgramLocaleRepairMode;
	requestFile: string;
};

function parseOptions(argv: readonly string[]): ProgramLocaleCliOptions {
	let mode: ProgramLocaleRepairMode = "dry-run";
	let requestFile: string | null = null;

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--status-only") {
			mode = "status-only";
			continue;
		}
		if (arg === "--apply") {
			mode = "apply";
			continue;
		}
		if (arg === "--request-file") {
			requestFile = argv[index + 1] ?? null;
			index += 1;
			continue;
		}
		throw new ProgramLocaleRepairError("invalid_cli_arguments", `Unexpected argument: ${arg}`);
	}

	if (!requestFile) {
		throw new ProgramLocaleRepairError(
			"missing_request_file",
			"The Program locale repair requires --request-file",
		);
	}

	return { mode, requestFile };
}

async function readRequestFile(path: string): Promise<ProgramLocaleRepairRequest> {
	const value = JSON.parse(await readFile(path, "utf8")) as unknown;
	return parseProgramLocaleRepairRequest(value);
}

async function readLockedState(
	request: ProgramLocaleRepairRequest,
	connection: any,
): Promise<ProgramLocaleRepairState> {
	const brandRows = await connection
		.select({ id: brands.id })
		.from(brands)
		.where(and(eq(brands.name, request.brand.nameExact), eq(brands.website, request.brand.websiteExact)))
		.limit(2);

	const brandId = brandRows.length === 1 ? (brandRows[0] as { id: string }).id : null;

	const customerRows =
		brandId === null
			? { rows: [] as Array<{ user_id: string; role: string }> }
			: await connection.execute(sql<{
					user_id: string;
					role: string;
			  }>`
					select m.user_id, m.role
					from member m
					join "user" u on u.id = m.user_id
					join brands b on b.organization_id = m.organization_id
					where b.id = ${brandId}
					  and lower(u.email) = lower(${request.customer.emailExact})
					limit 2
			  `);

	const scopeRows =
			brandId === null
				? []
				: await connection
					.select({
						id: measurementScopes.id,
						name: measurementScopes.name,
						market: measurementScopes.market,
						locale: measurementScopes.locale,
						timezone: measurementScopes.timezone,
						evaluationRole: measurementScopes.samplingEvaluationRole,
						enabled: measurementScopes.enabled,
						automaticTargetKeys: measurementScopes.automaticTargetKeys,
					})
					.from(measurementScopes)
					.where(
						and(
							eq(measurementScopes.brandId, brandId),
							eq(measurementScopes.name, request.program.nameExact),
						),
					)
					.limit(2);

	if (scopeRows.length === 1) {
		await connection.execute(
			sql`select id from measurement_scopes where id = ${scopeRows[0]!.id} for update`,
		);
	}

	const scopeId = scopeRows.length === 1 ? scopeRows[0]!.id : null;

	const promptRows =
			brandId === null || scopeId === null
				? []
				: await connection
					.select({ value: prompts.value })
					.from(prompts)
					.where(and(eq(prompts.brandId, brandId), eq(prompts.scopeId, scopeId), eq(prompts.enabled, true)))
					.orderBy(asc(prompts.createdAt), asc(prompts.id));

	const [deliveryBatchHistory, observationAttemptHistory, promptRunHistory, evidenceArtifactHistory] =
		scopeId === null
			? [0, 0, 0, 0]
			: await Promise.all([
					(() => {
						const lockedScopeId = scopeId;
						return connection
							.select({ count: count() })
							.from(deliveryBatches)
							.where(eq(deliveryBatches.scopeId, lockedScopeId))
							.then((rows: Array<{ count: number | string }>) => Number(rows[0]?.count ?? 0));
					})(),
					(() => {
						const lockedScopeId = scopeId;
						return connection
							.select({ count: count() })
							.from(observationAttempts)
							.where(eq(observationAttempts.scopeId, lockedScopeId))
							.then((rows: Array<{ count: number | string }>) => Number(rows[0]?.count ?? 0));
					})(),
					(() => {
						const lockedScopeId = scopeId;
						return connection
							.select({ count: count() })
							.from(promptRuns)
							.where(eq(promptRuns.scopeId, lockedScopeId))
							.then((rows: Array<{ count: number | string }>) => Number(rows[0]?.count ?? 0));
					})(),
					(() => {
						const lockedBrandId = brandId;
						const lockedScopeId = scopeId;
						return connection
							.execute(sql<{ count: number | string }>`
								select count(*)::int as count
								from evidence_artifacts
								where brand_id = ${lockedBrandId}
								  and scope_id = ${lockedScopeId}
								  and status = 'attached'
							`)
							.then(
								(result: { rows: Array<{ count: number | string }> }) =>
									Number(result.rows[0]?.count ?? 0),
							);
					})(),
			  ]);

	return {
		brandMatches: brandRows.length,
		customerMatches: customerRows.rows.length,
		customerRole: ((customerRows.rows[0] as { role?: string } | undefined)?.role ?? null),
		programMatches: scopeRows.length,
		program:
			scopeRows.length === 1
				? {
						name: scopeRows[0]!.name,
						market: scopeRows[0]!.market,
						locale: scopeRows[0]!.locale,
						timezone: scopeRows[0]!.timezone,
						evaluationRole: scopeRows[0]!.evaluationRole,
						automaticTargetKeys: scopeRows[0]!.automaticTargetKeys as string[] | null,
						enabled: scopeRows[0]!.enabled,
				  }
				: {
						name: "",
						market: "",
						locale: "zn-CN",
						timezone: "",
						evaluationRole: null,
						automaticTargetKeys: null,
						enabled: false,
				  },
		enabledPromptTexts: promptRows.map((row: { value: string }) => row.value),
		totalPromptCount: promptRows.length,
		history: {
			deliveryBatches: deliveryBatchHistory,
			observationAttempts: observationAttemptHistory,
			promptRuns: promptRunHistory,
			evidenceArtifacts: evidenceArtifactHistory,
		},
	};
}

function createRepository(request: ProgramLocaleRepairRequest): ProgramLocaleRepairRepository {
	let transactionConnection: any = null;

	return {
		withSerializableTransaction: async (operation) =>
			db.transaction(async (tx) => {
				await tx.execute(sql`set local transaction isolation level serializable`);
				transactionConnection = tx;
				try {
					return await operation();
				} finally {
					transactionConnection = null;
				}
			}),
		lockOperation: async () => {
			if (transactionConnection === null) {
				throw new ProgramLocaleRepairError(
					"transaction_contract_error",
					"Repository lockOperation must run inside withSerializableTransaction",
				);
			}
			await transactionConnection.execute(sql`select pg_advisory_xact_lock(hashtext(${request.requestId}))`);
		},
		readStateForUpdate: async () => {
			if (transactionConnection === null) {
				throw new ProgramLocaleRepairError(
					"transaction_contract_error",
					"Repository readStateForUpdate must run inside withSerializableTransaction",
				);
			}
			return readLockedState(request, transactionConnection);
		},
		updateLocale: async (from, to) => {
			if (transactionConnection === null) {
				throw new ProgramLocaleRepairError(
					"transaction_contract_error",
					"Repository updateLocale must run inside withSerializableTransaction",
				);
			}
			const result = await transactionConnection
				.update(measurementScopes)
				.set({ locale: to, updatedAt: new Date() })
				.where(
					and(
						eq(measurementScopes.name, request.program.nameExact),
						eq(measurementScopes.locale, from),
					),
				)
				.returning({ id: measurementScopes.id });
			return result.length;
		},
	};
}

async function main(): Promise<void> {
	const options = parseOptions(process.argv.slice(2));
	const request = await readRequestFile(options.requestFile);
	const receipt = await executeProgramLocaleRepair(request, options.mode, createRepository(request));
	process.stdout.write(`${JSON.stringify({ ok: true, requestId: request.requestId, ...receipt })}\n`);
}

main().catch((error: unknown) => {
	const known = error instanceof ProgramLocaleRepairError;
	process.stderr.write(
		`${JSON.stringify({
			ok: false,
			code: known ? error.code : "program_locale_repair_failed",
			message: known ? error.message : "The Program locale repair failed",
		})}\n`,
	);
	process.exitCode = 1;
});
