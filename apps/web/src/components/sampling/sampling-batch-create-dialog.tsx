import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { Loader2, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/i18n/provider";
import {
	captureRouteForExecution,
	minimumEvidenceArtifactsForExecutionMode,
	targetsForSamplingExecution,
} from "./sampling-execution";
import { formatZonedDateTimeInput, parseZonedDateTimeInput } from "./sampling-timezone";
import type {
	CreateSamplingBatchInput,
	SamplingContextView,
	SamplingExecutionMode,
	SamplingSearchRequirement,
	SamplingSessionRequirement,
	SamplingTargetOption,
} from "./types";

interface TargetDraft {
	samplesPerPrompt: number;
	sessionRequirement: SamplingSessionRequirement;
	searchRequirement: SamplingSearchRequirement;
}

function defaultTargetDraft(target: SamplingTargetOption, executionMode: SamplingExecutionMode): TargetDraft {
	return {
		samplesPerPrompt: 1,
		sessionRequirement:
			executionMode === "browser_runner"
				? "dedicated_sampling_profile"
				: target.defaultSessionRequirement === "new_account_clean"
					? "new_account_clean"
					: "anonymous_clean",
		searchRequirement: executionMode === "browser_runner" ? "platform_default" : target.defaultSearchRequirement,
	};
}

function newIdempotencyKey(): string {
	const suffix =
		typeof globalThis.crypto?.randomUUID === "function"
			? globalThis.crypto.randomUUID()
			: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
	return `sampling-ui:${suffix}`;
}

function defaultMeasurementWindow(timezone: string): { startsAt: string; endsAt: string } {
	const now = new Date();
	return {
		startsAt: formatZonedDateTimeInput(now, timezone),
		endsAt: formatZonedDateTimeInput(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000), timezone),
	};
}

export function SamplingBatchCreateDialog({
	context,
	onCreate,
}: {
	context: SamplingContextView;
	onCreate: (input: CreateSamplingBatchInput) => Promise<void>;
}) {
	const { t, formatDate, formatNumber } = useI18n();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [scopeId, setScopeId] = useState(
		() =>
			context.selectedBrand?.scopes.find(
				(scope) => scope.enabled && scope.manualOnly && scope.samplingEvaluationRole !== null,
			)?.id ?? "",
	);
	const [executionMode, setExecutionMode] = useState<SamplingExecutionMode>("manual");
	const [promptIds, setPromptIds] = useState<Set<string>>(new Set());
	const [targetDrafts, setTargetDrafts] = useState<Record<string, TargetDraft>>({});
	const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
	const [windowStartsAt, setWindowStartsAt] = useState(() => defaultMeasurementWindow("UTC").startsAt);
	const [windowEndsAt, setWindowEndsAt] = useState(() => defaultMeasurementWindow("UTC").endsAt);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<{ summary: string; detail?: string } | null>(null);

	const brand = context.selectedBrand;
	const brandId = brand?.id;
	const brandName = brand?.name ?? "";
	const scopes = useMemo(
		() =>
			brand?.scopes.filter((scope) => scope.enabled && scope.manualOnly && scope.samplingEvaluationRole !== null) ?? [],
		[brand],
	);
	const firstScopeId = scopes[0]?.id ?? "";
	const firstScopeTimezone = scopes[0]?.timezone ?? "UTC";
	const selectedScope = scopes.find((scope) => scope.id === scopeId);
	const availableTargets = useMemo(
		() => targetsForSamplingExecution(executionMode, context.targets),
		[context.targets, executionMode],
	);
	const prompts = useMemo(
		() => brand?.prompts.filter((prompt) => prompt.enabled && prompt.scopeId === scopeId) ?? [],
		[brand, scopeId],
	);

	useEffect(() => {
		setScopeId(firstScopeId);
		setExecutionMode("manual");
		setPromptIds(new Set());
		setTargetDrafts({});
		setIdempotencyKey(newIdempotencyKey());
		setError(null);
		setName(
			brandId
				? t("sampling.batch.create.defaultName", {
						brandName,
						date: formatDate(new Date(), { year: "numeric", month: "numeric", day: "numeric" }),
					})
				: "",
		);
		const defaults = defaultMeasurementWindow(firstScopeTimezone);
		setWindowStartsAt(defaults.startsAt);
		setWindowEndsAt(defaults.endsAt);
	}, [brandId, brandName, firstScopeId, firstScopeTimezone, formatDate, t]);

	const togglePrompt = (promptId: string) => {
		setPromptIds((previous) => {
			const next = new Set(previous);
			if (next.has(promptId)) next.delete(promptId);
			else next.add(promptId);
			return next;
		});
	};

	const toggleAllPrompts = () => {
		setPromptIds((previous) =>
			previous.size === prompts.length ? new Set() : new Set(prompts.map((prompt) => prompt.id)),
		);
	};

	const toggleTarget = (target: SamplingTargetOption) => {
		setTargetDrafts((previous) => {
			const next = { ...previous };
			if (next[target.surfaceTargetKey]) delete next[target.surfaceTargetKey];
			else next[target.surfaceTargetKey] = defaultTargetDraft(target, executionMode);
			return next;
		});
	};

	const updateTarget = (surfaceTargetKey: string, patch: Partial<TargetDraft>) => {
		setTargetDrafts((previous) => {
			const current = previous[surfaceTargetKey];
			if (!current) return previous;
			return { ...previous, [surfaceTargetKey]: { ...current, ...patch } };
		});
	};

	const handleSubmit = async () => {
		if (!brand || !scopeId) return;
		const evaluationRole = selectedScope?.samplingEvaluationRole;
		const programTimezone = selectedScope?.timezone;
		if (!evaluationRole || !programTimezone) {
			setError({ summary: t("sampling.batch.validation.scope") });
			return;
		}
		if (!name.trim()) {
			setError({ summary: t("sampling.batch.validation.name") });
			return;
		}
		if (promptIds.size === 0) {
			setError({ summary: t("sampling.batch.validation.prompt") });
			return;
		}
		if (executionMode === "browser_runner" && context.browserRunnerEnabled !== true) {
			setError({ summary: t("sampling.batch.validation.runner") });
			return;
		}
		const selectedTargets = availableTargets.filter((target) => targetDrafts[target.surfaceTargetKey]);
		if (selectedTargets.length === 0) {
			setError({ summary: t("sampling.batch.validation.surface") });
			return;
		}
		const resolvedTargets = selectedTargets.map((target) => {
			const draft = targetDrafts[target.surfaceTargetKey];
			if (!draft) {
				throw new Error(t("sampling.batch.validation.targetGone", { targetKey: target.surfaceTargetKey }));
			}
			return { target, draft, captureRouteKey: captureRouteForExecution(executionMode, target) };
		});
		let startsAt: Date;
		let endsAt: Date;
		try {
			startsAt = parseZonedDateTimeInput(windowStartsAt, programTimezone);
			endsAt = parseZonedDateTimeInput(windowEndsAt, programTimezone);
		} catch (caught) {
			setError({
				summary: t("sampling.batch.validation.window"),
				detail: caught instanceof Error ? caught.message : undefined,
			});
			return;
		}
		if (endsAt <= startsAt) {
			setError({ summary: t("sampling.batch.validation.windowOrder") });
			return;
		}

		setSubmitting(true);
		setError(null);
		try {
			await onCreate({
				brandId: brand.id,
				scopeId,
				executionMode,
				idempotencyKey,
				name: name.trim(),
				promptIds: [...promptIds],
				targets: resolvedTargets.map(({ target, draft, captureRouteKey }) => {
					return {
						surfaceTargetKey: target.surfaceTargetKey,
						captureRouteKey,
						evaluationRole,
						...draft,
					};
				}),
				protocol: {
					measurementWindow: { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() },
					evidence: {
						minimumArtifacts: minimumEvidenceArtifactsForExecutionMode(
							executionMode,
							resolvedTargets.map(({ captureRouteKey }) => captureRouteKey),
						),
						requireSha256: true,
						requirePageUrl: true,
						allowedUriSchemes: ["https", "http"],
					},
				},
			});
			setOpen(false);
			setIdempotencyKey(newIdempotencyKey());
		} catch (caught) {
			setError({
				summary: t("sampling.batch.error.create"),
				detail: caught instanceof Error ? caught.message : undefined,
			});
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button disabled={!brand || scopes.length === 0}>
					<Plus />
					{t("sampling.batch.create.action")}
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>{t("sampling.batch.create.title")}</DialogTitle>
					<DialogDescription>{t("sampling.batch.create.description")}</DialogDescription>
				</DialogHeader>

				<div className="space-y-6">
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="sampling-batch-name">{t("sampling.batch.create.name")}</Label>
							<Input
								id="sampling-batch-name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								disabled={submitting}
							/>
						</div>
						<div className="space-y-2">
							<Label>{t("sampling.batch.create.scope")}</Label>
							<Select
								value={scopeId}
								onValueChange={(nextScopeId) => {
									setScopeId(nextScopeId);
									setPromptIds(new Set());
									const nextScope = scopes.find((scope) => scope.id === nextScopeId);
									if (nextScope) {
										const defaults = defaultMeasurementWindow(nextScope.timezone);
										setWindowStartsAt(defaults.startsAt);
										setWindowEndsAt(defaults.endsAt);
									}
								}}
								disabled={submitting}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder={t("sampling.batch.create.selectScope")} />
								</SelectTrigger>
								<SelectContent>
									{scopes.map((scope) => (
										<SelectItem key={scope.id} value={scope.id}>
											{scope.name} · {scope.market}/{scope.locale} · {scope.timezone}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2 sm:col-span-2">
							<Label>{t("sampling.batch.create.evaluationPool")}</Label>
							<Input
								value={
									selectedScope?.samplingEvaluationRole === "scored"
										? t("sampling.evaluation.scored")
										: t("sampling.evaluation.observation")
								}
								readOnly
								className="w-full sm:w-72"
							/>
							<p className="text-xs text-muted-foreground">{t("sampling.batch.create.poolDescription")}</p>
						</div>
						<div className="space-y-2 sm:col-span-2">
							<Label>{t("sampling.batch.create.execution")}</Label>
							<Select
								value={executionMode}
								onValueChange={(value: SamplingExecutionMode) => {
									setExecutionMode(value);
									setTargetDrafts({});
								}}
								disabled={submitting}
							>
								<SelectTrigger className="w-full sm:w-72">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="manual">{t("sampling.execution.manual")}</SelectItem>
									<SelectItem value="browser_runner" disabled={context.browserRunnerEnabled !== true}>
										{t("sampling.execution.browserRunner")}
									</SelectItem>
								</SelectContent>
							</Select>
							<p className="text-xs text-muted-foreground">{t("sampling.batch.create.executionDescription")}</p>
						</div>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="sampling-window-start">
								{t("sampling.batch.create.windowStart", {
									timezone: selectedScope?.timezone ?? t("sampling.batch.create.programTimezone"),
								})}
							</Label>
							<Input
								id="sampling-window-start"
								type="datetime-local"
								value={windowStartsAt}
								onChange={(event) => setWindowStartsAt(event.target.value)}
								disabled={submitting}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="sampling-window-end">
								{t("sampling.batch.create.windowEnd", {
									timezone: selectedScope?.timezone ?? t("sampling.batch.create.programTimezone"),
								})}
							</Label>
							<Input
								id="sampling-window-end"
								type="datetime-local"
								value={windowEndsAt}
								onChange={(event) => setWindowEndsAt(event.target.value)}
								disabled={submitting}
							/>
						</div>
						<p className="text-xs text-muted-foreground sm:col-span-2">
							{t("sampling.batch.create.windowDescription")}
						</p>
					</div>

					<div className="space-y-2">
						<div className="flex items-center justify-between gap-3">
							<Label>{t("sampling.batch.create.promptsSelected", { count: formatNumber(promptIds.size) })}</Label>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={toggleAllPrompts}
								disabled={prompts.length === 0}
							>
								{t(
									promptIds.size === prompts.length && prompts.length > 0
										? "sampling.batch.create.clearAll"
										: "sampling.batch.create.selectAll",
								)}
							</Button>
						</div>
						<div className="max-h-52 space-y-1 overflow-y-auto rounded-md border p-2">
							{prompts.length === 0 ? (
								<p className="p-3 text-sm text-muted-foreground">{t("sampling.batch.create.noPrompts")}</p>
							) : (
								prompts.map((prompt) => {
									const checkboxId = `sampling-prompt-${prompt.id}`;
									return (
										<div key={prompt.id} className="flex items-start gap-2 rounded px-2 py-2 hover:bg-muted/60">
											<Checkbox
												id={checkboxId}
												checked={promptIds.has(prompt.id)}
												onCheckedChange={() => togglePrompt(prompt.id)}
											/>
											<Label htmlFor={checkboxId} className="min-w-0 cursor-pointer text-sm leading-snug font-normal">
												{prompt.value}
											</Label>
										</div>
									);
								})
							)}
						</div>
					</div>

					<div className="space-y-3">
						<Label>
							{t("sampling.batch.create.surfacesSelected", {
								count: formatNumber(Object.keys(targetDrafts).length),
							})}
						</Label>
						<div className="grid gap-2 sm:grid-cols-2">
							{availableTargets.map((target) => {
								const checkboxId = `sampling-target-${target.surfaceTargetKey}`;
								return (
									<div
										key={target.surfaceTargetKey}
										className="flex items-start gap-2 rounded-md border p-3 hover:bg-muted/40"
									>
										<Checkbox
											id={checkboxId}
											checked={Boolean(targetDrafts[target.surfaceTargetKey])}
											onCheckedChange={() => toggleTarget(target)}
										/>
										<Label htmlFor={checkboxId} className="min-w-0 cursor-pointer font-normal">
											<span className="block text-sm font-medium">{target.label}</span>
											<span className="block truncate text-xs text-muted-foreground">{target.surfaceTargetKey}</span>
										</Label>
									</div>
								);
							})}
						</div>

						{availableTargets
							.filter((target) => targetDrafts[target.surfaceTargetKey])
							.map((target) => {
								const draft = targetDrafts[target.surfaceTargetKey];
								if (!draft) return null;
								return (
									<div
										key={target.surfaceTargetKey}
										className="grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-3"
									>
										<div className="sm:col-span-3">
											<p className="text-sm font-medium">{target.label}</p>
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs">{t("sampling.batch.create.samplesPerPrompt")}</Label>
											<Input
												type="number"
												min={1}
												max={20}
												value={draft.samplesPerPrompt}
												onChange={(event) =>
													updateTarget(target.surfaceTargetKey, {
														samplesPerPrompt: Math.max(1, Math.min(20, Number(event.target.value) || 1)),
													})
												}
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs">{t("sampling.batch.create.session")}</Label>
											<Select
												value={draft.sessionRequirement}
												onValueChange={(value: SamplingSessionRequirement) =>
													updateTarget(target.surfaceTargetKey, { sessionRequirement: value })
												}
												disabled={executionMode === "browser_runner"}
											>
												<SelectTrigger className="w-full">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{executionMode === "browser_runner" ? (
														<SelectItem value="dedicated_sampling_profile">
															{t("sampling.session.dedicatedProfile")}
														</SelectItem>
													) : (
														<>
															<SelectItem value="anonymous_clean">{t("sampling.session.anonymousClean")}</SelectItem>
															<SelectItem value="new_account_clean">{t("sampling.session.newAccountClean")}</SelectItem>
														</>
													)}
												</SelectContent>
											</Select>
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs">{t("sampling.batch.create.search")}</Label>
											<Select
												value={draft.searchRequirement}
												onValueChange={(value: SamplingSearchRequirement) =>
													updateTarget(target.surfaceTargetKey, { searchRequirement: value })
												}
												disabled={target.surfaceKind === "search_surface" || executionMode === "browser_runner"}
											>
												<SelectTrigger className="w-full">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													{executionMode === "browser_runner" && (
														<SelectItem value="platform_default">{t("sampling.search.platformDefault")}</SelectItem>
													)}
													{executionMode !== "browser_runner" && (
														<SelectItem value="required">{t("sampling.search.required")}</SelectItem>
													)}
													{executionMode !== "browser_runner" && target.surfaceKind !== "search_surface" && (
														<>
															<SelectItem value="forbidden">{t("sampling.search.forbidden")}</SelectItem>
															<SelectItem value="not_applicable">{t("sampling.search.notApplicable")}</SelectItem>
														</>
													)}
												</SelectContent>
											</Select>
										</div>
									</div>
								);
							})}
					</div>

					{error && (
						<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
							<p>{error.summary}</p>
							{error.detail && (
								<>
									<p className="mt-2 font-medium">{t("sampling.raw.errorDetails")}</p>
									<pre className="whitespace-pre-wrap">{error.detail}</pre>
								</>
							)}
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
						{t("sampling.batch.create.cancel")}
					</Button>
					<Button onClick={handleSubmit} disabled={submitting || !brand}>
						{submitting && <Loader2 className="animate-spin" />}
						{submitting ? t("sampling.batch.create.submitting") : t("sampling.batch.create.submit")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
