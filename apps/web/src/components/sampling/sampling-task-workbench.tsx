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
import {
	deleteSamplingEvidence,
	formatEvidenceBytes,
	MAX_SAMPLING_EVIDENCE_ARTIFACTS,
	MAX_SAMPLING_EVIDENCE_TASK_BYTES,
	SAMPLING_EVIDENCE_ACCEPT,
	type SamplingEvidenceTransferState,
	samplingEvidenceSubmitBlocker,
	uploadSamplingEvidence,
	validateSamplingEvidenceFile,
} from "./sampling-evidence";
import { SamplingStatusBadge } from "./sampling-status-badge";
import { formatZonedDateTimeInput, parseZonedDateTimeInput } from "./sampling-timezone";
import type {
	SamplingEvidenceArtifactView,
	SamplingEvidenceKind,
	SamplingLease,
	SamplingObservationInput,
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

function formatRequirement(value: string): string {
	if (value === "platform_default") return "platform default (native auto)";
	return value.replaceAll("_", " ");
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
	heartbeatError: string | null;
	initialEvidenceArtifacts: SamplingEvidenceArtifactView[];
	evidenceArtifactsLoading: boolean;
	evidenceArtifactsError: string | null;
	onRelease: () => Promise<void>;
	onSubmit: (observation: SamplingObservationInput) => Promise<void>;
	onFail: (input: { errorCode?: string; errorMessage: string }) => Promise<void>;
}) {
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
	const [error, setError] = useState<string | null>(null);
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
		() => (lease.leaseExpiresAt ? new Date(lease.leaseExpiresAt).toLocaleTimeString() : "refreshing"),
		[lease.leaseExpiresAt],
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
					error: artifact.status === "staged" ? undefined : "Attached evidence cannot be reused for this claim.",
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
			setError("Clipboard access was denied. Select the prompt text and copy it manually.");
		}
	};

	const patchEvidence = (clientId: string, patch: Partial<EvidenceDraft>) => {
		setEvidence((previous) => previous.map((item) => (item.clientId === clientId ? { ...item, ...patch } : item)));
	};

	const startEvidenceUpload = (draft: EvidenceDraft) => {
		if (!draft.file) return;
		setError(null);
		patchEvidence(draft.clientId, { state: "uploading", progress: 0, error: undefined });
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
					error: caught instanceof Error ? caught.message : "Evidence upload failed.",
				});
			})
			.finally(() => uploadAborters.current.delete(draft.clientId));
	};

	const chooseEvidence = (files: FileList | null) => {
		if (!files?.length) return;
		let artifactCount = evidence.length;
		let totalBytes = evidenceTotalBytes;
		const accepted: EvidenceDraft[] = [];
		const rejected: string[] = [];
		for (const file of Array.from(files)) {
			const result = validateSamplingEvidenceFile(file, { artifactCount, totalBytes });
			if (!result.ok) {
				rejected.push(`${file.name}: ${result.message}`);
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
		if (rejected.length) setError(rejected.join("\n"));
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
			const message = caught instanceof Error ? caught.message : "Could not delete staged evidence.";
			patchEvidence(item.clientId, { state: "ready", error: message });
			setError(message);
		}
	};

	const handleSubmit = async () => {
		setError(null);
		if (requiresSameSessionRecovery) {
			setError("This observation can only be recovered from the retained Browser Runner session.");
			return;
		}
		if (!answerText.trim()) {
			setError("Paste the complete platform answer before submitting.");
			return;
		}
		if (!operatorAttested) {
			setError("Complete the operator attestation before submitting this observation.");
			return;
		}
		let observedDate: Date;
		try {
			observedDate = parseZonedDateTimeInput(observedAt, task.timezone);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Observed at must be a valid date and time.");
			return;
		}
		const windowStartsAt = new Date(task.measurementWindowStartsAt);
		const windowEndsAt = new Date(task.measurementWindowEndsAt);
		if (observedDate < windowStartsAt || observedDate > windowEndsAt) {
			setError("Observed at must fall inside the frozen measurement window.");
			return;
		}
		if (task.requirePageUrl && !pageUrl.trim()) {
			setError("The frozen evidence protocol requires the result page URL.");
			return;
		}
		if (evidenceBlocker) {
			setError(evidenceBlocker);
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
			setError(caught instanceof Error ? caught.message : "Failed to submit this sample.");
		} finally {
			setSubmitting(false);
		}
	};

	const handleRelease = async () => {
		if (requiresSameSessionRecovery) {
			setError("A post-submit Browser Runner task cannot be released or replayed from this workbench.");
			return;
		}
		setReleasing(true);
		setError(null);
		try {
			await onRelease();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Failed to release this task.");
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
			setError(caught instanceof Error ? caught.message : "Failed to report the task failure.");
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
						<AlertTitle>Browser Runner needs human takeover</AlertTitle>
						<AlertDescription className="space-y-2">
							<p>
								Continue this same frozen task. A complete recovered observation is analyzed by the existing metric
								pipeline; this screen does not let an operator edit visibility or share-of-voice values directly.
							</p>
							{task.automation?.needsHumanReason && <p>Reason: {task.automation.needsHumanReason}</p>}
							{submitMayHaveOccurred && (
								<p>
									The platform submission may already have occurred. Automatic retry is permanently stopped to avoid a
									duplicate consumer answer.
								</p>
							)}
						</AlertDescription>
					</Alert>
				)}
				<Card>
					<CardHeader>
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<CardTitle>{task.targetLabel}</CardTitle>
								<CardDescription>
									{task.brandName} · {task.scopeName} · sample {task.sampleIndex}
								</CardDescription>
							</div>
							<div className="flex flex-wrap gap-2">
								<SamplingStatusBadge status={task.status} />
								{isHumanTakeover && <Badge className="bg-amber-100 text-amber-800">Needs human</Badge>}
							</div>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
							<div>
								<p className="text-xs text-muted-foreground">Required session</p>
								<Badge variant="outline" className="mt-1 capitalize">
									{formatRequirement(task.sessionRequirement)}
								</Badge>
							</div>
							<div className="sm:col-span-2">
								<p className="text-xs text-muted-foreground">Frozen measurement window</p>
								<p className="mt-1 text-sm">
									{new Date(task.measurementWindowStartsAt).toLocaleString(undefined, {
										timeZone: task.timezone,
										timeZoneName: "short",
									})}{" "}
									–{" "}
									{new Date(task.measurementWindowEndsAt).toLocaleString(undefined, {
										timeZone: task.timezone,
										timeZoneName: "short",
									})}
								</p>
							</div>
							<div>
								<p className="text-xs text-muted-foreground">Required search mode</p>
								<Badge variant="outline" className="mt-1 capitalize">
									{formatRequirement(task.searchRequirement)}
								</Badge>
							</div>
						</div>
						<div className="rounded-md border bg-muted/30 p-4">
							<div className="mb-3 flex items-center justify-between gap-3">
								<Label>Frozen prompt</Label>
								{!requiresSameSessionRecovery && (
									<Button variant="outline" size="sm" onClick={copyPrompt}>
										{copied ? <Check /> : <Clipboard />}
										{copied ? "Copied" : "Copy"}
									</Button>
								)}
							</div>
							<p className="select-text whitespace-pre-wrap text-sm leading-relaxed">{task.promptText}</p>
						</div>
						{requiresSameSessionRecovery ? (
							<Alert variant="destructive">
								<AlertTriangle />
								<AlertTitle>Do not open a new conversation or resend this prompt</AlertTitle>
								<AlertDescription>
									The submit intent is already durable. Resume the retained Browser Runner profile on the CN runner host
									and recover only the original answer. If that profile cannot be recovered, confirm a terminal
									technical failure; it lowers delivery coverage but does not count as a negative brand mention.
								</AlertDescription>
							</Alert>
						) : (
							<Button asChild className="w-full sm:w-auto">
								<a href={task.launchUrl} target="_blank" rel="noopener noreferrer">
									<ExternalLink />
									Open {task.targetLabel}
								</a>
							</Button>
						)}
						{!requiresSameSessionRecovery && (
							<Alert>
								<AlertTriangle />
								<AlertTitle>Operator attestation required</AlertTitle>
								<AlertDescription className="space-y-3">
									<p>The platform link cannot enforce cookies, account state, location, or search mode.</p>
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
											I confirm this run was executed on {task.targetLabel} using the required clean session and search
											condition, in the {task.market}/{task.locale} market and language context, and that the recorded
											answer and evidence belong to this run.
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
								<CardTitle>Observation</CardTitle>
								<CardDescription>Record exactly what the clean-session consumer surface returned.</CardDescription>
							</CardHeader>
							<CardContent className="space-y-5">
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="space-y-2 sm:col-span-2">
										<Label htmlFor="sampling-page-url">Result page URL</Label>
										<Input
											id="sampling-page-url"
											type="url"
											value={pageUrl}
											onChange={(event) => setPageUrl(event.target.value)}
											placeholder="https://..."
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="sampling-observed-at">Observed at ({task.timezone})</Label>
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
										<Label htmlFor="sampling-model-version">Displayed model/version</Label>
										<Input
											id="sampling-model-version"
											value={modelVersion}
											onChange={(event) => setModelVersion(event.target.value)}
											placeholder="Optional"
										/>
									</div>
									{task.searchRequirement === "platform_default" && (
										<div className="space-y-2">
											<Label>Observed web search</Label>
											<Select
												value={webSearchObserved}
												onValueChange={(value: "unknown" | "yes" | "no") => setWebSearchObserved(value)}
											>
												<SelectTrigger className="w-full">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="unknown">Unknown / no verified marker</SelectItem>
													<SelectItem value="yes">Yes, verified</SelectItem>
													<SelectItem value="no">No, explicitly verified</SelectItem>
												</SelectContent>
											</Select>
										</div>
									)}
								</div>

								<div className="space-y-2">
									<div className="flex items-center justify-between gap-2">
										<Label htmlFor="sampling-answer">Complete answer</Label>
										<span className="text-xs tabular-nums text-muted-foreground">
											{answerText.length.toLocaleString()} characters
										</span>
									</div>
									<Textarea
										id="sampling-answer"
										value={answerText}
										onChange={(event) => setAnswerText(event.target.value)}
										placeholder="Paste the full response without summarizing or editing it."
										className="min-h-72 font-mono text-sm"
									/>
								</div>

								<div className="grid gap-4 lg:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="sampling-citations">Citation URLs</Label>
										<Textarea
											id="sampling-citations"
											value={citationUrls}
											onChange={(event) => setCitationUrls(event.target.value)}
											placeholder="One URL per line"
											className="min-h-28"
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="sampling-web-queries">Visible web queries</Label>
										<Textarea
											id="sampling-web-queries"
											value={webQueries}
											onChange={(event) => setWebQueries(event.target.value)}
											placeholder="One query per line, if shown"
											className="min-h-28"
										/>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>Evidence uploads</CardTitle>
								<CardDescription>
									Upload at least {evidenceMinimum} artifact(s). Yonaris stores the file and computes its SHA-256
									digest.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<Alert>
									<FileUp />
									<AlertTitle>V1 file policy</AlertTitle>
									<AlertDescription>
										PNG, JPEG, WebP, or PDF only; 8 MiB per file and 40 MiB per task. Video is not supported in V1.
									</AlertDescription>
								</Alert>
								<div className="flex flex-col gap-3 rounded-md border border-dashed p-4 sm:flex-row sm:items-end sm:justify-between">
									<div className="space-y-1.5">
										<Label htmlFor="sampling-evidence-files">Upload evidence</Label>
										<p className="text-xs text-muted-foreground">
											{evidence.length}/{MAX_SAMPLING_EVIDENCE_ARTIFACTS} files ·{" "}
											{formatEvidenceBytes(evidenceTotalBytes)} /{" "}
											{formatEvidenceBytes(MAX_SAMPLING_EVIDENCE_TASK_BYTES)}
										</p>
									</div>
									<Input
										id="sampling-evidence-files"
										data-testid="sampling-evidence-file-input"
										type="file"
										multiple
										accept={SAMPLING_EVIDENCE_ACCEPT}
										aria-label="Upload evidence"
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
										<Loader2 className="size-4 animate-spin" /> Recovering staged evidence…
									</div>
								)}
								{evidenceArtifactsError && (
									<Alert variant="destructive">
										<AlertTriangle />
										<AlertTitle>Could not recover staged evidence</AlertTitle>
										<AlertDescription>{evidenceArtifactsError}</AlertDescription>
									</Alert>
								)}
								{!evidenceArtifactsLoading && !evidence.length && (
									<p className="rounded-md bg-muted/30 p-4 text-sm text-muted-foreground">No evidence uploaded yet.</p>
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
														{item.kind === "screenshot" ? "Screenshot" : "Page snapshot"} ·{" "}
														{formatEvidenceBytes(item.sizeBytes)}
													</p>
												</div>
												<div className="flex shrink-0 gap-1">
													{artifact && (
														<Button variant="ghost" size="icon" asChild>
															<a href={artifact.downloadUrl} aria-label={`Download ${item.fileName}`}>
																<Download />
															</a>
														</Button>
													)}
													{item.state === "failed" && item.file && (
														<Button
															variant="ghost"
															size="icon"
															onClick={() => startEvidenceUpload(item)}
															aria-label={`Retry ${item.fileName}`}
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
															item.state === "uploading" ? `Cancel ${item.fileName}` : `Remove ${item.fileName}`
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
														<span>{item.progress >= 100 ? "Server verifying" : "Uploading"}</span>
														<span>{item.progress}%</span>
													</div>
													<Progress value={item.progress} aria-label={`Upload progress for ${item.fileName}`} />
												</div>
											)}
											{item.state === "failed" && (
												<p className="text-sm text-destructive" role="alert">
													{item.error ?? "Evidence upload failed."}
												</p>
											)}
											{artifact && (
												<div className="rounded bg-muted/40 p-2 text-xs">
													<p className="font-medium text-emerald-700 dark:text-emerald-400">Upload verified</p>
													<p className="mt-1 break-all font-mono text-muted-foreground">SHA-256 {artifact.sha256}</p>
												</div>
											)}
											{item.error && item.state === "ready" && <p className="text-sm text-destructive">{item.error}</p>}
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
						<AlertTitle>Action failed</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
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
								Release to queue
							</Button>
						)}
						<Dialog open={failureOpen} onOpenChange={setFailureOpen}>
							<DialogTrigger asChild>
								<Button variant="destructive" disabled={submitting || evidenceOperationPending}>
									{isHumanTakeover ? "Confirm terminal failure" : "Report failure"}
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>{isHumanTakeover ? "Confirm terminal failure" : "Report task failure"}</DialogTitle>
									<DialogDescription>
										Record a terminal failure that remains in the frozen delivery denominator and lowers success
										coverage. It is excluded from the Yonaris visibility denominator and is never counted as a brand
										non-mention.{" "}
										{requiresSameSessionRecovery
											? "Only use this when the retained Runner session cannot recover the original answer."
											: "For temporary blockers, release the task instead."}
									</DialogDescription>
								</DialogHeader>
								<div className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="sampling-failure-code">Error code</Label>
										<Input
											id="sampling-failure-code"
											value={failureCode}
											onChange={(event) => setFailureCode(event.target.value)}
											placeholder="Optional"
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="sampling-failure-message">What happened?</Label>
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
										Cancel
									</Button>
									<Button
										variant="destructive"
										onClick={handleFailure}
										disabled={reportingFailure || !failureMessage.trim()}
									>
										{reportingFailure && <Loader2 className="animate-spin" />}{" "}
										{isHumanTakeover ? "Confirm failure" : "Report failure"}
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
							{isHumanTakeover ? "Submit recovered observation" : "Submit observation"}
						</Button>
					)}
				</div>
			</div>

			<aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Frozen protocol</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3 text-sm">
						<div>
							<p className="text-xs text-muted-foreground">Market / locale</p>
							<p>
								{task.market} / {task.locale}
							</p>
						</div>
						<div>
							<p className="text-xs text-muted-foreground">Timezone</p>
							<p>{task.timezone}</p>
						</div>
						<div>
							<p className="text-xs text-muted-foreground">Measurement window</p>
							<p>{new Date(task.measurementWindowStartsAt).toLocaleString()}</p>
							<p>{new Date(task.measurementWindowEndsAt).toLocaleString()}</p>
						</div>
						<Separator />
						<div>
							<p className="text-xs text-muted-foreground">Session</p>
							<Badge variant="outline" className="capitalize">
								{formatRequirement(task.sessionRequirement)}
							</Badge>
						</div>
						<div>
							<p className="text-xs text-muted-foreground">Search</p>
							<Badge variant="outline" className="capitalize">
								{formatRequirement(task.searchRequirement)}
							</Badge>
						</div>
						<div>
							<p className="text-xs text-muted-foreground">Evaluation role</p>
							<Badge variant="outline" className="capitalize">
								{task.evaluationRole}
							</Badge>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Claim lease</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-sm">
						<p>Generation {lease.leaseGeneration}</p>
						<p className="text-muted-foreground">Heartbeat every 60 seconds · expires {leaseExpiry}</p>
						{heartbeatError && <p className="text-destructive">{heartbeatError}</p>}
					</CardContent>
				</Card>
			</aside>
		</div>
	);
}
