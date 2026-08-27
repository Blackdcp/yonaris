import type { OutputLanguage } from "@workspace/config/language";
import { getRunsPerPrompt } from "@workspace/lib/constants";
import { analyzeBrand } from "@workspace/lib/onboarding";
import { getProvider, type ModelConfig, type Provider, parseScrapeTargets } from "@workspace/lib/providers";
import { computeSystemTags, isPromptBranded } from "@workspace/lib/tag-utils";
import { executeClaimedReport } from "./report-execution";
import type { ReportExecutionClaim, ReportExecutionStore } from "./report-execution-store";
import { buildManualReportCandidates, preserveProviderReportRun } from "./report-job-data";

export interface CompetitorResult {
	name: string;
	domain: string;
}

interface PromptData {
	brandId: string;
	value: string;
	enabled: boolean;
	tags: string[];
	systemTags: string[];
}

// Report constants
const TARGET_PROMPTS_COUNT = 70;
const CANDIDATE_PROMPTS_COUNT = Math.ceil(TARGET_PROMPTS_COUNT * 1.2);

// Whitelabel deployments preserve the legacy asymmetric per-candidate sample
// counts used before SCRAPE_TARGETS drove dispatch. Any model outside this map
// on a whitelabel deployment is a configuration error (the legacy report flow
// only knew how to sample these three). Other deployment modes use
// RUNS_PER_PROMPT (same frequency as day-to-day prompt tracking).
const WHITELABEL_REPORT_RUNS_PER_MODEL: Record<string, number> = {
	chatgpt: 2,
	claude: 1,
	"google-ai-mode": 1,
};

function getReportRunsForModel(model: string): number {
	if (process.env.DEPLOYMENT_MODE === "whitelabel") {
		const count = WHITELABEL_REPORT_RUNS_PER_MODEL[model];
		if (count === undefined) {
			throw new Error(
				`Whitelabel report generation has no run count configured for model "${model}". ` +
					`Known models: ${Object.keys(WHITELABEL_REPORT_RUNS_PER_MODEL).join(", ")}.`,
			);
		}
		return count;
	}
	return getRunsPerPrompt();
}

export interface ReportJobData {
	reportId: string;
	brandName: string;
	brandWebsite: string;
	outputLanguage: OutputLanguage;
	manualPrompts?: readonly string[];
	/** Frozen database snapshot for controlled runs. Presence (including []) skips analyzeBrand entirely. */
	competitorSnapshot?: readonly CompetitorResult[];
	/** Internal account-ops override used by reviewed, budget-capped report manifests. */
	runsPerTargetOverride?: number;
	/** Fail the report before completion unless the final payload contains exactly this many runs. */
	expectedRunCount?: number;
}

export interface ReportJobContext {
	data: ReportJobData;
	claim: ReportExecutionClaim;
	stateStore: ReportExecutionStore;
	log: (message: string) => void;
}

export interface ReportWorkerDependencies {
	analyzeBrand: typeof analyzeBrand;
	parseScrapeTargets: (value?: string) => ModelConfig[];
	getProvider: (provider: string) => Pick<Provider, "run">;
	now: () => Date;
}

const productionDependencies: ReportWorkerDependencies = {
	analyzeBrand,
	parseScrapeTargets,
	getProvider,
	now: () => new Date(),
};

interface PromptRunResult {
	promptValue: string;
	runs: Array<{
		model: string;
		version: string;
		webSearchEnabled: boolean;
		rawOutput: unknown;
		webQueries: string[];
		textContent: string;
		brandMentioned: boolean;
		competitorsMentioned: string[];
	}>;
}

interface ReportData {
	competitors: readonly CompetitorResult[];
	prompts: PromptData[];
	promptRuns: PromptRunResult[];
}

async function settleAllOrThrowFirst<T>(promises: readonly Promise<T>[]): Promise<T[]> {
	let firstObservedFailure: { reason: unknown } | undefined;
	const tracked = promises.map((promise) =>
		promise.catch((reason: unknown) => {
			firstObservedFailure ??= { reason };
			throw reason;
		}),
	);
	const settled = await Promise.allSettled(tracked);
	if (firstObservedFailure) throw firstObservedFailure.reason;
	return settled.map((result) => (result as PromiseFulfilledResult<T>).value);
}

export type ReportProcessingResult =
	| { success: true; reportId: string; outputLanguage: OutputLanguage }
	| { success: false; reportId: string; outputLanguage: OutputLanguage; lostClaim: true };

// Function to select optimal prompts from candidates based on test results
function selectOptimalPrompts(
	candidateResults: Array<{
		promptValue: string;
		brandedPrompt: boolean;
		runs: Array<{
			brandMentioned: boolean;
			competitorsMentioned: string[];
		}>;
	}>,
	brandName: string,
	brandWebsite: string,
): string[] {
	// Calculate metrics for each candidate
	const scoredCandidates = candidateResults.map((candidate) => {
		const totalRuns = candidate.runs.length;
		const brandMentionCount = candidate.runs.filter((r) => r.brandMentioned).length;
		const competitorMentionCount = candidate.runs.filter((r) => r.competitorsMentioned.length > 0).length;

		const brandMentionRate = totalRuns > 0 ? brandMentionCount / totalRuns : 0;
		const competitorMentionRate = totalRuns > 0 ? competitorMentionCount / totalRuns : 0;

		// Check if prompt is actually branded (contains brand name/domain)
		const isActuallyBranded = isPromptBranded(candidate.promptValue, brandName, brandWebsite);

		return {
			promptValue: candidate.promptValue,
			brandedPrompt: candidate.brandedPrompt || isActuallyBranded,
			brandMentionRate,
			competitorMentionRate,
			hasBrandMention: brandMentionCount > 0,
			hasCompetitorMention: competitorMentionCount > 0,
		};
	});

	// Separate branded and non-branded prompts
	const nonBrandedPrompts = scoredCandidates.filter((c) => !c.brandedPrompt);
	const brandedPrompts = scoredCandidates.filter((c) => c.brandedPrompt);

	// Sort non-branded by: 1) has brand mention, 2) competitor mention rate, 3) brand mention rate
	nonBrandedPrompts.sort((a, b) => {
		if (a.hasBrandMention !== b.hasBrandMention) {
			return a.hasBrandMention ? -1 : 1;
		}
		if (Math.abs(a.competitorMentionRate - b.competitorMentionRate) > 0.1) {
			return b.competitorMentionRate - a.competitorMentionRate;
		}
		return b.brandMentionRate - a.brandMentionRate;
	});

	// Sort branded by: 1) brand mention rate, 2) competitor mention rate
	brandedPrompts.sort((a, b) => {
		if (Math.abs(a.brandMentionRate - b.brandMentionRate) > 0.1) {
			return b.brandMentionRate - a.brandMentionRate;
		}
		return b.competitorMentionRate - a.competitorMentionRate;
	});

	// Select prompts to meet brand mention requirements
	const selectedPrompts: string[] = [];
	let currentBrandMentions = 0;

	// First, add non-branded prompts with brand mentions
	for (const prompt of nonBrandedPrompts) {
		if (selectedPrompts.length >= TARGET_PROMPTS_COUNT) break;

		selectedPrompts.push(prompt.promptValue);
		if (prompt.hasBrandMention) {
			currentBrandMentions++;
		}
	}

	// If we need more prompts or more brand mentions, add branded prompts
	while (selectedPrompts.length < TARGET_PROMPTS_COUNT && brandedPrompts.length > 0) {
		const prompt = brandedPrompts.shift();
		if (!prompt) break;
		selectedPrompts.push(prompt.promptValue);
		if (prompt.hasBrandMention) {
			currentBrandMentions++;
		}
	}

	// Log selection summary
	console.log(`Selected ${selectedPrompts.length} prompts with estimated ${currentBrandMentions} brand mentions`);

	return selectedPrompts;
}

// Function to check for brand and competitor mentions
function analyzeMentions(
	content: string,
	brandName: string,
	brandWebsite: string,
	competitors: readonly CompetitorResult[],
): {
	brandMentioned: boolean;
	competitorsMentioned: string[];
} {
	const contentLower = content.toLowerCase();
	const brandNameLower = brandName.toLowerCase();

	// Extract domain from brandWebsite using URL constructor
	const url = new URL(brandWebsite.startsWith("http") ? brandWebsite : `https://${brandWebsite}`);
	const domain = url.hostname.replace(/^www\./, "").toLowerCase();

	// Check for brand mention (brand name or domain)
	const brandMentioned = contentLower.includes(brandNameLower) || contentLower.includes(domain);

	// Check for competitor mentions (by name or domain)
	const competitorsMentioned = competitors
		.filter((competitor) => {
			const nameMatch = contentLower.includes(competitor.name.toLowerCase());

			// Extract domain from competitor website
			const competitorUrl = new URL(
				competitor.domain.startsWith("http") ? competitor.domain : `https://${competitor.domain}`,
			);
			const competitorDomain = competitorUrl.hostname.replace(/^www\./, "").toLowerCase();

			const domainMatch = contentLower.includes(competitorDomain);
			return nameMatch || domainMatch;
		})
		.map((competitor) => competitor.name);

	return { brandMentioned, competitorsMentioned };
}

// Function to run a prompt across different models and return results.
// Iterates SCRAPE_TARGETS; per-model run count comes from getReportRunsForModel
// (whitelabel preserves the legacy 2+1+1 mapping; other modes match day-to-day
// tracking frequency).
async function runPrompt(
	promptValue: string,
	brandName: string,
	brandWebsite: string,
	competitors: readonly CompetitorResult[],
	scrapeConfigs: ModelConfig[],
	job: ReportJobContext,
	getProviderForReport: ReportWorkerDependencies["getProvider"],
	runsPerTargetOverride?: number,
): Promise<PromptRunResult> {
	const runOne = async (config: ModelConfig) => {
		const providerImpl = getProviderForReport(config.provider);
		const result = await providerImpl.run(config.model, promptValue, {
			webSearch: config.webSearch,
			version: config.version,
		});
		const { brandMentioned, competitorsMentioned } = analyzeMentions(
			result.textContent,
			brandName,
			brandWebsite,
			competitors,
		);
		return preserveProviderReportRun({
			model: config.model,
			configuredVersion: config.version,
			provider: config.provider,
			webSearchEnabled: config.webSearch,
			result,
			brandMentioned,
			competitorsMentioned,
		});
	};

	const runPromises = scrapeConfigs.flatMap((config) => {
		const count = runsPerTargetOverride ?? getReportRunsForModel(config.model);
		return Array.from({ length: count }, () => runOne(config));
	});

	const runResults = await settleAllOrThrowFirst(runPromises);

	job.log(`Completed ${runResults.length} runs for prompt: "${promptValue}"`);

	return {
		promptValue,
		runs: runResults,
	};
}

// Main report worker function. Queue and direct callers must atomically claim
// the row before entering this function; every write below is claim-scoped.
export function createProcessReportJob(dependencies: ReportWorkerDependencies) {
	return async function processReportJob(job: ReportJobContext): Promise<ReportProcessingResult> {
		const {
			reportId,
			brandName,
			brandWebsite,
			outputLanguage,
			manualPrompts,
			competitorSnapshot,
			runsPerTargetOverride,
			expectedRunCount,
		} = job.data;

		try {
			const outcome = await executeClaimedReport({
				claim: job.claim,
				stateStore: job.stateStore,
				now: dependencies.now,
				log: job.log,
				run: async (updateProgress) => {
					job.log(`Processing report ID: ${reportId} for brand: ${brandName} (output language: ${outputLanguage})`);

					const scrapeConfigs = dependencies.parseScrapeTargets(process.env.SCRAPE_TARGETS);
					const useManualPrompts = manualPrompts && manualPrompts.length > 0;
					if (useManualPrompts) {
						job.log(`Using ${manualPrompts.length} manual prompts - skipping auto-generation`);
					}
					if (competitorSnapshot !== undefined && !useManualPrompts) {
						throw new Error("A competitor snapshot requires at least one manual prompt");
					}

					await updateProgress(5);

					// Step 1: Analyze brand — competitors + candidate prompts in one shared
					// LLM call (same `analyzeBrand` the onboarding flow uses; provider-
					// agnostic with native web search wired in). Manual-prompt path skips
					// the prompt generation but still needs competitors.
					let suggestedPrompts: Array<{ prompt: string }> = [];
					let competitors: readonly CompetitorResult[];
					if (competitorSnapshot !== undefined) {
						competitors = competitorSnapshot.map((competitor) => ({ ...competitor }));
						job.log(`Using frozen competitor snapshot (${competitors.length} competitors) - skipping brand analysis`);
					} else {
						job.log(`Analyzing brand: ${brandWebsite}`);
						const suggestion = await dependencies.analyzeBrand({
							website: brandWebsite,
							brandName,
							maxPrompts: useManualPrompts ? 0 : CANDIDATE_PROMPTS_COUNT,
						});
						// The report renderer's CompetitorResult expects a single primary domain;
						// analyzeBrand returns the full list now. Take the first as the canonical
						// one for the report's UI (which doesn't display the rest anyway).
						competitors = suggestion.competitors
							.filter((c) => c.domains.length > 0)
							.map((c) => ({ name: c.name, domain: c.domains[0] }));
						suggestedPrompts = suggestion.suggestedPrompts;
					}
					await updateProgress(35);

					// Step 2: Build candidate prompt list — manual override or analyzeBrand output
					const candidatePrompts: { prompt: string; brandedPrompt: boolean }[] = useManualPrompts
						? buildManualReportCandidates(manualPrompts, (prompt) => isPromptBranded(prompt, brandName, brandWebsite))
						: suggestedPrompts.map((p) => ({
								prompt: p.prompt,
								brandedPrompt: isPromptBranded(p.prompt, brandName, brandWebsite),
							}));

					if (candidatePrompts.length === 0) {
						job.log(`No candidate prompts available, report cannot continue`);
						throw new Error("No candidate prompts available");
					}
					job.log(
						`${useManualPrompts ? "Using" : "Generated"} ${candidatePrompts.length} candidate prompts ` +
							`(${candidatePrompts.filter((p) => p.brandedPrompt).length} branded)`,
					);
					await updateProgress(40);

					// Step 4: Run all candidate prompts to test them
					job.log(`Testing ${candidatePrompts.length} candidate prompts`);
					const candidateResults: Array<{
						promptValue: string;
						brandedPrompt: boolean;
						runs: Array<{
							model: string;
							version: string;
							webSearchEnabled: boolean;
							rawOutput: unknown;
							webQueries: string[];
							textContent: string;
							brandMentioned: boolean;
							competitorsMentioned: string[];
						}>;
					}> = [];

					const totalCandidates = candidatePrompts.length;
					let completedCandidates = 0;

					// Run candidates in batches
					const batchSize = 20;
					for (let i = 0; i < candidatePrompts.length; i += batchSize) {
						const batch = candidatePrompts.slice(i, i + batchSize);
						const batchPromises = batch.map(async (candidate) => {
							try {
								const result = await runPrompt(
									candidate.prompt,
									brandName,
									brandWebsite,
									competitors,
									scrapeConfigs,
									job,
									dependencies.getProvider,
									runsPerTargetOverride,
								);
								completedCandidates++;
								const progress = 40 + (completedCandidates / totalCandidates) * 30; // 40-70% for testing
								await updateProgress(progress);
								return {
									promptValue: result.promptValue,
									brandedPrompt: candidate.brandedPrompt,
									runs: result.runs,
								};
							} catch (error) {
								job.log(
									`Error testing candidate "${candidate.prompt}": ${error instanceof Error ? error.message : "Unknown error"}`,
								);
								throw error;
							}
						});

						const batchResults = await settleAllOrThrowFirst(batchPromises);
						candidateResults.push(...batchResults);

						// Small delay between batches
						if (i + batchSize < candidatePrompts.length) {
							await new Promise((resolve) => setTimeout(resolve, 1000));
						}
					}

					await updateProgress(70);

					// Step 5: Select optimal prompts from candidates
					job.log(`Selecting optimal ${TARGET_PROMPTS_COUNT} prompts from ${candidateResults.length} candidates`);
					const selectedPromptValues = selectOptimalPrompts(candidateResults, brandName, brandWebsite);
					await updateProgress(75);

					// Step 6: Re-run selected prompts for final data
					job.log(`Running final ${selectedPromptValues.length} selected prompts`);
					const promptRuns: PromptRunResult[] = [];
					const totalFinalRuns = selectedPromptValues.length;
					let completedFinalRuns = 0;

					// Get the results for selected prompts from candidateResults
					const selectedPromptResults = candidateResults.filter((result) =>
						selectedPromptValues.includes(result.promptValue),
					);

					// Use existing results instead of re-running
					for (const result of selectedPromptResults) {
						promptRuns.push({
							promptValue: result.promptValue,
							runs: result.runs,
						});
						completedFinalRuns++;
						const progress = 75 + (completedFinalRuns / totalFinalRuns) * 20; // 75-95%
						await updateProgress(progress);
					}

					await updateProgress(95);

					// Create prompts data structure for storage
					const prompts: PromptData[] = selectedPromptValues.map((promptValue) => ({
						brandId: reportId,
						value: promptValue,
						enabled: true,
						tags: [],
						systemTags: computeSystemTags(promptValue, brandName, brandWebsite),
					}));

					// Create final report data
					const reportData: ReportData = {
						competitors,
						prompts,
						promptRuns,
					};
					const actualRunCount = promptRuns.reduce((total, promptRun) => total + promptRun.runs.length, 0);
					if (expectedRunCount !== undefined && actualRunCount !== expectedRunCount) {
						throw new Error(`Expected ${expectedRunCount} final report runs, received ${actualRunCount}`);
					}

					job.log(`Finalizing report with ${promptRuns.length} prompts and ${actualRunCount} model runs`);

					return {
						rawOutput: reportData,
						result: { success: true as const, reportId, outputLanguage },
					};
				},
			});

			if (outcome.disposition === "lost_claim") {
				return { success: false, reportId, outputLanguage, lostClaim: true };
			}
			job.log(`Successfully completed report ${reportId}`);
			return outcome.value;
		} catch (error) {
			job.log(`Error processing report ${reportId}: ${error instanceof Error ? error.message : "Unknown error"}`);
			throw error;
		}
	};
}

export const processReportJob = createProcessReportJob(productionDependencies);
