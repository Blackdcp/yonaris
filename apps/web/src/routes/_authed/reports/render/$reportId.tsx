/**
 * /reports/render/$reportId - Standalone report rendering page
 *
 * Production-quality printable report (US Letter 8.5 x 11 in).
 * Uses Share of Voice as the primary metric with rich competitive analysis.
 */
import { createFileRoute, notFound, useRouteContext } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { DEFAULT_APP_NAME, DEFAULT_APP_URL } from "@workspace/config/constants";
import { isContentLanguage, type OutputLanguage } from "@workspace/config/language";
import type { ClientConfig } from "@workspace/config/types";
import {
	analyzeByEngine,
	analyzeCompetitorFrequency,
	analyzeWebQueries,
	computeCompetitorSoVs,
	computeOverallSoV,
	computePromptSoV,
	type FullPromptRun,
	findContentGaps,
	getSoVColor,
	getSoVLevel,
	type ReportPromptRun,
	selectRepresentativePrompts,
} from "@workspace/lib/report-metrics";
import { parseGeneratedReportOutput } from "@workspace/lib/report-output";
import { BarChart3, Rocket, Target } from "lucide-react";
import type { ComponentProps, ComponentType } from "react";
import { Logo } from "@/components/logo";
import { PromptChartPrint } from "@/components/prompt-chart-print";
import { useI18n } from "@/i18n/provider";
import { getReportCopy, parseReportRenderLanguage } from "@/i18n/report-copy";
import { getReportByIdFn } from "@/server/reports";

type PromptChartPrintProps = ComponentProps<typeof PromptChartPrint>;
type ReportPromptChartRun = PromptChartPrintProps["promptRuns"][number] & { textContent: string };
type ReportPromptChartPrintProps = Omit<PromptChartPrintProps, "promptRuns"> & {
	outputLanguage: OutputLanguage;
	promptRuns: ReportPromptChartRun[];
};
const ReportPromptChartPrint = PromptChartPrint as ComponentType<ReportPromptChartPrintProps>;

// ---------- Types ----------

interface ReportData {
	competitors: CompetitorResult[];
	prompts: PromptData[];
	promptRuns: PromptRunResult[];
}

interface CompetitorResult {
	name: string;
	domain: string;
}
interface PromptData {
	value: string;
}

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

interface MockPrompt {
	id: string;
	brandId: string;
	value: string;
	enabled: boolean;
	createdAt: Date;
}

// ---------- Server function ----------

const loadReportData = createServerFn({ method: "GET" })
	.validator((d: string) => d)
	.handler(async ({ data: reportId }) => getReportByIdFn({ data: { reportId } }));

function persistedReportLanguage(value: unknown): OutputLanguage {
	return isContentLanguage(value) ? value : "en";
}

function validateReportRenderSearch(search: Record<string, unknown>): { outputLanguage?: OutputLanguage } {
	return isContentLanguage(search.outputLanguage) ? { outputLanguage: search.outputLanguage } : {};
}

function isPromptBranded(promptValue: string, brandName: string, brandWebsite: string): boolean {
	const promptLower = promptValue.toLowerCase();
	const brandNameLower = brandName.toLowerCase();
	try {
		const url = new URL(brandWebsite.startsWith("http") ? brandWebsite : `https://${brandWebsite}`);
		const domain = url.hostname.replace(/^www\./, "").toLowerCase();
		const domainWithoutTld = domain.split(".")[0];
		return (
			promptLower.includes(brandNameLower) || promptLower.includes(domain) || promptLower.includes(domainWithoutTld)
		);
	} catch {
		return promptLower.includes(brandNameLower);
	}
}

// ---------- Route ----------

export const Route = createFileRoute("/_authed/reports/render/$reportId")({
	validateSearch: validateReportRenderSearch,
	loader: async ({ params }) => {
		const report = await loadReportData({ data: params.reportId });
		if (!report) throw notFound();
		return { report };
	},
	head: ({ loaderData, match }) => {
		const persisted = persistedReportLanguage(loaderData?.report.outputLanguage);
		const selected = parseReportRenderLanguage(match.search.outputLanguage, persisted);
		return {
			meta: [{ title: getReportCopy(selected).reportTitle }, { name: "robots", content: "noindex, nofollow" }],
		};
	},
	component: ReportRenderPage,
});

// ---------- Color helpers ----------

function sovBgColor(sov: number | null): string {
	if (sov === null) return "bg-slate-300";
	if (sov >= 40) return "bg-emerald-500";
	if (sov >= 20) return "bg-amber-500";
	return "bg-rose-500";
}

// ---------- Main component ----------

function ReportRenderPage() {
	const { report } = Route.useLoaderData();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const { t } = useI18n();
	const context = useRouteContext({ strict: false }) as { clientConfig?: ClientConfig };
	const branding = context.clientConfig?.branding;
	const appName = branding?.name || DEFAULT_APP_NAME;
	const appUrl = formatBrandUrl(branding?.url || DEFAULT_APP_URL);
	const persistedOutputLanguage = persistedReportLanguage(report.outputLanguage);
	const selectedOutputLanguage = parseReportRenderLanguage(search.outputLanguage, persistedOutputLanguage);
	const copy = getReportCopy(selectedOutputLanguage);
	const outputLanguageControlLabels = {
		label: t("reports.outputLanguage.label"),
		en: t("reports.outputLanguage.option.en"),
		zhCn: t("reports.outputLanguage.option.zhCn"),
	};
	const setOutputLanguage = (outputLanguage: OutputLanguage) => {
		void navigate({
			search: (previous) => ({ ...previous, outputLanguage }),
		});
	};

	if (report.status !== "completed") {
		return (
			<>
				<ReportOutputLanguageControl
					labels={outputLanguageControlLabels}
					value={selectedOutputLanguage}
					onChange={setOutputLanguage}
				/>
				<main lang={selectedOutputLanguage} className="max-w-3xl mx-auto p-8">
					<p className="text-slate-500 text-center">
						{copy.statusLabel}: <span className="font-medium">{copy.status(report.status)}</span>
					</p>
				</main>
			</>
		);
	}

	const data: ReportData = parseGeneratedReportOutput(report.rawOutput);
	const reportCreatedAt = new Date(report.createdAt);

	// Build mock data structures for chart component compatibility
	const mockBrand: PromptChartPrintProps["brand"] = {
		id: "brand-1",
		name: report.brandName,
		website: report.brandWebsite,
		additionalDomains: [],
		aliases: [],
		enabled: true,
		onboarded: true,
		delayOverrideHours: null,
		enabledModels: null,
		organizationId: "report-render",
		createdAt: reportCreatedAt,
		updatedAt: reportCreatedAt,
	};
	const mockCompetitors: PromptChartPrintProps["competitors"] = data.competitors.map((comp, i) => ({
		id: `comp-${i + 1}`,
		name: comp.name,
		domains: [comp.domain],
		aliases: [],
		brandId: mockBrand.id,
		createdAt: reportCreatedAt,
		updatedAt: reportCreatedAt,
	}));
	const mockPrompts: MockPrompt[] = data.prompts.map((p, i) => ({
		id: `prompt-${i + 1}`,
		brandId: mockBrand.id,
		value: p.value,
		enabled: true,
		createdAt: reportCreatedAt,
	}));

	// Build run arrays
	const simpleRuns: ReportPromptRun[] = [];
	const fullRuns: FullPromptRun[] = [];
	const chartRuns: ReportPromptChartRun[] = [];

	data.promptRuns.forEach((pr, pi) => {
		pr.runs.forEach((run, ri) => {
			const promptId = `prompt-${pi + 1}`;
			simpleRuns.push({ promptId, brandMentioned: run.brandMentioned, competitorsMentioned: run.competitorsMentioned });
			fullRuns.push({
				promptId,
				promptValue: pr.promptValue,
				brandMentioned: run.brandMentioned,
				competitorsMentioned: run.competitorsMentioned,
				webQueries: run.webQueries || [],
				textContent: run.textContent || "",
				model: run.model,
			});
			chartRuns.push({
				id: `run-${pi}-${ri}`,
				promptId,
				brandId: mockBrand.id,
				brandMentioned: run.brandMentioned,
				competitorsMentioned: run.competitorsMentioned,
				createdAt: reportCreatedAt,
				model: run.model,
				provider: null,
				version: run.version,
				webSearchEnabled: run.webSearchEnabled,
				rawOutput: run.rawOutput,
				webQueries: run.webQueries,
				textContent: run.textContent,
			});
		});
	});

	// Deduplicate competitors by name (case-insensitive) and filter out brand
	const brandNameLower = report.brandName.toLowerCase().trim();
	const isBrandName = (name: string) => name.toLowerCase().trim() === brandNameLower;
	const seenCompetitorNames = new Set<string>();
	const filteredCompetitors = data.competitors.filter((c) => {
		const key = c.name.toLowerCase().trim();
		if (isBrandName(c.name) || seenCompetitorNames.has(key)) return false;
		seenCompetitorNames.add(key);
		return true;
	});

	// Core metrics
	const overallSoV = computeOverallSoV(simpleRuns, filteredCompetitors);
	const competitorSoVs = computeCompetitorSoVs(simpleRuns, filteredCompetitors);
	const promptSoVs = mockPrompts.map((p) => computePromptSoV(p.id, simpleRuns, filteredCompetitors));
	const promptMap = new Map(mockPrompts.map((p) => [p.id, p]));

	const selectedPrompts = selectRepresentativePrompts(promptSoVs, (id: string) => {
		const p = promptMap.get(id);
		return p ? isPromptBranded(p.value, report.brandName, report.brandWebsite) : false;
	});

	// Rich analysis
	const contentGaps = findContentGaps(fullRuns, 5);
	const allWebQueries = analyzeWebQueries(fullRuns, 1000);
	const competitorFreq = analyzeCompetitorFrequency(fullRuns, filteredCompetitors);
	const engineBreakdown = analyzeByEngine(fullRuns);

	// Enrich web queries with competitor mention data
	const queryCompetitorMap = new Map<string, { brandMentioned: boolean; competitorCount: number }>();
	const rawQueryByNormalizedQuery = new Map<string, string>();
	for (const run of fullRuns) {
		for (const query of run.webQueries || []) {
			const normalized = query.toLowerCase().trim();
			if (!normalized || normalized.length < 3) continue;
			if (!rawQueryByNormalizedQuery.has(normalized)) rawQueryByNormalizedQuery.set(normalized, query);
			const existing = queryCompetitorMap.get(normalized);
			const compCount = run.competitorsMentioned.length;
			if (!existing) {
				queryCompetitorMap.set(normalized, { brandMentioned: run.brandMentioned, competitorCount: compCount });
			} else {
				if (run.brandMentioned) existing.brandMentioned = true;
				existing.competitorCount = Math.max(existing.competitorCount, compCount);
			}
		}
	}
	// Mix of top-frequency + brand-mentioned queries
	const enrichedQueries = allWebQueries.map((q) => {
		const extra = queryCompetitorMap.get(q.query);
		return {
			...q,
			normalizedQuery: q.query,
			query: rawQueryByNormalizedQuery.get(q.query) ?? q.query,
			brandMentioned: extra?.brandMentioned ?? false,
			competitorCount: extra?.competitorCount ?? 0,
		};
	});
	const topSearchQueries: typeof enrichedQueries = [];
	const usedQueries = new Set<string>();
	const byFrequency = [...enrichedQueries].sort((a, b) => b.count - a.count);
	const withBrand = enrichedQueries.filter((q) => q.brandMentioned).sort((a, b) => b.count - a.count);
	for (const q of byFrequency) {
		if (topSearchQueries.length >= 3) break;
		if (!usedQueries.has(q.normalizedQuery)) {
			topSearchQueries.push(q);
			usedQueries.add(q.normalizedQuery);
		}
	}
	for (const q of withBrand) {
		if (topSearchQueries.length >= 6) break;
		if (!usedQueries.has(q.normalizedQuery)) {
			topSearchQueries.push(q);
			usedQueries.add(q.normalizedQuery);
		}
	}
	for (const q of byFrequency) {
		if (topSearchQueries.length >= 6) break;
		if (!usedQueries.has(q.normalizedQuery)) {
			topSearchQueries.push(q);
			usedQueries.add(q.normalizedQuery);
		}
	}
	topSearchQueries.sort((a, b) => b.competitorCount - a.competitorCount);

	const sovLevel = getSoVLevel(overallSoV);
	const localizedSovLevel = copy.sovLevel(sovLevel.label);
	const sovColor = getSoVColor(overallSoV);
	const totalPrompts = mockPrompts.length;
	const promptsWithMentions = promptSoVs.filter((p) => p.brandMentionCount > 0).length;
	const opportunityPriority = (overallSoV ?? 0) < 20 ? "high" : (overallSoV ?? 0) < 40 ? "medium" : "low";

	// Charts: 2 per page
	const chartPairs: Array<typeof selectedPrompts> = [];
	for (let i = 0; i < selectedPrompts.length; i += 2) {
		chartPairs.push(selectedPrompts.slice(i, i + 2));
	}

	return (
		<>
			<ReportOutputLanguageControl
				labels={outputLanguageControlLabels}
				value={selectedOutputLanguage}
				onChange={setOutputLanguage}
			/>
			<main lang={selectedOutputLanguage} className="max-w-[780px] mx-auto bg-white print:max-w-none text-slate-900">
				<style>{`
				@media print {
					@page { size: letter; margin: 0.5in 0.6in; }
					body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
				}
			`}</style>

				{/* ===== PAGE 1: COVER ===== */}
				<div className="print:h-[9.5in] print:flex print:flex-col p-10 print:p-0">
					<div className="h-[3px] bg-slate-800 -mx-10 print:-mx-0 mb-8" />

					<div className="flex items-center justify-between mb-16">
						<Logo
							iconClassName="!size-5"
							wordmarkClassName="h-5 max-w-32"
							textClassName="text-sm font-semibold text-slate-400"
							surface="light"
						/>
						<span className="text-xs tracking-wide text-slate-400">{copy.formatDate(new Date(report.createdAt))}</span>
					</div>

					<div className="flex-1 flex flex-col justify-center">
						<div className="text-[10px] font-semibold tracking-[0.25em] uppercase text-slate-400 mb-4">
							{copy.reportTitle}
						</div>
						<h1 className="text-4xl font-bold tracking-tight mb-2">{report.brandName}</h1>
						<div className="w-16 h-[2px] bg-slate-800 mb-12" />

						<div className="bg-slate-50 rounded-xl p-8 max-w-md mb-12">
							<div className="flex items-baseline gap-4">
								<span className={`text-6xl font-extrabold tracking-tighter ${sovColor}`}>
									{overallSoV !== null ? copy.formatPercent(overallSoV) : copy.notAvailable}
								</span>
								<div>
									<div className="text-sm font-semibold">{copy.shareOfVoice}</div>
									<div className="text-xs text-slate-500">
										{localizedSovLevel.label} &mdash; {localizedSovLevel.description}
									</div>
								</div>
							</div>
							<div className="mt-4 w-full bg-slate-200 rounded-full h-2">
								<div
									className={`h-2 rounded-full ${sovBgColor(overallSoV)}`}
									style={{ width: `${Math.max(2, overallSoV ?? 0)}%` }}
								/>
							</div>
						</div>

						<div className="grid grid-cols-3 gap-6 max-w-lg">
							<CoverStat value={copy.formatNumber(totalPrompts)} label={copy.cover.promptsTested} />
							<CoverStat value={copy.formatNumber(promptsWithMentions)} label={copy.cover.brandMentions} />
							<CoverStat value={copy.formatNumber(filteredCompetitors.length)} label={copy.cover.competitors} />
						</div>
					</div>

					<PageFooter branding={branding} />
				</div>

				{/* ===== PAGE 2: COMPETITIVE OVERVIEW ===== */}
				<div className="print:break-before-page print:h-[9.5in] print:flex print:flex-col p-10 print:p-0">
					<RunningHeader brand={report.brandName} title={copy.reportTitle} />

					<Section
						title={copy.sections.aiEnginePerformance}
						subtitle={copy.sections.aiEnginePerformanceSubtitle(
							copy.formatNumber(engineBreakdown.reduce((sum, engine) => sum + engine.totalRuns, 0)),
						)}
					/>
					<div className="grid grid-cols-3 gap-3 mb-8">
						{engineBreakdown.map((eng) => (
							<div key={eng.engine} className="border border-slate-200 rounded-lg p-4">
								<div className="text-[11px] font-medium text-slate-500 mb-2">{eng.engine}</div>
								<div className={`text-3xl font-bold ${getSoVColor(eng.mentionRate)}`}>
									{copy.formatPercent(eng.mentionRate)}
								</div>
								<div className="text-[10px] text-slate-400 mt-1">
									{copy.sections.engineRuns(copy.formatNumber(eng.brandMentions), copy.formatNumber(eng.totalRuns))}
								</div>
								<div className="mt-2.5 w-full bg-slate-100 rounded-full h-1.5">
									<div
										className={`h-1.5 rounded-full ${sovBgColor(eng.mentionRate)}`}
										style={{ width: `${Math.max(2, eng.mentionRate)}%` }}
									/>
								</div>
							</div>
						))}
					</div>

					<Section title={copy.sections.competitiveLandscape} subtitle={copy.sections.competitiveLandscapeSubtitle} />
					<div className="border border-slate-200 rounded-lg overflow-hidden mb-8 print:pb-px">
						<table className="w-full">
							<thead>
								<tr className="bg-slate-50 border-b border-slate-200">
									<TH align="left">{copy.table.brand}</TH>
									<TH align="right" className="w-16">
										{copy.table.sov}
									</TH>
									<TH align="left" className="w-[40%]">
										{copy.table.share}
									</TH>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{[
									{ name: report.brandName, sov: overallSoV ?? 0, isBrand: true },
									...competitorSoVs
										.filter((c) => !isBrandName(c.name))
										.slice(0, 3)
										.map((c) => ({ name: c.name, sov: c.sov, isBrand: false })),
								]
									.sort((a, b) => b.sov - a.sov)
									.map((row) => (
										<tr key={row.name} className={row.isBrand ? "bg-[#fff4ec]" : ""}>
											<td className={`py-2.5 px-4 text-sm ${row.isBrand ? "font-semibold" : "text-slate-600"}`}>
												{row.name}
											</td>
											<td className="py-2.5 px-4 text-right">
												<span className={`text-sm font-bold ${row.isBrand ? sovColor : "text-slate-500"}`}>
													{copy.formatPercent(row.sov)}
												</span>
											</td>
											<td className="py-2.5 px-4">
												<Bar value={row.sov} color={row.isBrand ? "bg-[#1e2a39]" : "bg-slate-300"} />
											</td>
										</tr>
									))}
							</tbody>
						</table>
					</div>

					{competitorFreq.length > 0 && (
						<>
							<Section title={copy.sections.mentionRate} subtitle={copy.sections.mentionRateSubtitle} />
							<div className="border border-slate-200 rounded-lg overflow-hidden print:pb-px">
								<table className="w-full">
									<thead>
										<tr className="bg-slate-50 border-b border-slate-200">
											<TH align="left">{copy.table.brand}</TH>
											<TH align="center">{copy.table.mentions}</TH>
											<TH align="center">{copy.table.uniquePrompts}</TH>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{[
											{
												name: report.brandName,
												mentionCount: simpleRuns.filter((r) => r.brandMentioned).length,
												promptCount: promptsWithMentions,
												isBrand: true,
											},
											...competitorFreq
												.filter((c) => !isBrandName(c.name))
												.slice(0, 3)
												.map((c) => ({ ...c, isBrand: false })),
										]
											.sort((a, b) => b.mentionCount - a.mentionCount)
											.map((c) => (
												<tr key={c.name} className={c.isBrand ? "bg-[#fff4ec]" : ""}>
													<td
														className={`py-2 px-4 text-xs font-medium ${c.isBrand ? "text-slate-900" : "text-slate-700"}`}
													>
														{c.name}
													</td>
													<td className="py-2 px-4 text-center text-xs text-slate-600">
														{copy.formatNumber(c.mentionCount)}
														<span className="text-slate-400">/{copy.formatNumber(simpleRuns.length)}</span>
													</td>
													<td className="py-2 px-4 text-center text-xs text-slate-600">
														{copy.formatNumber(c.promptCount)}
														<span className="text-slate-400">/{copy.formatNumber(totalPrompts)}</span>
													</td>
												</tr>
											))}
									</tbody>
								</table>
							</div>
						</>
					)}

					<div className="mt-auto">
						<PageFooter branding={branding} />
					</div>
				</div>

				{/* ===== CHART PAGES ===== */}
				{chartPairs.map((pair, pageIdx) => (
					<div
						key={pair.map((prompt) => prompt.promptId).join(":")}
						className="print:break-before-page print:h-[9.5in] print:flex print:flex-col p-10 print:p-0"
					>
						<RunningHeader brand={report.brandName} title={copy.reportTitle} />

						{pageIdx === 0 ? (
							<Section title={copy.sections.promptAnalysis} subtitle={copy.sections.promptAnalysisSubtitle} />
						) : (
							<div className="text-xs text-slate-400 italic mb-4">{copy.sections.promptAnalysisContinued}</div>
						)}

						<div className="flex-1 flex flex-col gap-5">
							{pair.map((selected) => {
								const prompt = promptMap.get(selected.promptId);
								if (!prompt) return null;
								return (
									<div key={selected.promptId} className="flex-1 flex flex-col">
										<ReportPromptChartPrint
											lookback="1m"
											promptName={prompt.value}
											promptId={prompt.id}
											brand={mockBrand}
											competitors={mockCompetitors}
											promptRuns={chartRuns}
											category={selected.category}
											outputLanguage={selectedOutputLanguage}
										/>
									</div>
								);
							})}
						</div>

						<div className="mt-auto">
							<PageFooter branding={branding} />
						</div>
					</div>
				))}

				{/* ===== OPPORTUNITIES ===== */}
				<div className="print:break-before-page print:h-[9.5in] print:flex print:flex-col p-10 print:p-0">
					<RunningHeader brand={report.brandName} title={copy.reportTitle} />

					<Section title={copy.sections.contentGaps} subtitle={copy.sections.contentGapsSubtitle(report.brandName)} />

					{contentGaps.length > 0 ? (
						<div className="border border-slate-200 rounded-lg overflow-hidden mb-8">
							<table className="w-full">
								<thead>
									<tr className="bg-slate-50 border-b border-slate-200">
										<TH align="left">{copy.table.prompt}</TH>
										<TH align="left" className="w-[50%]">
											{copy.table.competitorsFound}
										</TH>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{contentGaps.map((gap) => (
										<tr key={gap.promptId}>
											<td className="py-2.5 px-4 text-xs text-slate-700 leading-relaxed max-w-[320px]">
												{gap.promptValue}
											</td>
											<td className="py-2.5 px-4">
												<div className="flex flex-wrap gap-1">
													{gap.competitorsMentioned.slice(0, 3).map((c) => (
														<span
															key={c}
															className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium"
														>
															{c}
														</span>
													))}
													{gap.competitorsMentioned.length > 3 && (
														<span className="text-[10px] text-slate-400">
															+{copy.formatNumber(gap.competitorsMentioned.length - 3)}
														</span>
													)}
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : (
						<div className="border border-slate-200 rounded-lg p-6 text-center mb-8">
							<p className="text-slate-500 text-sm">{copy.sections.contentGapsEmpty(report.brandName)}</p>
						</div>
					)}

					{topSearchQueries.length > 0 && (
						<>
							<Section title={copy.sections.topSearchQueries} subtitle={copy.sections.topSearchQueriesSubtitle} />
							<div className="border border-slate-200 rounded-lg overflow-hidden">
								<table className="w-full">
									<thead>
										<tr className="bg-slate-50 border-b border-slate-200">
											<TH align="left">{copy.table.query}</TH>
											<TH align="center" className="w-28">
												{copy.table.competitorsFound}
											</TH>
											<TH align="center" className="w-24">
												{copy.table.brandMentioned}
											</TH>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{topSearchQueries.map((q) => (
											<tr key={q.normalizedQuery}>
												<td className="py-2.5 px-4 text-xs text-slate-700 max-w-[350px] break-words">{q.query}</td>
												<td className="py-2.5 px-4 text-center text-xs text-slate-600">
													{copy.formatNumber(q.competitorCount)}
												</td>
												<td className="py-2.5 px-4 text-center">
													{q.brandMentioned ? (
														<span className="text-emerald-600 font-semibold text-xs">&#10003;</span>
													) : (
														<span className="text-slate-300 text-xs">&mdash;</span>
													)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</>
					)}

					<div className="mt-auto">
						<PageFooter branding={branding} />
					</div>
				</div>

				{/* ===== SoV OPPORTUNITY + WHAT TO DO NEXT ===== */}
				<div className="print:break-before-page print:h-[9.5in] print:flex print:flex-col p-10 print:p-0">
					<RunningHeader brand={report.brandName} title={copy.reportTitle} />

					<Section
						title={copy.sections.shareOfVoiceOpportunity}
						subtitle={copy.sections.shareOfVoiceOpportunitySubtitle}
					/>

					<div className="border border-slate-200 rounded-lg overflow-hidden mb-8">
						<table className="w-full">
							<thead>
								<tr className="bg-slate-50 border-b border-slate-200">
									<TH align="center">{copy.table.promptsWithMentions}</TH>
									<TH align="center">{copy.table.totalPromptsTested}</TH>
									<TH align="center">{copy.table.overallSov}</TH>
									<TH align="center">{copy.table.opportunity}</TH>
									<TH align="left">{copy.table.recommendation}</TH>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td className="text-center py-3 px-4 text-sm font-semibold">
										{copy.formatNumber(promptsWithMentions)}
									</td>
									<td className="text-center py-3 px-4 text-sm text-slate-600">{copy.formatNumber(totalPrompts)}</td>
									<td className="text-center py-3 px-4">
										<span className={`text-sm font-bold ${sovColor}`}>{copy.formatPercent(overallSoV ?? 0)}</span>
									</td>
									<td className="text-center py-3 px-4">
										<span
											className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold ${(overallSoV ?? 0) < 20 ? "bg-rose-50 text-rose-700" : (overallSoV ?? 0) < 40 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
										>
											{copy.priorities[opportunityPriority]}
										</span>
									</td>
									<td className="py-3 px-4 text-xs text-slate-600">{copy.recommendation(opportunityPriority)}</td>
								</tr>
							</tbody>
						</table>
					</div>

					<Section title={copy.sections.nextSteps} subtitle={copy.sections.nextStepsSubtitle(report.brandName)} />

					{(() => {
						const opportunities = promptSoVs
							.filter((p) => p.totalCompetitorMentions > 0)
							.map((p) => {
								const prompt = promptMap.get(p.promptId);
								const brandSoV = p.sov ?? 0;
								// Find the single highest competitor's SoV for this prompt
								const topCompMentions = Math.max(...Object.values(p.competitorMentions), 0);
								const denom = p.brandMentionCount + p.totalCompetitorMentions;
								const maxCompSoV = denom > 0 ? Math.round((topCompMentions / denom) * 100) : 0;
								const gap = maxCompSoV - brandSoV;
								// Goal: match or slightly beat the top competitor
								const margin = gap > 30 ? 5 : gap > 15 ? 8 : 10;
								const goalSoV = Math.min(100, maxCompSoV + margin);
								// Article count scales with gap
								const articleCount = gap > 40 ? 8 : gap > 25 ? 6 : gap > 10 ? 5 : 4;
								return {
									promptValue: prompt?.value ?? p.promptId,
									brandSoV,
									maxCompSoV,
									gap,
									goalSoV,
									articleCount,
								};
							})
							.filter((o) => o.gap > 0)
							// Prefer prompts where brand has SOME presence (more actionable), then by gap
							.sort((a, b) => {
								if (a.brandSoV > 0 && b.brandSoV === 0) return -1;
								if (a.brandSoV === 0 && b.brandSoV > 0) return 1;
								return b.gap - a.gap;
							})
							.slice(0, 5);

						if (opportunities.length === 0) {
							return (
								<div className="border border-slate-200 rounded-lg p-6 text-center">
									<p className="text-slate-500 text-sm">{copy.sections.nextStepsEmpty(report.brandName)}</p>
								</div>
							);
						}

						return (
							<div className="border border-slate-200 rounded-lg overflow-hidden">
								<table className="w-full">
									<thead>
										<tr className="bg-slate-50 border-b border-slate-200">
											<TH align="left">{copy.table.prompt}</TH>
											<TH align="center">{copy.table.currentSov}</TH>
											<TH align="center">{copy.table.topCompetitorSov}</TH>
											<TH align="center">{copy.table.goalSov}</TH>
											<TH align="left">{copy.table.recommendation}</TH>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{opportunities.map((o) => (
											<tr key={o.promptValue}>
												<td className="py-2.5 px-4 text-xs text-slate-700 max-w-[200px] break-words leading-relaxed">
													{o.promptValue}
												</td>
												<td className="py-2.5 px-4 text-center">
													<span className={`text-xs font-semibold ${getSoVColor(o.brandSoV)}`}>
														{copy.formatPercent(o.brandSoV)}
													</span>
												</td>
												<td className="py-2.5 px-4 text-center text-xs font-semibold text-slate-600">
													{copy.formatPercent(o.maxCompSoV)}
												</td>
												<td className="py-2.5 px-4 text-center text-xs font-semibold text-emerald-600">
													{copy.formatPercent(o.goalSoV)}
												</td>
												<td className="py-2.5 px-4 text-xs text-slate-600">
													{copy.writeArticlesRecommendation(o.articleCount, o.promptValue)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						);
					})()}

					<div className="mt-auto">
						<PageFooter branding={branding} />
					</div>
				</div>

				{/* ===== CTA ===== */}
				<div className="print:break-before-page print:h-[9.5in] print:flex print:flex-col print:justify-center p-10 print:p-0">
					<div className="bg-gradient-to-r from-[#f6f4f1] to-[#fff4ec] border border-[#dde2e8] rounded-xl p-10 text-center">
						<h2 className="text-2xl font-bold text-slate-800 mb-2">{copy.cta.title}</h2>
						<p className="text-slate-600 text-base mb-8">{copy.cta.summary(appName)}</p>

						<div className="grid grid-cols-3 gap-6 mb-8">
							<div className="text-center p-4">
								<div className="flex justify-center mb-3">
									<Target className="h-8 w-8 text-slate-600" />
								</div>
								<h3 className="font-semibold text-slate-800 mb-2">{copy.cta.strategicOptimization}</h3>
								<p className="text-sm text-slate-600 leading-relaxed">{copy.cta.strategicOptimizationDescription}</p>
							</div>
							<div className="text-center p-4">
								<div className="flex justify-center mb-3">
									<BarChart3 className="h-8 w-8 text-slate-600" />
								</div>
								<h3 className="font-semibold text-slate-800 mb-2">{copy.cta.continuousMonitoring}</h3>
								<p className="text-sm text-slate-600 leading-relaxed">{copy.cta.continuousMonitoringDescription}</p>
							</div>
							<div className="text-center p-4">
								<div className="flex justify-center mb-3">
									<Rocket className="h-8 w-8 text-slate-600" />
								</div>
								<h3 className="font-semibold text-slate-800 mb-2">{copy.cta.competitiveAdvantage}</h3>
								<p className="text-sm text-slate-600 leading-relaxed">{copy.cta.competitiveAdvantageDescription}</p>
							</div>
						</div>

						<div className="pt-6 border-t border-[#dde2e8]">
							<p className="text-slate-800 font-medium mb-2">{copy.cta.getStarted(appName)}</p>
							{appUrl && <p className="text-slate-600 text-sm text-balance">{copy.cta.visit(appUrl)}</p>}
						</div>
					</div>
				</div>
			</main>
		</>
	);
}

// ---------- Sub-components ----------

function ReportOutputLanguageControl({
	labels,
	value,
	onChange,
}: {
	labels: { label: string; en: string; zhCn: string };
	value: OutputLanguage;
	onChange: (value: OutputLanguage) => void;
}) {
	return (
		<div className="print:hidden max-w-[780px] mx-auto px-4 py-3 flex items-center justify-end gap-2 text-sm">
			<label htmlFor="report-render-output-language" className="text-slate-600">
				{labels.label}
			</label>
			<select
				id="report-render-output-language"
				value={value}
				onChange={(event) => {
					if (isContentLanguage(event.target.value)) onChange(event.target.value);
				}}
				className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800"
			>
				<option value="en">{labels.en}</option>
				<option value="zh-CN">{labels.zhCn}</option>
			</select>
		</div>
	);
}

function RunningHeader({ brand, title }: { brand: string; title: string }) {
	return (
		<div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100">
			<span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-400">{title}</span>
			<span className="text-[10px] font-medium text-slate-400">{brand}</span>
		</div>
	);
}

function Section({ title, subtitle }: { title: string; subtitle?: string }) {
	return (
		<div className="border-l-[3px] border-slate-800 pl-3 mb-4">
			<h2 className="text-base font-semibold">{title}</h2>
			{subtitle && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{subtitle}</p>}
		</div>
	);
}

function TH({
	children,
	align,
	className = "",
}: {
	children: React.ReactNode;
	align: "left" | "center" | "right";
	className?: string;
}) {
	const alignCls = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
	return (
		<th
			className={`py-2.5 px-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${alignCls} ${className}`}
		>
			{children}
		</th>
	);
}

function CoverStat({ value, label }: { value: string; label: string }) {
	return (
		<div className="border-t-2 border-slate-800 pt-3">
			<div className="text-2xl font-bold">{value}</div>
			<div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
		</div>
	);
}

function Bar({ value, color }: { value: number | null; color: string }) {
	return (
		<div className="w-full bg-slate-100 rounded-full h-2.5">
			<div className={`${color} h-2.5 rounded-full`} style={{ width: `${Math.max(2, value ?? 0)}%` }} />
		</div>
	);
}

function PageFooter({ branding }: { branding?: ClientConfig["branding"] }) {
	const brandUrl = formatBrandUrl(branding?.url || DEFAULT_APP_URL);

	return (
		<div className="pt-4 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
			<Logo
				iconClassName="!size-3"
				wordmarkClassName="h-3.5 max-w-24"
				textClassName="text-[10px] font-medium text-slate-400"
				surface="light"
			/>
			{brandUrl && <span>{brandUrl}</span>}
		</div>
	);
}

function formatBrandUrl(url: string): string {
	try {
		const parsed = new URL(url);
		if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1") return "";
		return `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "")}`;
	} catch {
		return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
	}
}
