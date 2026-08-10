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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { Separator } from "@workspace/ui/components/separator";
import { Textarea } from "@workspace/ui/components/textarea";
import { AlertTriangle, Check, Clipboard, ExternalLink, Loader2, Plus, RotateCcw, Send, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { SamplingStatusBadge } from "./sampling-status-badge";
import type { SamplingEvidenceInput, SamplingLease, SamplingObservationInput, SamplingTaskView } from "./types";

function localDateTimeValue(date = new Date()): string {
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return local.toISOString().slice(0, 16);
}

interface EvidenceDraft extends SamplingEvidenceInput {
	clientId: string;
}

function emptyEvidence(): EvidenceDraft {
	return {
		clientId: `evidence-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
		type: "screenshot",
		uri: "",
		sha256: "",
	};
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
	return value.replaceAll("_", " ");
}

export function SamplingTaskWorkbench({
	task,
	lease,
	heartbeatError,
	onRelease,
	onSubmit,
	onFail,
}: {
	task: SamplingTaskView;
	lease: SamplingLease;
	heartbeatError: string | null;
	onRelease: () => Promise<void>;
	onSubmit: (observation: SamplingObservationInput) => Promise<void>;
	onFail: (input: { errorCode?: string; errorMessage: string }) => Promise<void>;
}) {
	const evidenceMinimum = Math.max(0, task.minimumEvidenceArtifacts);
	const [answerText, setAnswerText] = useState("");
	const [pageUrl, setPageUrl] = useState("");
	const [observedAt, setObservedAt] = useState(localDateTimeValue);
	const [modelVersion, setModelVersion] = useState("");
	const [citationUrls, setCitationUrls] = useState("");
	const [webQueries, setWebQueries] = useState("");
	const [operatorAttested, setOperatorAttested] = useState(false);
	const [evidence, setEvidence] = useState<EvidenceDraft[]>(() =>
		Array.from({ length: Math.max(1, evidenceMinimum) }, emptyEvidence),
	);
	const [copied, setCopied] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [releasing, setReleasing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [failureOpen, setFailureOpen] = useState(false);
	const [failureMessage, setFailureMessage] = useState("");
	const [failureCode, setFailureCode] = useState("");
	const [reportingFailure, setReportingFailure] = useState(false);

	const sessionMode = task.sessionRequirement;
	const searchMode = task.searchRequirement === "required" ? "on" : "off";
	const leaseExpiry = useMemo(
		() => (lease.leaseExpiresAt ? new Date(lease.leaseExpiresAt).toLocaleTimeString() : "refreshing"),
		[lease.leaseExpiresAt],
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

	const updateEvidence = (index: number, patch: Partial<EvidenceDraft>) => {
		setEvidence((previous) => previous.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
	};

	const removeEvidence = (index: number) => {
		setEvidence((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
	};

	const handleSubmit = async () => {
		setError(null);
		if (!answerText.trim()) {
			setError("Paste the complete platform answer before submitting.");
			return;
		}
		if (!operatorAttested) {
			setError("Complete the operator attestation before submitting this observation.");
			return;
		}
		const observedDate = new Date(observedAt);
		const windowStartsAt = new Date(task.measurementWindowStartsAt);
		const windowEndsAt = new Date(task.measurementWindowEndsAt);
		if (!Number.isFinite(observedDate.getTime())) {
			setError("Observed at must be a valid date and time.");
			return;
		}
		if (observedDate < windowStartsAt || observedDate > windowEndsAt) {
			setError("Observed at must fall inside the frozen measurement window.");
			return;
		}
		if (task.requirePageUrl && !pageUrl.trim()) {
			setError("The frozen evidence protocol requires the result page URL.");
			return;
		}
		const completedEvidence = evidence.filter((item) => item.uri.trim());
		if (completedEvidence.length < evidenceMinimum) {
			setError(`This task requires at least ${evidenceMinimum} evidence artifact(s).`);
			return;
		}
		if (task.requireEvidenceSha256 && completedEvidence.some((item) => !/^[a-fA-F0-9]{64}$/.test(item.sha256))) {
			setError("Every evidence artifact must include a 64-character SHA-256 hash.");
			return;
		}

		setSubmitting(true);
		try {
			await onSubmit({
				answerText: answerText.trim(),
				observedAt: observedDate.toISOString(),
				pageUrl: pageUrl.trim(),
				sessionMode,
				searchMode,
				operatorAttested: true,
				...(modelVersion.trim() ? { modelVersion: modelVersion.trim() } : {}),
				evidenceRefs: completedEvidence.map((item) => ({
					type: item.type,
					uri: item.uri.trim(),
					sha256: item.sha256.trim().toLowerCase(),
				})),
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
				<Card>
					<CardHeader>
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<CardTitle>{task.targetLabel}</CardTitle>
								<CardDescription>
									{task.brandName} · {task.scopeName} · sample {task.sampleIndex}
								</CardDescription>
							</div>
							<SamplingStatusBadge status={task.status} />
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
									{new Date(task.measurementWindowStartsAt).toLocaleString()} –{" "}
									{new Date(task.measurementWindowEndsAt).toLocaleString()}
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
								<Button variant="outline" size="sm" onClick={copyPrompt}>
									{copied ? <Check /> : <Clipboard />}
									{copied ? "Copied" : "Copy"}
								</Button>
							</div>
							<p className="select-text whitespace-pre-wrap text-sm leading-relaxed">{task.promptText}</p>
						</div>
						<Button asChild className="w-full sm:w-auto">
							<a href={task.launchUrl} target="_blank" rel="noopener noreferrer">
								<ExternalLink />
								Open {task.targetLabel}
							</a>
						</Button>
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
									<Label htmlFor="sampling-operator-attestation" className="cursor-pointer leading-relaxed font-normal">
										I confirm this run was executed on {task.targetLabel} using the required clean session and search
										condition, in the {task.market}/{task.locale} market and language context, and that the recorded
										answer and evidence belong to this run.
									</Label>
								</div>
							</AlertDescription>
						</Alert>
					</CardContent>
				</Card>

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
								<Label htmlFor="sampling-observed-at">Observed at</Label>
								<Input
									id="sampling-observed-at"
									type="datetime-local"
									value={observedAt}
									onChange={(event) => setObservedAt(event.target.value)}
									min={localDateTimeValue(new Date(task.measurementWindowStartsAt))}
									max={localDateTimeValue(new Date(task.measurementWindowEndsAt))}
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
						<div className="flex items-start justify-between gap-3">
							<div>
								<CardTitle>Evidence references</CardTitle>
								<CardDescription>
									At least {evidenceMinimum} artifact(s); provide an HTTP(S) URI and its SHA-256 hash.
								</CardDescription>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setEvidence((items) => [...items, emptyEvidence()])}
								disabled={evidence.length >= 20}
							>
								<Plus /> Add
							</Button>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<Alert>
							<AlertTriangle />
							<AlertTitle>Reference-only evidence</AlertTitle>
							<AlertDescription>
								Yonaris records the URI and reported hash. This form does not upload, fetch, or independently verify the
								artifact.
							</AlertDescription>
						</Alert>
						{evidence.map((item, index) => (
							<div
								key={item.clientId}
								className="grid gap-3 rounded-md border p-3 md:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)_auto]"
							>
								<div className="space-y-1.5">
									<Label className="text-xs">Type</Label>
									<Select
										value={item.type}
										onValueChange={(value: SamplingEvidenceInput["type"]) => updateEvidence(index, { type: value })}
									>
										<SelectTrigger className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="screenshot">Screenshot</SelectItem>
											<SelectItem value="page_snapshot">Page snapshot</SelectItem>
											<SelectItem value="video">Video</SelectItem>
											<SelectItem value="other">Other</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-1.5">
									<Label className="text-xs">Evidence URI</Label>
									<Input
										type="url"
										value={item.uri}
										onChange={(event) => updateEvidence(index, { uri: event.target.value })}
										placeholder="https://..."
									/>
								</div>
								<div className="space-y-1.5">
									<Label className="text-xs">SHA-256</Label>
									<Input
										value={item.sha256}
										onChange={(event) => updateEvidence(index, { sha256: event.target.value })}
										placeholder="64 hexadecimal characters"
										className="font-mono text-xs"
									/>
								</div>
								<div className="flex items-end">
									<Button
										variant="ghost"
										size="icon"
										onClick={() => removeEvidence(index)}
										disabled={evidence.length <= evidenceMinimum}
										aria-label="Remove evidence"
									>
										<Trash2 />
									</Button>
								</div>
							</div>
						))}
					</CardContent>
				</Card>

				{error && (
					<Alert variant="destructive">
						<AlertTriangle />
						<AlertTitle>Action failed</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:justify-between">
					<div className="flex gap-2">
						<Button variant="outline" onClick={handleRelease} disabled={releasing || submitting}>
							{releasing ? <Loader2 className="animate-spin" /> : <RotateCcw />}
							Release to queue
						</Button>
						<Dialog open={failureOpen} onOpenChange={setFailureOpen}>
							<DialogTrigger asChild>
								<Button variant="destructive" disabled={submitting}>
									Report failure
								</Button>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>Report task failure</DialogTitle>
									<DialogDescription>
										Record a terminal failure that remains in the frozen delivery denominator. For temporary blockers,
										release the task instead.
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
										{reportingFailure && <Loader2 className="animate-spin" />} Report failure
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</div>
					<Button onClick={handleSubmit} disabled={submitting || releasing}>
						{submitting ? <Loader2 className="animate-spin" /> : <Send />}
						Submit observation
					</Button>
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
