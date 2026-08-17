import type {
	BrowserExtensionReadinessStatus,
	BrowserExtensionSurface,
} from "@workspace/lib/browser-extension-contract";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Label } from "@workspace/ui/components/label";
import { AlertTriangle, CirclePlay, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { BrowserRunnerDeviceView, SamplingRunNowInput, SamplingRunNowProgram } from "./types";

const FIXED_SAMPLES_PER_CHANNEL = 5;
const DEVICE_ONLINE_WINDOW_MS = 2 * 60 * 1_000;

const CHANNELS: ReadonlyArray<{ surface: BrowserExtensionSurface; label: string }> = [
	{ surface: "doubao.consumer_web", label: "Doubao" },
	{ surface: "deepseek.consumer_web", label: "DeepSeek" },
];

export function calculateSamplingRunNowTaskCount(promptCount: number, channelCount: number): number {
	return promptCount * channelCount * FIXED_SAMPLES_PER_CHANNEL;
}

export function samplingBatchRefetchInterval(data: { batches: ReadonlyArray<{ status: string }> } | undefined): number {
	return data?.batches.some(
		(batch) => batch.status === "draft" || batch.status === "frozen" || batch.status === "in_progress",
	)
		? 5_000
		: 60_000;
}

export function browserRunnerDeviceIsOnline(device: BrowserRunnerDeviceView, now = new Date()): boolean {
	if (device.revokedAt || !device.lastSeenAt) return false;
	const lastSeenAt = new Date(device.lastSeenAt).getTime();
	return Number.isFinite(lastSeenAt) && now.getTime() - lastSeenAt <= DEVICE_ONLINE_WINDOW_MS;
}

function channelAvailability(
	devices: readonly BrowserRunnerDeviceView[],
	brandId: string,
	surface: BrowserExtensionSurface,
	now: Date,
): { ready: boolean; label: string; status?: BrowserExtensionReadinessStatus } {
	const eligible = devices.filter(
		(device) => device.allowedBrandIds.includes(brandId) && device.supportedSurfaces.includes(surface),
	);
	const online = eligible.filter((device) => browserRunnerDeviceIsOnline(device, now));
	if (online.some((device) => device.readiness[surface]?.status === "ready")) {
		return { ready: true, label: "Ready" };
	}
	const status = online.map((device) => device.readiness[surface]?.status).find((value) => value !== undefined);
	if (!status) return { ready: false, label: "Offline · will wait in queue" };
	return { ready: false, label: readinessLabel(status), status };
}

function readinessLabel(status: BrowserExtensionReadinessStatus): string {
	switch (status) {
		case "signed_out":
			return "Signed out · will wait in queue";
		case "paused_by_risk_control":
			return "Paused by risk control · will wait in queue";
		case "adapter_incompatible":
			return "Page changed · will wait in queue";
		case "unavailable":
			return "Unavailable · will wait in queue";
		case "ready":
			return "Ready";
	}
}

export function SamplingRunNowDialog({
	brandId,
	programs,
	devices,
	onRun,
	now = new Date(),
}: {
	brandId: string;
	programs: SamplingRunNowProgram[];
	devices: BrowserRunnerDeviceView[];
	onRun: (input: SamplingRunNowInput) => Promise<void>;
	now?: Date;
}) {
	const [scopeId, setScopeId] = useState(programs[0]?.id ?? "");
	const [surfaceSelectionOverride, setSurfaceSelectionOverride] = useState<BrowserExtensionSurface[] | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const selectedProgram = programs.find((program) => program.id === scopeId) ?? programs[0];
	const availability = useMemo(
		() => new Map(CHANNELS.map(({ surface }) => [surface, channelAvailability(devices, brandId, surface, now)])),
		[brandId, devices, now],
	);
	const readySurfaces = useMemo(
		() => CHANNELS.map(({ surface }) => surface).filter((surface) => availability.get(surface)?.ready),
		[availability],
	);
	const surfaces = surfaceSelectionOverride ?? readySurfaces;
	const taskCount = calculateSamplingRunNowTaskCount(selectedProgram?.promptCount ?? 0, surfaces.length);

	const toggleSurface = (surface: BrowserExtensionSurface, checked: boolean) => {
		setSurfaceSelectionOverride(
			checked
				? CHANNELS.map(({ surface: candidate }) => candidate).filter(
						(candidate) => candidate === surface || surfaces.includes(candidate),
					)
				: surfaces.filter((candidate) => candidate !== surface),
		);
	};

	const submit = async () => {
		if (!selectedProgram || surfaces.length === 0) return;
		const unavailableLabels = CHANNELS.filter(
			({ surface }) => surfaces.includes(surface) && !availability.get(surface)?.ready,
		).map(({ label }) => label);
		if (
			unavailableLabels.length > 0 &&
			!window.confirm(
				`${unavailableLabels.join(", ")} is not ready. Its tasks will wait in the queue for an administrator. Create this batch anyway?`,
			)
		) {
			return;
		}
		setSubmitting(true);
		setError(null);
		try {
			await onRun({
				brandId,
				scopeId: selectedProgram.id,
				surfaces,
				idempotencyKey: `run-now-${crypto.randomUUID()}`,
			});
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not start this domestic run.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Card className="border-primary/30">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<CirclePlay className="size-5" />
					Run now
				</CardTitle>
				<CardDescription>
					Run every enabled Prompt in a scored China Program. Five samples per Prompt and channel; no schedule is
					created.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-5">
				{programs.length === 0 ? (
					<Alert>
						<AlertTriangle />
						<AlertTitle>No eligible Program</AlertTitle>
						<AlertDescription>
							Create an enabled CN / zh-CN / Asia/Shanghai scored Program before starting a domestic run.
						</AlertDescription>
					</Alert>
				) : (
					<>
						<div className="grid gap-2">
							<Label htmlFor="run-now-program">Program</Label>
							<select
								id="run-now-program"
								className="h-9 w-full rounded-md border bg-background px-3 text-sm"
								value={selectedProgram?.id ?? ""}
								onChange={(event) => setScopeId(event.target.value)}
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

						<div className="space-y-3">
							<Label>Channels</Label>
							<div className="grid gap-3 sm:grid-cols-2">
								{CHANNELS.map(({ surface, label }) => {
									const channel = availability.get(surface);
									const checkboxId = `run-now-${surface.replaceAll(".", "-")}`;
									return (
										<Label
											key={surface}
											htmlFor={checkboxId}
											className="flex cursor-pointer items-start gap-3 rounded-md border p-3"
										>
											<Checkbox
												id={checkboxId}
												checked={surfaces.includes(surface)}
												onCheckedChange={(checked) => toggleSurface(surface, checked === true)}
											/>
											<span className="space-y-1">
												<span className="flex items-center gap-2 font-medium">
													{label}
													<Badge variant={channel?.ready ? "default" : "outline"}>{channel?.label}</Badge>
												</span>
												<span className="block text-xs text-muted-foreground">New conversation for every task</span>
											</span>
										</Label>
									);
								})}
							</div>
						</div>

						<div className="flex flex-col gap-3 rounded-md bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<p className="font-medium tabular-nums">
									{selectedProgram?.promptCount ?? 0} × {surfaces.length} × {FIXED_SAMPLES_PER_CHANNEL} = {taskCount}{" "}
									tasks
								</p>
								<p className="text-xs text-muted-foreground">
									An offline or signed-out device waits for an administrator; it does not count as a failed observation.
								</p>
							</div>
							<Button disabled={submitting || surfaces.length === 0 || taskCount === 0} onClick={submit}>
								{submitting && <Loader2 className="animate-spin" />}
								Run {taskCount.toLocaleString("en-US")} tasks now
							</Button>
						</div>
					</>
				)}
				{error && <p className="text-sm text-destructive">{error}</p>}
			</CardContent>
		</Card>
	);
}
