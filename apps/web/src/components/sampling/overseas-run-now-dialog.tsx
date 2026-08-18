import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Label } from "@workspace/ui/components/label";
import { AlertTriangle, CirclePlay, Loader2 } from "lucide-react";
import { useRef, useState } from "react";

const CHANNELS = [
	{ key: "chatgpt", label: "ChatGPT" },
	{ key: "perplexity", label: "Perplexity" },
	{ key: "gemini", label: "Gemini" },
	{ key: "copilot", label: "Copilot" },
	{ key: "google-ai-mode", label: "Google AI Mode" },
	{ key: "google-ai-overview", label: "Google AI Overview" },
] as const;

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
			const nextSignature = JSON.stringify([input.brandId, input.scopeId, [...input.channelKeys].sort()]);
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

export function calculateOverseasRunNowCallCount(promptCount: number, channelCount: number): number {
	return promptCount * channelCount * 5;
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
	const [scopeId, setScopeId] = useState(programs[0]?.id ?? "");
	const [channelKeys, setChannelKeys] = useState<OverseasRunNowChannelKey[]>(() =>
		CHANNELS.filter(({ key }) => key !== "google-ai-overview" || googleAiOverviewReady).map(({ key }) => key),
	);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const submittingRef = useRef(false);
	const submissionControllerRef = useRef<OverseasRunNowSubmissionController | null>(null);
	submissionControllerRef.current ??= createOverseasRunNowSubmissionController();
	const selectedProgram = programs.find((program) => program.id === scopeId) ?? programs[0];
	const selectedChannelKeys = channelKeys.filter((key) => key !== "google-ai-overview" || googleAiOverviewReady);
	const callCount = calculateOverseasRunNowCallCount(selectedProgram?.promptCount ?? 0, selectedChannelKeys.length);

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
				},
				onRun,
			);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not start the overseas run.");
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
					Overseas Bright Data run
				</CardTitle>
				<CardDescription>
					Run every enabled Prompt once as a five-sample cohort on each selected channel. No schedule is created.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-5">
				{programs.length === 0 ? (
					<Alert>
						<AlertTriangle />
						<AlertTitle>No eligible overseas Program</AlertTitle>
						<AlertDescription>Create an enabled, scored, manual-only US/en Program first.</AlertDescription>
					</Alert>
				) : (
					<>
						<div className="grid gap-2">
							<Label htmlFor="overseas-run-program">Program</Label>
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
								All {selectedProgram?.promptCount ?? 0} enabled Prompts · {selectedProgram?.timezone}
							</p>
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
													Configure BRIGHTDATA_SERP_ZONE to enable Google AI Overview.
												</span>
											)}
										</span>
									</Label>
								);
							})}
						</div>
						<div className="flex flex-col gap-3 rounded-md bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
							<p className="font-medium tabular-nums">
								{selectedProgram?.promptCount ?? 0} × {selectedChannelKeys.length} × 5 = {callCount} calls
							</p>
							<Button disabled={submitting || callCount === 0 || selectedChannelKeys.length === 0} onClick={submit}>
								{submitting && <Loader2 className="animate-spin" />}
								Run {callCount.toLocaleString("en-US")} overseas calls now
							</Button>
						</div>
					</>
				)}
				{error && <p className="text-sm text-destructive">{error}</p>}
				{cohorts.length > 0 && (
					<div className="space-y-2">
						<p className="text-sm font-medium">Recent overseas runs</p>
						{cohorts.map((cohort) => (
							<div
								key={cohort.id}
								className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
							>
								<span className="capitalize">{cohort.status.replaceAll("_", " ")}</span>
								<span className="tabular-nums">
									{cohort.progress.succeeded}/{cohort.progress.planned} succeeded · {cohort.progress.running} running ·{" "}
									{cohort.progress.failed} failed
								</span>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
