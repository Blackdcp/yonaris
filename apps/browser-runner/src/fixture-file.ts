import { readFile } from "node:fs/promises";
import type { FixtureScenario, FixtureTask } from "./contracts.js";

const SCENARIOS = new Set<FixtureScenario>([
	"success",
	"success_without_brand",
	"pre_submit_transient_then_success",
	"post_submit_transient_then_success",
	"submit_unknown_then_confirmed",
	"login_required",
	"captcha",
	"page_drift",
]);

export async function readFixtureTasks(filePath: string): Promise<FixtureTask[]> {
	const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
	if (!Array.isArray(parsed) || parsed.length === 0)
		throw new Error("Fixture file must contain a non-empty JSON array");
	return parsed.map(parseFixtureTask);
}

function parseFixtureTask(value: unknown, index: number): FixtureTask {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error(`Fixture task ${index} must be an object`);
	const row = value as Record<string, unknown>;
	const requiredText = (key: string) => {
		const field = row[key];
		if (typeof field !== "string" || !field.trim()) throw new Error(`Fixture task ${index}.${key} is required`);
		const normalized = field.trim();
		if (normalized.length > (key === "promptText" ? 500_000 : 10_000)) {
			throw new Error(`Fixture task ${index}.${key} is too long`);
		}
		return normalized;
	};
	const scenario = row.scenario;
	if (scenario !== undefined && (typeof scenario !== "string" || !SCENARIOS.has(scenario as FixtureScenario))) {
		throw new Error(`Fixture task ${index}.scenario is unsupported`);
	}
	if (row.captureRouteKey !== "browser_runner.doubao") {
		throw new Error(`Fixture task ${index} must use captureRouteKey browser_runner.doubao`);
	}
	if (row.surfaceTargetKey !== "doubao.consumer_web") {
		throw new Error(`Fixture task ${index} must use surfaceTargetKey doubao.consumer_web`);
	}
	const sampleIndex = row.sampleIndex;
	if (!Number.isSafeInteger(sampleIndex) || (sampleIndex as number) <= 0) {
		throw new Error(`Fixture task ${index}.sampleIndex must be a positive integer`);
	}
	const sessionRequirement = row.sessionRequirement;
	if (sessionRequirement !== "anonymous_clean" && sessionRequirement !== "new_account_clean") {
		throw new Error(`Fixture task ${index}.sessionRequirement is unsupported`);
	}
	const evaluationRole = row.evaluationRole;
	if (evaluationRole !== "scored" && evaluationRole !== "observation") {
		throw new Error(`Fixture task ${index}.evaluationRole is unsupported`);
	}
	return {
		id: requiredText("id"),
		batchId: requiredText("batchId"),
		brandId: requiredText("brandId"),
		promptText: requiredText("promptText"),
		surfaceTargetKey: "doubao.consumer_web",
		captureRouteKey: "browser_runner.doubao",
		sampleIndex: sampleIndex as number,
		sessionRequirement,
		searchRequirement: "forbidden",
		evaluationRole,
		automationAttemptCount: 1,
		leaseGeneration: 1,
		...(scenario ? { scenario: scenario as FixtureScenario } : {}),
		...(typeof row.fixtureAnswer === "string" ? { fixtureAnswer: row.fixtureAnswer } : {}),
	};
}
