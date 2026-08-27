import type {
	BrowserExtensionReadinessStatus,
	BrowserExtensionSurface,
} from "@workspace/lib/browser-extension-contract";
import {
	BROWSER_EXTENSION_SURFACE_DEFINITIONS,
	BROWSER_EXTENSION_SURFACES,
} from "@workspace/lib/browser-extension-surfaces";
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Label } from "@workspace/ui/components/label";
import { AlertTriangle, CirclePlay, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { LocalizedRawDetail } from "@/components/localized-raw-detail";
import type { LocalizedMessage, MessageId } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import type { BrowserRunnerDeviceView, SamplingRunNowInput, SamplingRunNowProgram } from "./types";

const FIXED_SAMPLES_PER_CHANNEL = 1;
const DEVICE_ONLINE_WINDOW_MS = 2 * 60 * 1_000;

const CHANNELS: ReadonlyArray<{ surface: BrowserExtensionSurface; label: string }> =
	BROWSER_EXTENSION_SURFACE_DEFINITIONS.map(({ key, label }) => ({ surface: key, label }));

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
): { ready: boolean; label: MessageId; status?: BrowserExtensionReadinessStatus } {
	const eligible = devices.filter(
		(device) => device.allowedBrandIds.includes(brandId) && device.supportedSurfaces.includes(surface),
	);
	const online = eligible.filter((device) => browserRunnerDeviceIsOnline(device, now));
	if (online.some((device) => device.readiness[surface]?.status === "ready")) {
		return { ready: true, label: "sampling.readiness.ready" };
	}
	const status = online.map((device) => device.readiness[surface]?.status).find((value) => value !== undefined);
	if (!status) return { ready: false, label: "sampling.readiness.offlineQueue" };
	return { ready: false, label: readinessLabel(status), status };
}

function readinessLabel(status: BrowserExtensionReadinessStatus): MessageId {
	switch (status) {
		case "signed_out":
			return "sampling.readiness.signedOutQueue";
		case "paused_by_risk_control":
			return "sampling.readiness.riskPausedQueue";
		case "adapter_incompatible":
			return "sampling.readiness.pageChangedQueue";
		case "unavailable":
			return "sampling.readiness.unavailableQueue";
		case "ready":
			return "sampling.readiness.ready";
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
	const { t, formatList, formatNumber } = useI18n();
	const [scopeId, setScopeId] = useState(programs[0]?.id ?? "");
	const [surfaceSelectionOverride, setSurfaceSelectionOverride] = useState<BrowserExtensionSurface[] | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<LocalizedMessage | null>(null);
	const selectedProgram = programs.find((program) => program.id === scopeId) ?? programs[0];
	const availability = useMemo(
		() => new Map(CHANNELS.map(({ surface }) => [surface, channelAvailability(devices, brandId, surface, now)])),
		[brandId, devices, now],
	);
	const surfaces = surfaceSelectionOverride ?? [...BROWSER_EXTENSION_SURFACES];
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
			!window.confirm(t("sampling.run.confirmUnavailable", { channels: formatList(unavailableLabels) }))
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
				samplesPerPrompt: FIXED_SAMPLES_PER_CHANNEL,
				idempotencyKey: `run-now-${crypto.randomUUID()}`,
			});
		} catch (caught) {
			setError({ id: "sampling.run.error", detail: caught instanceof Error ? caught.message : undefined });
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Card className="border-primary/30">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<CirclePlay className="size-5" />
					{t("sampling.run.title")}
				</CardTitle>
				<CardDescription>{t("sampling.run.description")}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-5">
				{programs.length === 0 ? (
					<Alert>
						<AlertTriangle />
						<AlertTitle>{t("sampling.run.noProgram")}</AlertTitle>
						<AlertDescription>{t("sampling.run.noProgramDescription")}</AlertDescription>
					</Alert>
				) : (
					<>
						<div className="grid gap-2">
							<Label htmlFor="run-now-program">{t("sampling.run.program")}</Label>
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
								{t("sampling.run.allPrompts", {
									count: formatNumber(selectedProgram?.promptCount ?? 0),
									timezone: selectedProgram?.timezone ?? "",
								})}
							</p>
						</div>

						<div className="space-y-3">
							<Label>{t("sampling.run.channels")}</Label>
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
													<Badge variant={channel?.ready ? "default" : "outline"}>
														{channel ? t(channel.label) : null}
													</Badge>
												</span>
												<span className="block text-xs text-muted-foreground">{t("sampling.run.newConversation")}</span>
											</span>
										</Label>
									);
								})}
							</div>
						</div>

						<div className="flex flex-col gap-3 rounded-md bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<p className="font-medium tabular-nums">
									{t("sampling.run.taskCount", {
										prompts: selectedProgram?.promptCount ?? 0,
										channels: surfaces.length,
										samples: FIXED_SAMPLES_PER_CHANNEL,
										tasks: taskCount,
									})}
								</p>
								<p className="text-xs text-muted-foreground">{t("sampling.run.offlineNote")}</p>
							</div>
							<Button disabled={submitting || surfaces.length === 0 || taskCount === 0} onClick={submit}>
								{submitting && <Loader2 className="animate-spin" />}
								{t("sampling.run.submit", { count: formatNumber(taskCount) })}
							</Button>
						</div>
					</>
				)}
				{error && (
					<Alert variant="destructive">
						<AlertTitle>{t(error.id, error.values)}</AlertTitle>
						{error.detail && (
							<AlertDescription>
								<LocalizedRawDetail labelId="sampling.raw.errorDetails" detail={error.detail} />
							</AlertDescription>
						)}
					</Alert>
				)}
			</CardContent>
		</Card>
	);
}
