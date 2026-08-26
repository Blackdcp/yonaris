import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
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
import { Progress } from "@workspace/ui/components/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { Separator } from "@workspace/ui/components/separator";
import { Textarea } from "@workspace/ui/components/textarea";
import {
	AlertTriangle,
	Check,
	Clipboard,
	Download,
	ExternalLink,
	FileUp,
	Loader2,
	RefreshCw,
	RotateCcw,
	Send,
	Trash2,
	X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LocalizedMessage, MessageId } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import {
	deleteSamplingEvidence,
	formatEvidenceBytes,
	MAX_SAMPLING_EVIDENCE_ARTIFACTS,
	MAX_SAMPLING_EVIDENCE_TASK_BYTES,
	SAMPLING_EVIDENCE_ACCEPT,
	type SamplingEvidenceSubmitBlocker,
	type SamplingEvidenceTransferState,
	type SamplingEvidenceValidationCode,
	type SamplingEvidenceValidationResult,
	samplingEvidenceSubmitBlocker,
	uploadSamplingEvidence,
	validateSamplingEvidenceFile,
} from "./sampling-evidence";
import { SamplingStatusBadge } from "./sampling-status-badge";
import { formatZonedDateTimeInput, parseZonedDateTimeInput } from "./sampling-timezone";
import type {
	SamplingEvaluationRole,
	SamplingEvidenceArtifactView,
	SamplingEvidenceKind,
	SamplingLease,
	SamplingObservationInput,
	SamplingSearchRequirement,
	SamplingSessionRequirement,
	SamplingTaskView,
} from "./types";

interface EvidenceDraft {
	clientId: string;
	state: SamplingEvidenceTransferState;
	kind: SamplingEvidenceKind;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	progress: number;
	file?: File;
	artifact?: SamplingEvidenceArtifactView;
	error?: string;
	failureSummary?: "upload_failed" | "unusable";
}

function lines(value: string): string[] {
	return [
		...new Set(
			value
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter(Boolean),
		),
	];
}

const SESSION_LABELS: Record<SamplingSessionRequirement, MessageId> = {
	anonymous_clean: "sampling.session.anonymousClean",
	new_account_clean: "sampling.session.newAccountClean",
	dedicated_sampling_profile: "sampling.session.dedicatedProfile",
};

const SEARCH_LABELS: Record<SamplingSearchRequirement, MessageId> = {
	platform_default: "sampling.search.platformDefault",
	required: "sampling.search.required",
	forbidden: "sampling.search.forbidden",
	not_applicable: "sampling.search.notApplicable",
};

const EVALUATION_LABELS: Record<SamplingEvaluationRole, MessageId> = {
	scored: "sampling.evaluation.scored",
	observation: "sampling.evaluation.observation",
};

type SamplingEvidenceValidationFailure = Extract<SamplingEvidenceValidationResult, { ok: false }>;

interface EvidenceValidationIssue {
	clientId: string;
	fileName: string;
	issue: SamplingEvidenceValidationFailure | string;
}

type WorkbenchError = LocalizedMessage & { validationIssues?: EvidenceValidationIssue[] };

const EVIDENCE_VALIDATION_MESSAGES = {
	unsupported_type: "sampling.workbench.evidence.validation.type",
	invalid_filename: "sampling.workbench.evidence.validation.name",
	empty_file: "sampling.workbench.evidence.validation.empty",
	file_too_large: "sampling.workbench.evidence.validation.fileSize",
	too_many_files: "sampling.workbench.evidence.validation.count",
	task_total_too_large: "sampling.workbench.evidence.validation.totalSize",
} as const satisfies Record<SamplingEvidenceValidationCode, MessageId>;

const EVIDENCE_BLOCKER_MESSAGES = {
	recovering: "sampling.workbench.evidence.blocker.recovering",
	recovery_error: "sampling.workbench.evidence.blocker.recoveryError",
	pending: "sampling.workbench.evidence.blocker.pending",
	failed: "sampling.workbench.evidence.blocker.failed",
	minimum: "sampling.workbench.evidence.blocker.minimum",
} as const satisfies Record<SamplingEvidenceSubmitBlocker["code"], MessageId>;

function validationCode(value: unknown): SamplingEvidenceValidationCode | null {
	if (!value || typeof value !== "object" || !("ok" in value) || value.ok !== false || !("code" in value)) return null;
	const code = value.code;
	return typeof code === "string" && Object.hasOwn(EVIDENCE_VALIDATION_MESSAGES, code)
		? (code as SamplingEvidenceValidationCode)
		: null;
}

function blockerCode(value: unknown): SamplingEvidenceSubmitBlocker["code"] | null {
	if (!value || typeof value !== "object" || !("code" in value)) return null;
	const code = value.code;
	return typeof code === "string" && Object.hasOwn(EVIDENCE_BLOCKER_MESSAGES, code)
		? (code as SamplingEvidenceSubmitBlocker["code"])
		: null;
}

export function samplingEvidenceIssuePresentation(
	issue: unknown,
	category: "validation" | "blocker" = "validation",
): LocalizedMessage {
	const validation = validationCode(issue);
	if (validation) {
		return validation === "too_many_files"
			? { id: EVIDENCE_VALIDATION_MESSAGES[validation], values: { count: MAX_SAMPLING_EVIDENCE_ARTIFACTS } }
			: { id: EVIDENCE_VALIDATION_MESSAGES[validation] };
	}
	const blocker = blockerCode(issue);
	if (blocker) {
		if (blocker === "minimum") {
			const minimumArtifacts = (issue as Partial<Extract<SamplingEvidenceSubmitBlocker, { code: "minimum" }>>)
				.minimumArtifacts;
			if (typeof minimumArtifacts !== "number") {
				return { id: "sampling.workbench.evidence.blocker.unknown" };
			}
			return { id: EVIDENCE_BLOCKER_MESSAGES[blocker], values: { count: minimumArtifacts } };
		}
		return { id: EVIDENCE_BLOCKER_MESSAGES[blocker] };
	}
	return {
		id:
			category === "blocker"
				? "sampling.workbench.evidence.blocker.unknown"
				: "sampling.workbench.evidence.validation.unknown",
		...(typeof issue === "string" ? { detail: issue } : {}),
	};
}

export function SamplingTaskWorkbench({
	task,
	lease,
	heartbeatError,
	initialEvidenceArtifacts,
	evidenceArtifactsLoading,
	evidenceArtifactsError,
	onRelease,
	onSubmit,
	onFail,
}: {
	task: SamplingTaskView;
	lease: SamplingLease;
	heartbeatError: string | true | null;
	initialEvidenceArtifacts: SamplingEvidenceArtifactView[];
	evidenceArtifactsLoading: boolean;
	evidenceArtifactsError: string | true | null;
	onRelease: () => Promise<void>;
	onSubmit: (observation: SamplingObservationInput) => Promise<void>;
	onFail: (input: { errorCode?: string; errorMessage: string }) => Promise<void>;
}) {
	const { t, formatDate, formatNumber } = useI18n();
	const evidenceMinimum = Math.max(0, task.minimumEvidenceArtifacts);
	const [answerText, setAnswerText] = useState("");
	const [pageUrl, setPageUrl] = useState("");
	const [observedAt, setObservedAt] = useState(() => formatZonedDateTimeInput(new Date(), task.timezone));
	const [modelVersion, setModelVersion] = useState("");
	const [citationUrls, setCitationUrls] = useState("");
	const [webQueries, setWebQueries] = useState("");
	const [webSearchObserved, setWebSearchObserved] = useState<"unknown" | "yes" | "no">("unknown");
	const [operatorAttested, setOperatorAttested] = useState(false);
	const [evidence, setEvidence] = useState<EvidenceDraft[]>([]);
	const [copied, setCopied] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [releasing, setReleasing] = useState(false);
	const [error, setError] = useState<WorkbenchError | null>(null);
	const [failureOpen, setFailureOpen] = useState(false);
	const [failureMessage, setFailureMessage] = useState("");
	const [failureCode, setFailureCode] = useState("");
	const [reportingFailure, setReportingFailure] = useState(false);
	const uploadAborters = useRef(new Map<string, () => void>());

	const sessionMode = task.sessionRequirement;
	const searchMode =
		task.searchRequirement === "required"
			? "on"
			: task.searchRequirement === "platform_default"
				? "native_auto"
				: "off";
	const isHumanTakeover = task.automation?.humanHandoffRequired === true;
	const requiresSameSessionRecovery = Boolean(isHumanTakeover && task.automation?.submitIntentAt);
	const submitMayHaveOccurred = Boolean(task.automation?.submitIntentAt && !task.automation.submitConfirmedAt);
	const leaseExpiry = useMemo(
		() =>
			lease.leaseExpiresAt
				? formatDate(new Date(lease.leaseExpiresAt), { timeStyle: "medium" })
				: t("sampling.workbench.recoveringLease"),
		[formatDate, lease.leaseExpiresAt, t],
	);
	const evidenceTotalBytes = useMemo(() => evidence.reduce((total, item) => total + item.sizeBytes, 0), [evidence]);
	const evidenceBlocker = useMemo(
		() =>
			samplingEvidenceSubmitBlocker({
				states: evidence,
				minimumArtifacts: evidenceMinimum,
				recovering: evidenceArtifactsLoading,
				recoveryError: evidenceArtifactsError,
			}),
		[evidence, evidenceArtifactsError, evidenceArtifactsLoading, evidenceMinimum],
	);
	const evidenceOperationPending = evidence.some(({ state }) => state === "uploading" || state === "deleting");

	useEffect(() => {
		setEvidence((previous) => {
			const knownIds = new Set(previous.flatMap(({ artifact }) => (artifact ? [artifact.id] : [])));
			const recovered = initialEvidenceArtifacts
				.filter((artifact) => !knownIds.has(artifact.id))
				.map<EvidenceDraft>((artifact) => ({
					clientId: `artifact-${artifact.id}`,
					state: artifact.status === "staged" ? "ready" : "failed",
					kind: artifact.kind,
					fileName: artifact.fileName,
					mimeType: artifact.mimeType,
					sizeBytes: artifact.sizeBytes,
					progress: 100,
					artifact,
					failureSummary: artifact.status === "staged" ? undefined : "unusable",
				}));
			return recovered.length ? [...previous, ...recovered] : previous;
		});
	}, [initialEvidenceArtifacts]);

	useEffect(
		() => () => {
			for (const abort of uploadAborters.current.values()) abort();
			uploadAborters.current.clear();
		},
		[],
	);

	const copyPrompt = async () => {
		try {
			await navigator.clipboard.writeText(task.promptText);
			setCopied(true);
			setTimeout(() => setCopied(false), 1_500);
		} catch {
			setError({ id: "sampling.workbench.error.clipboard" });
		}
	};

	const patchEvidence = (clientId: string, patch: Partial<EvidenceDraft>) => {
		setEvidence((previous) => previous.map((item) => (item.clientId === clientId ? { ...item, ...patch } : item)));
	};

	const startEvidenceUpload = (draft: EvidenceDraft) => {
		if (!draft.file) return;
		setError(null);
		patchEvidence(draft.clientId, { state: "uploading", progress: 0, error: undefined, failureSummary: undefined });
		const upload = uploadSamplingEvidence({
			file: draft.file,
			kind: draft.kind,
			task,
			lease,
			onProgress: (progress) => patchEvidence(draft.clientId, { progress }),
		});
		uploadAborters.current.set(draft.clientId, upload.abort);
		void upload.promise
			.then((artifact) => {
				setEvidence((previous) => {
					if (previous.some((item) => item.clientId !== draft.clientId && item.artifact?.id === artifact.id)) {
						return previous.filter(({ clientId }) => clientId !== draft.clientId);
					}
					return previous.map((item) =>
						item.clientId === draft.clientId
							? {
									...item,
									state: "ready",
									kind: artifact.kind,
									fileName: artifact.fileName,
									mimeType: artifact.mimeType,
									sizeBytes: artifact.sizeBytes,
									progress: 100,
									file: undefined,
									artifact,
									error: undefined,
									failureSummary: undefined,
								}
							: item,
					);
				});
			})
			.catch((caught) => {
				if (caught instanceof Error && caught.name === "AbortError") return;
				patchEvidence(draft.clientId, {
					state: "failed",
					progress: 0,
					error: caught instanceof Error ? caught.message : undefined,
					failureSummary: "upload_failed",
				});
			})
			.finally(() => uploadAborters.current.delete(draft.clientId));
	};

	const chooseEvidence = (files: FileList | null) => {
		if (!files?.length) return;
		let artifactCount = evidence.length;
		let totalBytes = evidenceTotalBytes;
		const accepted: EvidenceDraft[] = [];
		const rejected: EvidenceValidationIssue[] = [];
		for (const file of Array.from(files)) {
			const result = validateSamplingEvidenceFile(file, { artifactCount, totalBytes });
			if (!result.ok) {
				rejected.push({
					clientId: `evidence-rejection-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
					fileName: file.name,
					issue: result,
				});
				continue;
			}
			const draft: EvidenceDraft = {
				clientId: `evidence-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
				state: "uploading",
				kind: result.kind,
				fileName: file.name,
				mimeType: file.type || "application/octet-stream",
				sizeBytes: file.size,
				progress: 0,
				file,
			};
			accepted.push(draft);
			artifactCount += 1;
			totalBytes += file.size;
		}
		if (accepted.length) {
			setEvidence((previous) => [...previous, ...accepted]);
			for (const draft of accepted) startEvidenceUpload(draft);
		}
		if (rejected.length) {
			setError({ id: "sampling.workbench.evidence.validation.files", validationIssues: rejected });
		}
	};

	const removeEvidence = async (item: EvidenceDraft) => {
		if (item.state === "uploading") {
			uploadAborters.current.get(item.clientId)?.();
			uploadAborters.current.delete(item.clientId);
			setEvidence((previous) => previous.filter(({ clientId }) => clientId !== item.clientId));
			return;
		}
		if (item.state === "failed" || !item.artifact) {
			setEvidence((previous) => previous.filter(({ clientId }) => clientId !== item.clientId));
			return;
		}
		setError(null);
		patchEvidence(item.clientId, { state: "deleting", error: undefined });
		try {
			await deleteSamplingEvidence({
				artifactId: item.artifact.id,
				brandId: task.brandId,
				taskId: task.id,
				leaseToken: lease.leaseToken,
				leaseGeneration: lease.leaseGeneration,
			});
			setEvidence((previous) => previous.filter(({ clientId }) => clientId !== item.clientId));
		} catch (caught) {
			const message = caught instanceof Error ? caught.message : undefined;
			patchEvidence(item.clientId, { state: "ready", error: message });
			setError({ id: "sampling.workbench.error.delete", detail: message });
		}
	};

	const handleSubmit = async () => {
		setError(null);
		if (requiresSameSessionRecovery) {
			setError({ id: "sampling.workbench.validation.sameSession" });
			return;
		}
		if (!answerText.trim()) {
			setError({ id: "sampling.workbench.validation.answer" });
			return;
		}
		if (!operatorAttested) {
			setError({ id: "sampling.workbench.validation.attestation" });
			return;
		}
		let observedDate: Date;
		try {
			observedDate = parseZonedDateTimeInput(observedAt, task.timezone);
		} catch (caught) {
			setError({
				id: "sampling.workbench.validation.observedAt",
				detail: caught instanceof Error ? caught.message : undefined,
			});
			return;
		}
		const windowStartsAt = new Date(task.measurementWindowStartsAt);
		const windowEndsAt = new Date(task.measurementWindowEndsAt);
		if (observedDate < windowStartsAt || observedDate > windowEndsAt) {
			setError({ id: "sampling.workbench.validation.window" });
			return;
		}
		if (task.requirePageUrl && !pageUrl.trim()) {
			setError({ id: "sampling.workbench.validation.pageUrl" });
			return;
		}
		if (evidenceBlocker) {
			setError(samplingEvidenceIssuePresentation(evidenceBlocker, "blocker"));
			return;
		}
		const evidenceArtifactIds = evidence.flatMap(({ artifact, state }) =>
			state === "ready" && artifact ? [artifact.id] : [],
		);

		setSubmitting(true);
		try {
			await onSubmit({
				answerText: answerText.trim(),
				observedAt: observedDate.toISOString(),
				pageUrl: pageUrl.trim(),
				sessionMode,
				searchMode,
				webSearchObserved:
					task.searchRequirement === "platform_default"
						? webSearchObserved === "yes"
							? true
							: webSearchObserved === "no"
								? false
								: null
						: searchMode === "on",
				operatorAttested: true,
				...(modelVersion.trim() ? { modelVersion: modelVersion.trim() } : {}),
				evidenceArtifactIds,
				citations: lines(citationUrls).map((url) => ({ url })),
				webQueries: lines(webQueries),
			});
		} catch (caught) {
			setError({
				id: "sampling.workbench.error.submit",
				detail: caught instanceof Error ? caught.message : undefined,
			});
		} finally {
			setSubmitting(false);
		}
	};

	const handleRelease = async () => {
		if (requiresSameSessionRecovery) {
			setError({ id: "sampling.workbench.validation.postSubmitRelease" });
			return;
		}
		setReleasing(true);
		setError(null);
		try {
			await onRelease();
		} catch (caught) {
			setError({
				id: "sampling.workbench.error.release",
				detail: caught instanceof Error ? caught.message : undefined,
			});
		} finally {
			setReleasing(false);
		}
	};

	const handleFailure = async () => {
		if (!failureMessage.trim()) return;
		setReportingFailure(true);
		try {
			await onFail({
				...(failureCode.trim() ? { errorCode: failureCode.trim() } : {}),
				errorMessage: failureMessage.trim(),
			});
			setFailureOpen(false);
		} catch (caught) {
			setError({
				id: "sampling.workbench.error.failure",
				detail: caught instanceof Error ? caught.message : undefined,
			});
		} finally {
			setReportingFailure(false);
		}
	};

	return (
		<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
			<div className="space-y-6">
				{isHumanTakeover && (
					<Alert>
						<AlertTriangle />
						<AlertTitle>{t("sampling.workbench.takeover.title")}</AlertTitle>
						<AlertDescription className="space-y-2">
							<p>{t("sampling.workbench.takeover.description")}</p>
							{task.automation?.needsHumanReason && (
								<div>
									<p>{t("sampling.workbench.takeover.reason")}</p>
									<p className="font-medium">{t("sampling.raw.executionDetails")}</p>
									{task.automation.needsHumanCode && (
										<code className="block break-all">{task.automation.needsHumanCode}</code>
									)}
									<pre className="whitespace-pre-wrap">{task.automation.needsHumanReason}</pre>
								</div>
							)}
							{submitMayHaveOccurred && <p>{t("sampling.workbench.takeover.submitMayHaveOccurred")}</p>}
						</AlertDescription>
					</Alert>
				)}
				<Card>
					<CardHeader>
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<CardTitle>{task.targetLabel}</CardTitle>
								<CardDescription>
									{t("sampling.workbench.sample", {
										brandName: task.brandName,
										scopeName: task.scopeName,
										index: formatNumber(task.sampleIndex),
									})}
								</CardDescription>
							</div>
							<div className="flex flex-wrap gap-2">
								<SamplingStatusBadge status={task.status} />
								{isHumanTakeover && (
									<Badge className="bg-amber-100 text-amber-800">{t("sampling.workbench.needsHuman")}</Badge>
								)}
							</div>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
							<div>
								<p className="text-xs text-muted-foreground">{t("sampling.workbench.requiredSession")}</p>
								<Badge variant="outline" className="mt-1">
									{t(SESSION_LABELS[task.sessionRequirement])}
								</Badge>
							</div>
							<div className="sm:col-span-2">
								<p className="text-xs text-muted-foreground">{t("sampling.workbench.frozenWindow")}</p>
								<p className="mt-1 text-sm">
									{formatDate(new Date(task.measurementWindowStartsAt), {
										timeZone: task.timezone,
										timeZoneName: "short",
									})}{" "}
									–{" "}
									{formatDate(new Date(task.measurementWindowEndsAt), {
										timeZone: task.timezone,
										timeZoneName: "short",
									})}
								</p>
							</div>
							<div>
								<p className="text-xs text-muted-foreground">{t("sampling.workbench.requiredSearch")}</p>
								<Badge variant="outline" className="mt-1">
									{t(SEARCH_LABELS[task.searchRequirement])}
								</Badge>
							</div>
						</div>
						<div className="rounded-md border bg-muted/30 p-4">
							<div className="mb-3 flex items-center justify-between gap-3">
								<Label>{t("sampling.workbench.frozenPrompt")}</Label>
								{!requiresSameSessionRecovery && (
									<Button variant="outline" size="sm" onClick={copyPrompt}>
										{copied ? <Check /> : <Clipboard />}
										{t(copied ? "sampling.workbench.copied" : "sampling.workbench.copy")}
									</Button>
								)}
							</div>
							<p className="select-text whitespace-pre-wrap text-sm leading-relaxed">{task.promptText}</p>
						</div>
						{requiresSameSessionRecovery ? (
							<Alert variant="destructive">
								<AlertTriangle />
								<AlertTitle>{t("sampling.workbench.noReplay.title")}</AlertTitle>
								<AlertDescription>{t("sampling.workbench.noReplay.description")}</AlertDescription>
							</Alert>
						) : (
							<Button asChild className="w-full sm:w-auto">
								<a href={task.launchUrl} target="_blank" rel="noopener noreferrer">
									<ExternalLink />
									{t("sampling.workbench.openTarget", { targetLabel: task.targetLabel })}
								</a>
							</Button>
						)}
						{!requiresSameSessionRecovery && (
							<Alert>
								<AlertTriangle />
								<AlertTitle>{t("sampling.workbench.attestation.title")}</AlertTitle>
								<AlertDescription className="space-y-3">
									<p>{t("sampling.workbench.attestation.description")}</p>
									<div className="flex items-start gap-2">
										<Checkbox
											id="sampling-operator-attestation"
											checked={operatorAttested}
											onCheckedChange={(checked) => setOperatorAttested(checked === true)}
										/>
										<Label
											htmlFor="sampling-operator-attestation"
											className="cursor-pointer leading-relaxed font-normal"
										>
											{t("sampling.workbench.attestation.confirm", {
												targetLabel: task.targetLabel,
												market: task.market,
												locale: task.locale,
											})}
										</Label>
									</div>
								</AlertDescription>
							</Alert>
						)}
					</CardContent>
				</Card>

				{!requiresSameSessionRecovery && (
					<>
						<Card>
							<CardHeader>
								<CardTitle>{t("sampling.workbench.observation.title")}</CardTitle>
								<CardDescription>{t("sampling.workbench.observation.description")}</CardDescription>
							</CardHeader>
							<CardContent className="space-y-5">
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="space-y-2 sm:col-span-2">
										<Label htmlFor="sampling-page-url">{t("sampling.workbench.pageUrl")}</Label>
										<Input
											id="sampling-page-url"
											type="url"
											value={pageUrl}
											onChange={(event) => setPageUrl(event.target.value)}
											placeholder="https://..."
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="sampling-observed-at">
											{t("sampling.workbench.observedAt", { timezone: task.timezone })}
										</Label>
										<Input
											id="sampling-observed-at"
											type="datetime-local"
											value={observedAt}
											onChange={(event) => setObservedAt(event.target.value)}
											min={formatZonedDateTimeInput(new Date(task.measurementWindowStartsAt), task.timezone)}
											max={formatZonedDateTimeInput(new Date(task.measurementWindowEndsAt), task.timezone)}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="sampling-model-version">{t("sampling.workbench.modelVersion")}</Label>
										<Input
											id="sampling-model-version"
											value={modelVersion}
											onChange={(event) => setModelVersion(event.target.value)}
											placeholder={t("sampling.workbench.optional")}
										/>
									</div>
									{task.searchRequirement === "platform_default" && (
										<div className="space-y-2">
											<Label>{t("sampling.workbench.webSearch")}</Label>
											<Select
												value={webSearchObserved}
												onValueChange={(value: "unknown" | "yes" | "no") => setWebSearchObserved(value)}
											>
												<SelectTrigger className="w-full">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="unknown">{t("sampling.workbench.webSearch.unknown")}</SelectItem>
													<SelectItem value="yes">{t("sampling.workbench.webSearch.yes")}</SelectItem>
													<SelectItem value="no">{t("sampling.workbench.webSearch.no")}</SelectItem>
												</SelectContent>
											</Select>
										</div>
									)}
								</div>

								<div className="space-y-2">
									<div className="flex items-center justify-between gap-2">
										<Label htmlFor="sampling-answer">{t("sampling.workbench.answer")}</Label>
										<span className="text-xs tabular-nums text-muted-foreground">
											{t("sampling.workbench.characters", { count: formatNumber(answerText.length) })}
										</span>
									</div>
									<Textarea
										id="sampling-answer"
										value={answerText}
										onChange={(event) => setAnswerText(event.target.value)}
										placeholder={t("sampling.workbench.answerPlaceholder")}
										className="min-h-72 font-mono text-sm"
									/>
								</div>

								<div className="grid gap-4 lg:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="sampling-citations">{t("sampling.workbench.citations")}</Label>
										<Textarea
											id="sampling-citations"
											value={citationUrls}
											onChange={(event) => setCitationUrls(event.target.value)}
											placeholder={t("sampling.workbench.citationsPlaceholder")}
											className="min-h-28"
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="sampling-web-queries">{t("sampling.workbench.webQueries")}</Label>
										<Textarea
											id="sampling-web-queries"
											value={webQueries}
											onChange={(event) => setWebQueries(event.target.value)}
											placeholder={t("sampling.workbench.webQueriesPlaceholder")}
											className="min-h-28"
										/>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>{t("sampling.workbench.evidence.title")}</CardTitle>
								<CardDescription>
									{t("sampling.workbench.evidence.description", { count: formatNumber(evidenceMinimum) })}
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<Alert>
									<FileUp />
									<AlertTitle>{t("sampling.workbench.evidence.policyTitle")}</AlertTitle>
									<AlertDescription>{t("sampling.workbench.evidence.policyDescription")}</AlertDescription>
								</Alert>
								<div className="flex flex-col gap-3 rounded-md border border-dashed p-4 sm:flex-row sm:items-end sm:justify-between">
									<div className="space-y-1.5">
										<Label htmlFor="sampling-evidence-files">{t("sampling.workbench.evidence.upload")}</Label>
										<p className="text-xs text-muted-foreground">
											{t("sampling.workbench.evidence.files", {
												count: formatNumber(evidence.length),
												maximum: formatNumber(MAX_SAMPLING_EVIDENCE_ARTIFACTS),
												used: formatEvidenceBytes(evidenceTotalBytes),
												maximumSize: formatEvidenceBytes(MAX_SAMPLING_EVIDENCE_TASK_BYTES),
											})}
										</p>
									</div>
									<Input
										id="sampling-evidence-files"
										data-testid="sampling-evidence-file-input"
										type="file"
										multiple
										accept={SAMPLING_EVIDENCE_ACCEPT}
										aria-label={t("sampling.workbench.evidence.upload")}
										onChange={(event) => {
											chooseEvidence(event.currentTarget.files);
											event.currentTarget.value = "";
										}}
										disabled={
											evidenceArtifactsLoading ||
											Boolean(evidenceArtifactsError) ||
											evidence.length >= MAX_SAMPLING_EVIDENCE_ARTIFACTS ||
											evidenceTotalBytes >= MAX_SAMPLING_EVIDENCE_TASK_BYTES
										}
										className="max-w-sm"
									/>
								</div>
								{evidenceArtifactsLoading && (
									<div
										className="flex items-center gap-2 text-sm text-muted-foreground"
										data-testid="sampling-evidence-recovering"
									>
										<Loader2 className="size-4 animate-spin" /> {t("sampling.workbench.evidence.recovering")}
									</div>
								)}
								{evidenceArtifactsError && (
									<Alert variant="destructive">
										<AlertTriangle />
										<AlertTitle>{t("sampling.workbench.evidence.recoveryError")}</AlertTitle>
										{typeof evidenceArtifactsError === "string" && (
											<AlertDescription>
												<p>{t("sampling.raw.errorDetails")}</p>
												<pre className="whitespace-pre-wrap">{evidenceArtifactsError}</pre>
											</AlertDescription>
										)}
									</Alert>
								)}
								{!evidenceArtifactsLoading && !evidence.length && (
									<p className="rounded-md bg-muted/30 p-4 text-sm text-muted-foreground">
										{t("sampling.workbench.evidence.empty")}
									</p>
								)}
								{evidence.map((item) => {
									const artifact = item.state === "ready" ? item.artifact : undefined;
									const canDeleteArtifact = !artifact || artifact.status === "staged";
									return (
										<div
											key={item.clientId}
											data-testid={artifact ? "sampling-evidence-ready" : "sampling-evidence-upload-row"}
											data-upload-state={item.state}
											data-artifact-id={item.artifact?.id}
											className="space-y-3 rounded-md border p-3"
										>
											<div className="flex min-w-0 items-start justify-between gap-3">
												<div className="min-w-0">
													<p className="truncate text-sm font-medium">{item.fileName}</p>
													<p className="text-xs text-muted-foreground">
														{t(
															item.kind === "screenshot"
																? "sampling.workbench.evidence.screenshot"
																: "sampling.workbench.evidence.pageSnapshot",
														)}{" "}
														· {formatEvidenceBytes(item.sizeBytes)}
													</p>
												</div>
												<div className="flex shrink-0 gap-1">
													{artifact && (
														<Button variant="ghost" size="icon" asChild>
															<a
																href={artifact.downloadUrl}
																aria-label={t("sampling.workbench.evidence.download", { fileName: item.fileName })}
															>
																<Download />
															</a>
														</Button>
													)}
													{item.state === "failed" && item.file && (
														<Button
															variant="ghost"
															size="icon"
															onClick={() => startEvidenceUpload(item)}
															aria-label={t("sampling.workbench.evidence.retry", { fileName: item.fileName })}
														>
															<RefreshCw />
														</Button>
													)}
													<Button
														variant="ghost"
														size="icon"
														onClick={() => void removeEvidence(item)}
														disabled={item.state === "deleting" || !canDeleteArtifact}
														aria-label={
															item.state === "uploading"
																? t("sampling.workbench.evidence.cancel", { fileName: item.fileName })
																: t("sampling.workbench.evidence.remove", { fileName: item.fileName })
														}
													>
														{item.state === "deleting" ? (
															<Loader2 className="animate-spin" />
														) : item.state === "uploading" ? (
															<X />
														) : (
															<Trash2 />
														)}
													</Button>
												</div>
											</div>
											{item.state === "uploading" && (
												<div className="space-y-1" data-testid="sampling-evidence-upload-progress">
													<div className="flex justify-between text-xs text-muted-foreground">
														<span>
															{t(
																item.progress >= 100
																	? "sampling.workbench.evidence.serverVerifying"
																	: "sampling.workbench.evidence.uploading",
															)}
														</span>
														<span>{item.progress}%</span>
													</div>
													<Progress
														value={item.progress}
														aria-label={t("sampling.workbench.evidence.progress", { fileName: item.fileName })}
													/>
												</div>
											)}
											{item.state === "failed" && (
												<div className="text-sm text-destructive" role="alert">
													<p>
														{t(
															item.failureSummary === "unusable"
																? "sampling.workbench.evidence.unusable"
																: "sampling.workbench.evidence.uploadFailed",
														)}
													</p>
													{item.error && (
														<>
															<p>{t("sampling.raw.errorDetails")}</p>
															<pre className="whitespace-pre-wrap">{item.error}</pre>
														</>
													)}
												</div>
											)}
											{artifact && (
												<div className="rounded bg-muted/40 p-2 text-xs">
													<p className="font-medium text-emerald-700 dark:text-emerald-400">
														{t("sampling.workbench.evidence.verified")}
													</p>
													<p className="mt-1 break-all font-mono text-muted-foreground">SHA-256 {artifact.sha256}</p>
												</div>
											)}
											{item.error && item.state === "ready" && (
												<div className="text-sm text-destructive">
													<p>{t("sampling.raw.errorDetails")}</p>
													<pre className="whitespace-pre-wrap">{item.error}</pre>
												</div>
											)}
										</div>
									);
								})}
							</CardContent>
						</Card>
					</>
				)}

				{error && (
					<Alert variant="destructive">
						<AlertTriangle />
						<AlertTitle>{t("sampling.workbench.actionFailed")}</AlertTitle>
						<AlertDescription>
							<p>{t(error.id, error.values)}</p>
							{error.validationIssues && (
								<ul className="mt-2 space-y-2">
									{error.validationIssues.map(({ clientId, fileName, issue }) => {
										const presentation = samplingEvidenceIssuePresentation(issue);
										return (
											<li key={clientId}>
												<p>
													{fileName}: {t(presentation.id, presentation.values)}
												</p>
												{presentation.detail && (
													<>
														<p>{t("sampling.raw.errorDetails")}</p>
														<pre className="whitespace-pre-wrap">{presentation.detail}</pre>
													</>
												)}
											</li>
										);
									})}
								</ul>
							)}
							{error.detail && (
								<>
									<p>{t("sampling.raw.errorDetails")}</p>
									<pre className="whitespace-pre-wrap">{error.detail}</pre>
								</>
							)}
						</AlertDescription>
					</Alert>
				)}

				<div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:justify-between">
					<div className="flex gap-2">
						{!requiresSameSessionRecovery && (
							<Button
								variant="outline"
								onClick={handleRelease}
								disabled={releasing || submitting || evidenceOperationPending}
							>
								{releasing ? <Loader2 className="animate-spin" /> : <RotateCcw />}
								{t("sampling.workbench.release")}
							</Button>
						)}
						<Dialog open={failureOpen} onOpenChange={setFailureOpen}>
							<DialogTrigger asChild>
								<Button variant="destructive" disabled={submitting || evidenceOperationPending}>
									{t(isHumanTakeover ? "sampling.workbench.failure.terminal" : "sampling.workbench.failure.report")}
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>
										{t(
											isHumanTakeover ? "sampling.workbench.failure.terminal" : "sampling.workbench.failure.taskTitle",
										)}
									</DialogTitle>
									<DialogDescription>
										{t("sampling.workbench.failure.description")}{" "}
										{requiresSameSessionRecovery
											? t("sampling.workbench.failure.retainedOnly")
											: t("sampling.workbench.failure.temporary")}
									</DialogDescription>
								</DialogHeader>
								<div className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="sampling-failure-code">{t("sampling.workbench.failure.errorCode")}</Label>
										<Input
											id="sampling-failure-code"
											value={failureCode}
											onChange={(event) => setFailureCode(event.target.value)}
											placeholder={t("sampling.workbench.optional")}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="sampling-failure-message">{t("sampling.workbench.failure.whatHappened")}</Label>
										<Textarea
											id="sampling-failure-message"
											value={failureMessage}
											onChange={(event) => setFailureMessage(event.target.value)}
											className="min-h-28"
										/>
									</div>
								</div>
								<DialogFooter>
									<Button variant="outline" onClick={() => setFailureOpen(false)} disabled={reportingFailure}>
										{t("sampling.workbench.failure.cancel")}
									</Button>
									<Button
										variant="destructive"
										onClick={handleFailure}
										disabled={reportingFailure || !failureMessage.trim()}
									>
										{reportingFailure && <Loader2 className="animate-spin" />}{" "}
										{t(isHumanTakeover ? "sampling.workbench.failure.confirm" : "sampling.workbench.failure.submit")}
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</div>
					{!requiresSameSessionRecovery && (
						<Button
							onClick={handleSubmit}
							disabled={submitting || releasing || Boolean(evidenceBlocker)}
							data-testid="sampling-submit-observation"
						>
							{submitting ? <Loader2 className="animate-spin" /> : <Send />}
							{t(isHumanTakeover ? "sampling.workbench.submitRecovered" : "sampling.workbench.submit")}
						</Button>
					)}
				</div>
			</div>

			<aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
				<Card>
					<CardHeader>
						<CardTitle className="text-base">{t("sampling.workbench.protocol.title")}</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 text-sm">
						<div>
							<p className="text-xs text-muted-foreground">{t("sampling.workbench.protocol.marketLocale")}</p>
							<p>
								{task.market} / {task.locale}
							</p>
						</div>
						<div>
							<p className="text-xs text-muted-foreground">{t("sampling.workbench.protocol.timezone")}</p>
							<p>{task.timezone}</p>
						</div>
						<div>
							<p className="text-xs text-muted-foreground">{t("sampling.workbench.protocol.window")}</p>
							<p>
								{formatDate(new Date(task.measurementWindowStartsAt), {
									timeZone: task.timezone,
									dateStyle: "medium",
									timeStyle: "medium",
								})}
							</p>
							<p>
								{formatDate(new Date(task.measurementWindowEndsAt), {
									timeZone: task.timezone,
									dateStyle: "medium",
									timeStyle: "medium",
								})}
							</p>
						</div>
						<Separator />
						<div>
							<p className="text-xs text-muted-foreground">{t("sampling.workbench.protocol.session")}</p>
							<Badge variant="outline">{t(SESSION_LABELS[task.sessionRequirement])}</Badge>
						</div>
						<div>
							<p className="text-xs text-muted-foreground">{t("sampling.workbench.protocol.search")}</p>
							<Badge variant="outline">{t(SEARCH_LABELS[task.searchRequirement])}</Badge>
						</div>
						<div>
							<p className="text-xs text-muted-foreground">{t("sampling.workbench.protocol.evaluation")}</p>
							<Badge variant="outline">{t(EVALUATION_LABELS[task.evaluationRole])}</Badge>
						</div>
						<Separator />
						<div className="space-y-2">
							<p className="text-xs font-medium text-muted-foreground">{t("sampling.raw.identifiers")}</p>
							<RawIdentifier label={t("sampling.workbench.protocol.taskId")} value={task.id} />
							<RawIdentifier label={t("sampling.workbench.protocol.batchId")} value={task.batchId} />
							<RawIdentifier label={t("sampling.workbench.protocol.promptId")} value={task.promptId} />
							<RawIdentifier label={t("sampling.workbench.protocol.scopeId")} value={task.scopeId} />
							<RawIdentifier label={t("sampling.workbench.protocol.surfaceKey")} value={task.surfaceTargetKey} />
							<RawIdentifier label={t("sampling.workbench.protocol.captureKey")} value={task.captureRouteKey} />
							<RawIdentifier label={t("sampling.workbench.protocol.modelKey")} value={task.model} />
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="text-base">{t("sampling.workbench.lease.title")}</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-sm">
						<p>{t("sampling.workbench.lease.generation", { generation: lease.leaseGeneration })}</p>
						<p className="text-muted-foreground">{t("sampling.workbench.lease.heartbeat", { time: leaseExpiry })}</p>
						{heartbeatError && (
							<div className="text-destructive">
								<p>{t("sampling.task.heartbeatError")}</p>
								{typeof heartbeatError === "string" && (
									<>
										<p>{t("sampling.raw.errorDetails")}</p>
										<pre className="whitespace-pre-wrap">{heartbeatError}</pre>
									</>
								)}
							</div>
						)}
					</CardContent>
				</Card>
			</aside>
		</div>
	);
}

function RawIdentifier({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<p className="text-xs text-muted-foreground">{label}</p>
			<code className="block break-all text-xs">{value}</code>
		</div>
	);
}
