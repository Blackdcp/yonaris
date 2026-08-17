import { readFile } from "node:fs/promises";
import { computeSystemTags } from "@workspace/lib/tag-utils";
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
import { executeProgramImport, type ProgramImportMode, type ProgramImportRepository } from "./program-import-operation";
import { parseProgramImportRequest, type ProgramImportRequest, type ProgramImportState, ProgramImportError } from "./program-import-policy";

type ProgramImportCliOptions = {
	mode: ProgramImportMode;
	requestFile: string;
};

function parseOptions(argv: readonly string[]): ProgramImportCliOptions {
	let mode: ProgramImportMode = "dry-run";
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
		throw new ProgramImportError("invalid_cli_arguments", `Unexpected argument: ${arg}`);
	}

	if (!requestFile) {
		throw new ProgramImportError("missing_request_file", "The Program import requires --request-file");
	}

	return { mode, requestFile };
}

async function readRequestFile(path: string): Promise<ProgramImportRequest> {
	const value = JSON.parse(await readFile(path, "utf8")) as unknown;
	return parseProgramImportRequest(value);
}

async function readLockedState(request: ProgramImportRequest, connection: any): Promise<ProgramImportState> {
	const brandRows = await connection
		.select({ id: brands.id, organizationId: brands.organizationId })
		.from(brands)
		.where(and(eq(brands.name, request.brand.nameExact), eq(brands.website, request.brand.websiteExact)))
		.limit(2);
	const brandId = brandRows.length === 1 ? (brandRows[0] as { id: string }).id : null;
	const organizationId = brandRows.length === 1 ? (brandRows[0] as { organizationId: string }).organizationId : null;

	const customerRows =
		organizationId === null
			? { rows: [] as Array<{ role: string }> }
			: await connection.execute(sql<{ role: string }>`
				select m.role
				from member m
				join "user" u on u.id = m.user_id
				where m.organization_id = ${organizationId}
				  and lower(u.email) = lower(${request.customer.emailExact})
				limit 2
			`);

	const scopeRows =
		brandId === null
			? []
			: await connection
				.select({
					id: measurementScopes.id,
					key: measurementScopes.key,
					name: measurementScopes.name,
					market: measurementScopes.market,
					locale: measurementScopes.locale,
					timezone: measurementScopes.timezone,
					evaluationRole: measurementScopes.samplingEvaluationRole,
					automaticTargetKeys: measurementScopes.automaticTargetKeys,
					enabled: measurementScopes.enabled,
					isDefault: measurementScopes.isDefault,
				})
				.from(measurementScopes)
				.where(and(eq(measurementScopes.brandId, brandId), eq(measurementScopes.key, request.program.keyExact)))
				.limit(2);

	if (scopeRows.length === 1) {
		await connection.execute(sql`select id from measurement_scopes where id = ${scopeRows[0]!.id} for update`);
	}

	const scopeId = scopeRows.length === 1 ? scopeRows[0]!.id : null;
	const promptRows =
		brandId === null || scopeId === null
			? []
			: await connection
				.select({ value: prompts.value, tagsExact: prompts.tags })
				.from(prompts)
				.where(and(eq(prompts.brandId, brandId), eq(prompts.scopeId, scopeId), eq(prompts.enabled, true)))
				.orderBy(asc(prompts.createdAt), asc(prompts.id));

	const [deliveryBatchHistory, observationAttemptHistory, promptRunHistory, evidenceArtifactHistory] =
		scopeId === null
			? [0, 0, 0, 0]
			: await Promise.all([
				connection
					.select({ count: count() })
					.from(deliveryBatches)
					.where(eq(deliveryBatches.scopeId, scopeId))
					.then((rows: Array<{ count: number | string }>) => Number(rows[0]?.count ?? 0)),
				connection
					.select({ count: count() })
					.from(observationAttempts)
					.where(eq(observationAttempts.scopeId, scopeId))
					.then((rows: Array<{ count: number | string }>) => Number(rows[0]?.count ?? 0)),
				connection
					.select({ count: count() })
					.from(promptRuns)
					.where(eq(promptRuns.scopeId, scopeId))
					.then((rows: Array<{ count: number | string }>) => Number(rows[0]?.count ?? 0)),
				connection
					.execute(sql<{ count: number | string }>`
						select count(*)::int as count
						from evidence_artifacts
						where brand_id = ${brandId}
						  and scope_id = ${scopeId}
						  and status = 'attached'
					`)
					.then((result: { rows: Array<{ count: number | string }> }) => Number(result.rows[0]?.count ?? 0)),
			]);

	return {
		brandMatches: brandRows.length,
		customerMatches: customerRows.rows.length,
		customerRole: (customerRows.rows[0] as { role?: string } | undefined)?.role ?? null,
		programMatches: scopeRows.length,
		program:
			scopeRows.length === 1
				? {
					key: scopeRows[0]!.key,
					name: scopeRows[0]!.name,
					market: scopeRows[0]!.market,
					locale: scopeRows[0]!.locale,
					timezone: scopeRows[0]!.timezone,
					evaluationRole: scopeRows[0]!.evaluationRole,
					automaticTargetKeys: scopeRows[0]!.automaticTargetKeys as string[] | null,
					enabled: scopeRows[0]!.enabled,
					isDefault: scopeRows[0]!.isDefault,
				}
				: null,
		prompts: promptRows.map((row: { value: string; tagsExact: string[] }) => ({ value: row.value, tagsExact: row.tagsExact })),
		history: {
			deliveryBatches: deliveryBatchHistory,
			observationAttempts: observationAttemptHistory,
			promptRuns: promptRunHistory,
			evidenceArtifacts: evidenceArtifactHistory,
		},
	};
}

function createRepository(request: ProgramImportRequest): ProgramImportRepository {
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
				throw new ProgramImportError("transaction_contract_error", "Repository lockOperation must run inside withSerializableTransaction");
			}
			await transactionConnection.execute(sql`select pg_advisory_xact_lock(hashtext(${request.requestId}))`);
		},
		readStateForUpdate: async () => {
			if (transactionConnection === null) {
				throw new ProgramImportError("transaction_contract_error", "Repository readStateForUpdate must run inside withSerializableTransaction");
			}
			return readLockedState(request, transactionConnection);
		},
		createProgramWithPrompts: async (currentRequest) => {
			if (transactionConnection === null) {
				throw new ProgramImportError("transaction_contract_error", "Repository createProgramWithPrompts must run inside withSerializableTransaction");
			}

			const brandRows = await transactionConnection
				.select({ id: brands.id, name: brands.name, website: brands.website })
				.from(brands)
				.where(and(eq(brands.name, currentRequest.brand.nameExact), eq(brands.website, currentRequest.brand.websiteExact)))
				.limit(2);
			if (brandRows.length !== 1) {
				throw new ProgramImportError("brand_not_found", "PPIO brand was not found");
			}
			const brand = brandRows[0] as { id: string; name: string; website: string };

			const [scopeCount] = await transactionConnection
				.select({ value: count(measurementScopes.id) })
				.from(measurementScopes)
				.where(eq(measurementScopes.brandId, brand.id));
			if ((scopeCount?.value ?? 0) >= 20) {
				throw new ProgramImportError("scope_limit_reached", "PPIO has reached the measurement scope limit");
			}

			const createdScopes = await transactionConnection
				.insert(measurementScopes)
				.values({
					brandId: brand.id,
					key: currentRequest.program.keyExact,
					name: currentRequest.program.nameExact,
					market: currentRequest.program.marketExact,
					locale: currentRequest.program.localeExact,
					timezone: currentRequest.program.timezoneExact,
					automaticTargetKeys: [],
					samplingEvaluationRole: currentRequest.program.evaluationRoleExact,
					enabled: true,
					isDefault: false,
				})
				.returning({ id: measurementScopes.id });
			if (createdScopes.length !== 1) {
				throw new ProgramImportError("scope_create_failed", "Expected to create exactly one Program");
			}
			const scopeId = createdScopes[0]!.id;

			await transactionConnection.insert(prompts).values(
				currentRequest.prompts.exact.map((prompt) => ({
					brandId: brand.id,
					scopeId,
					value: prompt.value,
					enabled: true,
					tags: [...prompt.tagsExact],
					systemTags: computeSystemTags(prompt.value, brand.name, brand.website),
				})),
			);
		},
	};
}

async function main(): Promise<void> {
	const options = parseOptions(process.argv.slice(2));
	const request = await readRequestFile(options.requestFile);
	const receipt = await executeProgramImport(request, options.mode, createRepository(request));
	process.stdout.write(`${JSON.stringify({ ok: true, requestId: request.requestId, ...receipt })}\n`);
}

main().catch((error: unknown) => {
	const known = error instanceof ProgramImportError;
	process.stderr.write(
		`${JSON.stringify({
			ok: false,
			code: known ? error.code : "program_import_failed",
			message: known ? error.message : "The Program import failed",
		})}\n`,
	);
	process.exitCode = 1;
});
