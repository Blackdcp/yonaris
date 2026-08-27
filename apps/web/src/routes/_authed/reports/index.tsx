/**
 * /reports - Reports list page
 *
 * Requires admin OR report generator access.
 * Replicates: apps/web/src/app/reports/page.tsx + reports-content.tsx
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { isContentLanguage, type OutputLanguage } from "@workspace/config/language";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar";
import { Textarea } from "@workspace/ui/components/textarea";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { LocalizedRawDetail } from "@/components/localized-raw-detail";
import { SiteHeader } from "@/components/site-header";
import { type MessageId, translate } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import {
	type ArtifactLanguageStorage,
	persistArtifactLanguageSelection,
	REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY,
	resolveArtifactLanguageSelection,
} from "@/lib/artifact-language-selection";
import { canAccessPlatformReports } from "@/lib/auth/execution-boundaries";
import { hasReportAccess, isAdmin, requireAuthSession } from "@/lib/auth/helpers";
import { getDeployment } from "@/lib/config/server";
import { trackEvent } from "@/lib/posthog";
import { buildTitle, getAppName } from "@/lib/route-head";
import { createReportFn, getReportsFn, REPORT_OUTPUT_LANGUAGE_TEMPORARILY_UNAVAILABLE } from "@/server/reports";

type ReportCreateFormData = {
	brandName: string;
	brandWebsite: string;
	manualPrompts: string;
};

type ReportCreateInput = ReportCreateFormData & {
	outputLanguage: OutputLanguage;
};

const REPORT_STATUS_LABELS: Partial<Record<string, MessageId>> = {
	pending: "reports.status.pending",
	processing: "reports.status.processing",
	completed: "reports.status.completed",
	failed: "reports.status.failed",
};

export function buildReportCreateInput(data: ReportCreateFormData, outputLanguage: OutputLanguage): ReportCreateInput {
	return {
		brandName: data.brandName,
		brandWebsite: data.brandWebsite,
		manualPrompts: data.manualPrompts,
		outputLanguage,
	};
}

function browserSessionStorage(): ArtifactLanguageStorage | undefined {
	if (typeof window === "undefined") return undefined;
	try {
		return window.sessionStorage;
	} catch {
		return undefined;
	}
}

const checkReportAccess = createServerFn({ method: "GET" }).handler(
	async (): Promise<{
		hasAccess: boolean;
		isAdmin: boolean;
		hasReportAccess: boolean;
	}> => {
		const session = await requireAuthSession();
		const admin = isAdmin(session);
		const reportAccess = hasReportAccess(session);
		return {
			hasAccess: canAccessPlatformReports({
				reportGenerationEnabled: getDeployment().features.reportGeneration,
				platformAdmin: admin,
				explicitReportOperator: reportAccess,
			}),
			isAdmin: admin,
			hasReportAccess: reportAccess,
		};
	},
);

export const Route = createFileRoute("/_authed/reports/")({
	head: ({ match }) => {
		const appName = getAppName(match);
		const uiLanguage = match.context?.uiLanguage ?? "en";
		return {
			meta: [
				{ title: buildTitle(translate(uiLanguage, "reports.head.title"), { appName }) },
				{ name: "description", content: translate(uiLanguage, "reports.head.description") },
			],
		};
	},
	beforeLoad: async () => {
		const { hasAccess, isAdmin, hasReportAccess } = await checkReportAccess();
		if (!hasAccess) throw notFound();
		return { isAdmin, hasReportAccess };
	},
	component: ReportsPage,
});

function ReportsPage() {
	const { isAdmin, hasReportAccess } = Route.useRouteContext();
	const { locale: uiLanguage, t } = useI18n();
	const queryClient = useQueryClient();

	const {
		data: reports = [],
		error,
		isLoading,
	} = useQuery({
		queryKey: ["reports"],
		queryFn: () => getReportsFn(),
		refetchInterval: 5000,
		staleTime: 2000,
	});

	const [formData, setFormData] = useState<ReportCreateFormData>({
		brandName: "",
		brandWebsite: "",
		manualPrompts: "",
	});
	const [submitError, setSubmitError] = useState<Error | null>(null);
	const [success, setSuccess] = useState(false);
	const [selectedOutputLanguage, setSelectedOutputLanguage] = useState<OutputLanguage | null>(null);

	useEffect(() => {
		if (selectedOutputLanguage !== null) return;
		setSelectedOutputLanguage(
			resolveArtifactLanguageSelection(
				browserSessionStorage(),
				REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY,
				uiLanguage,
			),
		);
	}, [selectedOutputLanguage, uiLanguage]);

	const outputLanguage = selectedOutputLanguage ?? uiLanguage;
	const isOutputLanguageResolved = selectedOutputLanguage !== null;

	const createMutation = useMutation({
		mutationFn: (data: ReportCreateInput) => createReportFn({ data }),
		onSuccess: (_data, variables) => {
			trackEvent("report_created", { has_manual_prompts: Boolean(variables.manualPrompts) });
			setSuccess(true);
			setFormData({ brandName: "", brandWebsite: "", manualPrompts: "" });
			queryClient.invalidateQueries({ queryKey: ["reports"] });
		},
		onError: (err: Error) => {
			setSubmitError(err);
		},
	});

	const handleOutputLanguageChange = (value: string) => {
		if (!isContentLanguage(value)) return;
		persistArtifactLanguageSelection(browserSessionStorage(), REPORT_CREATE_ARTIFACT_LANGUAGE_SELECTION_KEY, value);
		setSelectedOutputLanguage(value);
	};

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		if (!isOutputLanguageResolved) return;
		setSubmitError(null);
		setSuccess(false);
		createMutation.mutate(buildReportCreateInput(formData, outputLanguage));
	};

	const getStatusBadgeVariant = (status: string) => {
		switch (status) {
			case "completed":
				return "default" as const;
			case "processing":
				return "secondary" as const;
			case "failed":
				return "destructive" as const;
			default:
				return "outline" as const;
		}
	};

	const extractDomain = (url: string) => {
		try {
			return new URL(url).hostname.replace("www.", "");
		} catch {
			return url;
		}
	};

	const manualPromptCount = formData.manualPrompts
		.trim()
		.split("\n")
		.filter((line) => line.trim()).length;
	const formDisabled = createMutation.isPending || !isOutputLanguageResolved;

	return (
		<SidebarProvider>
			<AppSidebar isAdmin={isAdmin} hasReportAccess={hasReportAccess} adminOnly />
			<SidebarInset className="md:border md:border-border/60 md:rounded-xl overflow-hidden">
				<SiteHeader isPlatformAdmin={isAdmin} />
				<div className="flex flex-1 flex-col">
					<div className="@container/main flex flex-1 flex-col gap-2">
						<div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
							<div className="space-y-8">
								<div className="space-y-2">
									<h1 className="text-3xl font-bold tracking-tight">{t("reports.title")}</h1>
									<p className="text-muted-foreground">{t("reports.description")}</p>
								</div>
								<div className="space-y-6 max-w-4xl">
									<div className="space-y-4">
										<h2 className="text-2xl font-semibold">{t("reports.create.title")}</h2>

										<form onSubmit={handleSubmit} className="space-y-4">
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
												<div className="space-y-2">
													<Label htmlFor="brandName">{t("reports.brandName.label")}</Label>
													<Input
														id="brandName"
														type="text"
														placeholder={t("reports.brandName.placeholder")}
														value={formData.brandName}
														onChange={(event) => setFormData({ ...formData, brandName: event.target.value })}
														required
														disabled={formDisabled}
													/>
												</div>
												<div className="space-y-2">
													<Label htmlFor="brandWebsite">{t("reports.brandWebsite.label")}</Label>
													<Input
														id="brandWebsite"
														type="url"
														placeholder={t("reports.brandWebsite.placeholder")}
														value={formData.brandWebsite}
														onChange={(event) => setFormData({ ...formData, brandWebsite: event.target.value })}
														required
														disabled={formDisabled}
													/>
												</div>
											</div>

											<div className="space-y-2">
												<Label htmlFor="reports-output-language">{t("reports.outputLanguage.label")}</Label>
												<select
													id="reports-output-language"
													aria-describedby="reports-output-language-help"
													value={outputLanguage}
													onChange={(event) => handleOutputLanguageChange(event.target.value)}
													disabled={formDisabled}
													className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
												>
													<option value="en">{t("reports.outputLanguage.option.en")}</option>
													<option value="zh-CN">{t("reports.outputLanguage.option.zhCn")}</option>
												</select>
												<p id="reports-output-language-help" className="text-xs text-muted-foreground">
													{t("reports.outputLanguage.helper")}
												</p>
											</div>

											<div className="space-y-2">
												<Label htmlFor="manualPrompts">
													{t("reports.manual.label")}{" "}
													<span className="text-muted-foreground font-normal">{t("reports.manual.optional")}</span>
												</Label>
												<Textarea
													id="manualPrompts"
													placeholder={t("reports.manual.placeholder")}
													value={formData.manualPrompts}
													onChange={(event) => setFormData({ ...formData, manualPrompts: event.target.value })}
													disabled={formDisabled}
													rows={6}
													className="font-mono text-sm"
												/>
												<p className="text-xs text-muted-foreground">
													{manualPromptCount > 0
														? t(manualPromptCount === 1 ? "reports.manual.one" : "reports.manual.other", {
																count: manualPromptCount,
															})
														: t("reports.manual.auto")}
												</p>
											</div>

											{submitError &&
												(submitError.message === REPORT_OUTPUT_LANGUAGE_TEMPORARILY_UNAVAILABLE ? (
													<p className="text-sm text-destructive">{t("reports.error.outputLanguageUnavailable")}</p>
												) : (
													<div className="text-sm text-destructive">
														<p>{t("reports.error.create")}</p>
														<LocalizedRawDetail
															labelId="admin.raw.errorDetails"
															detail={submitError.message || submitError.name}
															variant="destructive"
														/>
													</div>
												))}
											{success && <p className="text-sm text-green-600">{t("reports.submit.success")}</p>}

											<Button type="submit" disabled={formDisabled} className="cursor-pointer">
												{createMutation.isPending ? t("reports.submit.creating") : t("reports.submit.action")}
											</Button>
										</form>
									</div>

									<div className="space-y-4">
										<h2 className="text-2xl font-semibold">{t("reports.history.title")}</h2>

										{error && (
											<Card>
												<CardContent className="py-8 text-center">
													<p className="text-destructive">{t("reports.error.load")}</p>
													<LocalizedRawDetail
														labelId="admin.raw.errorDetails"
														detail={error instanceof Error ? error.message : String(error)}
														variant="destructive"
													/>
												</CardContent>
											</Card>
										)}

										{isLoading ? (
											<div className="flex items-center justify-center py-8">
												<div className="flex items-center space-x-2">
													<div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
													<span>{t("reports.history.loading")}</span>
												</div>
											</div>
										) : !error && reports.length === 0 ? (
											<Card>
												<CardContent className="py-8 text-center">
													<p className="text-muted-foreground">{t("reports.history.empty")}</p>
												</CardContent>
											</Card>
										) : (
											!error && (
												<div className="space-y-3">
													{reports.map(function renderReport(report) {
														const languageLabel = isContentLanguage(report.outputLanguage)
															? t(report.outputLanguage === "en" ? "reports.language.en" : "reports.language.zhCn")
															: report.outputLanguage;
														const statusLabel = REPORT_STATUS_LABELS[report.status];
														return (
															<div
																key={report.id}
																data-report-output-language={report.outputLanguage}
																className="bg-gray-50 border border-gray-200 rounded-lg p-4"
															>
																<div className="flex items-center justify-between">
																	<div className="flex-1 min-w-0">
																		<h3 className="font-semibold text-lg">
																			{report.brandName}{" "}
																			<span className="text-gray-600 font-normal">
																				({extractDomain(report.brandWebsite)})
																			</span>
																		</h3>
																		<p className="text-sm text-muted-foreground">
																			{t("reports.history.outputLanguage", { language: languageLabel })}
																		</p>
																	</div>
																	<div className="ml-4">
																		{report.status === "completed" ? (
																			<Link
																				to="/reports/render/$reportId"
																				params={{ reportId: report.id }}
																				target="_blank"
																			>
																				<Button variant="default" size="sm" className="cursor-pointer h-6 px-2 text-xs">
																					<ExternalLink className="size-3 mr-0.5" />
																					{t("reports.history.view")}
																				</Button>
																			</Link>
																		) : (
																			<Badge variant={getStatusBadgeVariant(report.status)} className="text-xs">
																				{statusLabel ? t(statusLabel) : report.status}
																			</Badge>
																		)}
																	</div>
																</div>
															</div>
														);
													})}
												</div>
											)
										)}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
