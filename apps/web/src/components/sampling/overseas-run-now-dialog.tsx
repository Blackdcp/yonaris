import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Label } from "@workspace/ui/components/label";
import { AlertTriangle, CirclePlay, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import type { LocalizedMessage, MessageId } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import {
	OVERSEAS_RUN_NOW_DEFAULT_SAMPLES,
	OVERSEAS_RUN_NOW_PAID_SAMPLES,
	type OverseasRunNowSamplesPerChannel,
} from "@/lib/overseas-run-now-contract";

const CHANNELS = [
	{ key: "chatgpt", label: "ChatGPT" },
	{ key: "perplexity", label: "Perplexity" },
	{ key: "gemini", label: "Gemini" },
	{ key: "copilot", label: "Copilot" },
	{ key: "google-ai-mode", label: "Google AI Mode" },
	{ key: "google-ai-overview", label: "Google AI Overview" },
] as const;

const COHORT_STATUS_LABELS: Record<OverseasRunCohortView["status"], MessageId> = {
	dispatch_pending: "sampling.overseas.status.dispatchPending",
	running: "sampling.overseas.status.running",
	completed: "sampling.overseas.status.completed",
};

export type OverseasRunNowChannelKey = (typeof CHANNELS)[number]["key"];

export interface OverseasRunNowProgram {
	id: string;
	name: string;
	promptCount: number;
	timezone: string;
}

export interface OverseasRunCohortView {
	id: string;
	status: "dispatch_pending" | "running" | "completed";
	plannedCallCount: number;
	createdAt: string;
	progress: { planned: number; queued: number; running: number; succeeded: number; failed: number };
}

export interface OverseasRunNowInput {
	brandId: string;
	scopeId: string;
	channelKeys: OverseasRunNowChannelKey[];
	samplesPerChannel: OverseasRunNowSamplesPerChannel;
	idempotencyKey: string;
}

type OverseasRunNowSelection = Omit<OverseasRunNowInput, "idempotencyKey">;

export interface OverseasRunNowSubmission {
	input: OverseasRunNowInput;
}

export interface OverseasRunNowSubmissionController {
	begin(input: OverseasRunNowSelection): OverseasRunNowSubmission | null;
	finish(submission: OverseasRunNowSubmission, succeeded: boolean): void;
	resetIntent(): void;
}

export function createOverseasRunNowSubmissionController(
	createKey: () => string = () => `overseas-run-now-${crypto.randomUUID()}`,
): OverseasRunNowSubmissionController {
	let intentKey: string | null = null;
	let intentSignature: string | null = null;
	let activeSubmission: OverseasRunNowSubmission | null = null;
	return {
		begin(input) {
			if (activeSubmission) return null;
			const nextSignature = JSON.stringify([
				input.brandId,
				input.scopeId,
				[...input.channelKeys].sort(),
				input.samplesPerChannel,
			]);
			if (intentSignature !== nextSignature) {
				intentSignature = nextSignature;
				intentKey = createKey();
			} else {
				intentKey ??= createKey();
			}
			activeSubmission = {
				input: {
					...input,
					channelKeys: [...input.channelKeys],
					idempotencyKey: intentKey,
				},
			};
			return activeSubmission;
		},
		finish(submission, succeeded) {
			if (activeSubmission !== submission) return;
			activeSubmission = null;
			if (succeeded && submission.input.idempotencyKey === intentKey) {
				intentKey = null;
				intentSignature = null;
			}
		},
		resetIntent() {
			if (activeSubmission) return;
			intentKey = null;
			intentSignature = null;
		},
	};
}

export async function executeOverseasRunNowSubmission(
	controller: OverseasRunNowSubmissionController,
	input: OverseasRunNowSelection,
	onRun: (input: OverseasRunNowInput) => Promise<void>,
): Promise<"submitted" | "ignored"> {
	const submission = controller.begin(input);
	if (!submission) return "ignored";
	try {
		await onRun(submission.input);
		controller.finish(submission, true);
		return "submitted";
	} catch (error) {
		controller.finish(submission, false);
		throw error;
	}
}

export function calculateOverseasRunNowCallCount(
	promptCount: number,
	channelCount: number,
	samplesPerChannel: OverseasRunNowSamplesPerChannel = OVERSEAS_RUN_NOW_DEFAULT_SAMPLES,
): number {
	return promptCount * channelCount * samplesPerChannel;
}

export function OverseasRunNowDialog({
	brandId,
	programs,
	cohorts,
	googleAiOverviewReady,
	onRun,
}: {
	brandId: string;
	programs: OverseasRunNowProgram[];
	cohorts: OverseasRunCohortView[];
	googleAiOverviewReady: boolean;
	onRun(input: OverseasRunNowInput): Promise<void>;
}) {
	const { t, formatNumber } = useI18n();
	const [scopeId, setScopeId] = useState(programs[0]?.id ?? "");
	const [channelKeys, setChannelKeys] = useState<OverseasRunNowChannelKey[]>(() =>
		CHANNELS.filter(({ key }) => key !== "google-ai-overview" || googleAiOverviewReady).map(({ key }) => key),
	);
	const [samplesPerChannel, setSamplesPerChannel] = useState<OverseasRunNowSamplesPerChannel>(
		OVERSEAS_RUN_NOW_DEFAULT_SAMPLES,
	);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<LocalizedMessage | null>(null);
	const submittingRef = useRef(false);
	const submissionControllerRef = useRef<OverseasRunNowSubmissionController | null>(null);
	submissionControllerRef.current ??= createOverseasRunNowSubmissionController();
	const selectedProgram = programs.find((program) => program.id === scopeId) ?? programs[0];
	const selectedChannelKeys = channelKeys.filter((key) => key !== "google-ai-overview" || googleAiOverviewReady);
	const callCount = calculateOverseasRunNowCallCount(
		selectedProgram?.promptCount ?? 0,
		selectedChannelKeys.length,
		samplesPerChannel,
	);

	const toggleChannel = (key: OverseasRunNowChannelKey, checked: boolean) => {
		if (submittingRef.current || (key === "google-ai-overview" && !googleAiOverviewReady)) return;
		submissionControllerRef.current?.resetIntent();
		setChannelKeys((current) =>
			checked
				? CHANNELS.map(({ key: candidate }) => candidate).filter(
						(candidate) => candidate === key || current.includes(candidate),
					)
				: current.filter((candidate) => candidate !== key),
		);
	};

	const submit = async () => {
		if (submittingRef.current || !selectedProgram || selectedChannelKeys.length === 0) return;
		const controller = submissionControllerRef.current;
		if (!controller) return;
		submittingRef.current = true;
		setSubmitting(true);
		setError(null);
		try {
			await executeOverseasRunNowSubmission(
				controller,
				{
					brandId,
					scopeId: selectedProgram.id,
					channelKeys: selectedChannelKeys,
					samplesPerChannel,
				},
				onRun,
			);
		} catch (caught) {
			setError({ id: "sampling.overseas.error", detail: caught instanceof Error ? caught.message : undefined });
		} finally {
			submittingRef.current = false;
			setSubmitting(false);
		}
	};

	return (
		<Card className="border-primary/30">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<CirclePlay className="size-5" />
					{t("sampling.overseas.title")}
				</CardTitle>
				<CardDescription>{t("sampling.overseas.description")}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-5">
				{programs.length === 0 ? (
					<Alert>
						<AlertTriangle />
						<AlertTitle>{t("sampling.overseas.noProgram")}</AlertTitle>
						<AlertDescription>{t("sampling.overseas.noProgramDescription")}</AlertDescription>
					</Alert>
				) : (
					<>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="grid gap-2">
								<Label htmlFor="overseas-run-program">{t("sampling.overseas.program")}</Label>
								<select
									id="overseas-run-program"
									className="h-9 w-full rounded-md border bg-background px-3 text-sm"
									value={selectedProgram?.id ?? ""}
									disabled={submitting}
									onChange={(event) => {
										if (submittingRef.current) return;
										submissionControllerRef.current?.resetIntent();
										setScopeId(event.target.value);
									}}
								>
									{programs.map((program) => (
										<option key={program.id} value={program.id}>
											{program.name}
										</option>
									))}
								</select>
								<p className="text-sm text-muted-foreground">
									{t("sampling.overseas.allPrompts", {
										count: formatNumber(selectedProgram?.promptCount ?? 0),
										timezone: selectedProgram?.timezone ?? "",
									})}
								</p>
							</div>
							<div className="grid content-start gap-2">
								<Label htmlFor="overseas-run-samples">{t("sampling.overseas.samples")}</Label>
								<select
									id="overseas-run-samples"
									className="h-9 w-full rounded-md border bg-background px-3 text-sm"
									value={samplesPerChannel}
									disabled={submitting}
									onChange={(event) => {
										if (submittingRef.current) return;
										submissionControllerRef.current?.resetIntent();
										setSamplesPerChannel(
											event.target.value === String(OVERSEAS_RUN_NOW_PAID_SAMPLES)
												? OVERSEAS_RUN_NOW_PAID_SAMPLES
												: OVERSEAS_RUN_NOW_DEFAULT_SAMPLES,
										);
									}}
								>
									<option value={OVERSEAS_RUN_NOW_DEFAULT_SAMPLES}>{t("sampling.overseas.sampleStandard")}</option>
									<option value={OVERSEAS_RUN_NOW_PAID_SAMPLES}>{t("sampling.overseas.samplePaid")}</option>
								</select>
							</div>
						</div>
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{CHANNELS.map(({ key, label }) => {
								const unavailable = key === "google-ai-overview" && !googleAiOverviewReady;
								return (
									<Label
										key={key}
										htmlFor={`overseas-${key}`}
										className="flex cursor-pointer gap-3 rounded-md border p-3"
									>
										<Checkbox
											id={`overseas-${key}`}
											checked={selectedChannelKeys.includes(key)}
											disabled={submitting || unavailable}
											onCheckedChange={(checked) => toggleChannel(key, checked === true)}
										/>
										<span>
											{label}
											{unavailable && (
												<span className="block text-xs font-normal text-muted-foreground">
													{t("sampling.overseas.aiOverviewUnavailable")}
												</span>
											)}
										</span>
									</Label>
								);
							})}
						</div>
						<div className="flex flex-col gap-3 rounded-md bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
							<p className="font-medium tabular-nums">
								{t("sampling.overseas.callCount", {
									prompts: selectedProgram?.promptCount ?? 0,
									channels: selectedChannelKeys.length,
									samples: samplesPerChannel,
									calls: callCount,
								})}
							</p>
							<Button disabled={submitting || callCount === 0 || selectedChannelKeys.length === 0} onClick={submit}>
								{submitting && <Loader2 className="animate-spin" />}
								{t("sampling.overseas.submit", { count: formatNumber(callCount) })}
							</Button>
						</div>
					</>
				)}
				{error && (
					<Alert variant="destructive">
						<AlertTitle>{t(error.id, error.values)}</AlertTitle>
						{error.detail && (
							<AlertDescription>
								<p>{t("sampling.raw.errorDetails")}</p>
								<pre className="whitespace-pre-wrap">{error.detail}</pre>
							</AlertDescription>
						)}
					</Alert>
				)}
				{cohorts.length > 0 && (
					<div className="space-y-2">
						<p className="text-sm font-medium">{t("sampling.overseas.recent")}</p>
						{cohorts.map((cohort) => (
							<div
								key={cohort.id}
								className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
							>
								<span>{t(COHORT_STATUS_LABELS[cohort.status])}</span>
								<span className="tabular-nums">
									{t("sampling.overseas.progress", {
										succeeded: cohort.progress.succeeded,
										planned: cohort.progress.planned,
										running: cohort.progress.running,
										failed: cohort.progress.failed,
									})}
								</span>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
