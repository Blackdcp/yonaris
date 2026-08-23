import { resolveObservationTarget } from "@workspace/lib/observation-targets";
import { getProvider, type ModelConfig, type Provider } from "@workspace/lib/providers";
import {
	OVERSEAS_SEARCH_EVIDENCE_MATRIX,
	OVERSEAS_SEARCH_EVIDENCE_PROMPT,
	qualifyProviderResult,
} from "./overseas-search-evidence-qualification.js";

const REQUIRED_ACKNOWLEDGEMENT = "paid-21-calls-2026-08-22";

type QualificationMatrixEntry = {
	channel: string;
	model: string;
	provider: string;
};

type QualificationSummary = {
	attempted: number;
	succeeded: number;
	failed: number;
};

type QualificationDependencies = {
	entries?: ReadonlyArray<QualificationMatrixEntry>;
	resolveProvider?: (provider: string) => Provider;
	resolveTarget?: (config: ModelConfig) => { captureRouteKey: string };
	write?: (row: unknown) => void;
	now?: () => number;
};

export function assertQualificationAcknowledged(environment: Record<string, string | undefined>): void {
	if (environment.OVERSEAS_SEARCH_EVIDENCE_QUALIFICATION_ACK !== REQUIRED_ACKNOWLEDGEMENT) {
		throw new Error(
			`Qualification performs 21 paid calls. Set OVERSEAS_SEARCH_EVIDENCE_QUALIFICATION_ACK=${REQUIRED_ACKNOWLEDGEMENT}`,
		);
	}
}

export async function runQualificationMatrix(
	dependencies: QualificationDependencies = {},
): Promise<QualificationSummary> {
	const entries = dependencies.entries ?? OVERSEAS_SEARCH_EVIDENCE_MATRIX;
	const providerFor = dependencies.resolveProvider ?? getProvider;
	const targetFor = dependencies.resolveTarget ?? resolveObservationTarget;
	const write = dependencies.write ?? ((row: unknown) => console.log(JSON.stringify(row)));
	const now = dependencies.now ?? Date.now;
	const summary: QualificationSummary = { attempted: 0, succeeded: 0, failed: 0 };

	for (const entry of entries) {
		summary.attempted += 1;
		const config: ModelConfig = { model: entry.model, provider: entry.provider, webSearch: true };
		let captureRouteKey = "unresolved";
		let provider: Provider;
		try {
			captureRouteKey = targetFor(config).captureRouteKey;
			provider = providerFor(entry.provider);
		} catch {
			writeFailure(write, entry, captureRouteKey, "validation_failed");
			summary.failed += 1;
			continue;
		}

		if (!provider.isConfigured()) {
			writeFailure(write, entry, captureRouteKey, "provider_not_configured");
			summary.failed += 1;
			continue;
		}

		if (provider.validateTarget?.(config)) {
			writeFailure(write, entry, captureRouteKey, "validation_failed");
			summary.failed += 1;
			continue;
		}

		if (provider.preflightTarget) {
			let preflightFailure: string | null;
			try {
				preflightFailure = await provider.preflightTarget(config);
			} catch {
				preflightFailure = "preflight failed";
			}
			if (preflightFailure) {
				writeFailure(write, entry, captureRouteKey, "provider_preflight_failed");
				summary.failed += 1;
				continue;
			}
		}

		const startedAt = now();
		try {
			const result = await provider.run(entry.model, OVERSEAS_SEARCH_EVIDENCE_PROMPT, { webSearch: true });
			write({
				kind: "candidate",
				status: "succeeded",
				...qualifyProviderResult({
					channel: entry.channel,
					provider: entry.provider,
					captureRouteKey,
					prompt: OVERSEAS_SEARCH_EVIDENCE_PROMPT,
					latencyMs: Math.max(0, now() - startedAt),
					result,
				}),
			});
			summary.succeeded += 1;
		} catch {
			writeFailure(write, entry, captureRouteKey, "provider_run_failed");
			summary.failed += 1;
		}
	}

	return summary;
}

function writeFailure(
	write: (row: unknown) => void,
	entry: QualificationMatrixEntry,
	captureRouteKey: string,
	failureClass:
		| "validation_failed"
		| "provider_not_configured"
		| "provider_preflight_failed"
		| "provider_run_failed",
): void {
	write({
		kind: "candidate",
		status: "failed",
		channel: entry.channel,
		provider: entry.provider,
		captureRouteKey,
		failureClass,
	});
}

async function main(): Promise<void> {
	assertQualificationAcknowledged(process.env);
	const summary = await runQualificationMatrix();
	console.log(JSON.stringify({ kind: "summary", ...summary }));
	if (summary.failed > 0) process.exitCode = 1;
}

if (require.main === module) {
	void main().catch((error) => {
		console.error(error instanceof Error ? error.message : "Overseas qualification failed");
		process.exitCode = 1;
	});
}
