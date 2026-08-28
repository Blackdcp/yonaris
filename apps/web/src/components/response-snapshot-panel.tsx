import { useState } from "react";
import type { MessageId } from "@/i18n/catalog";
import { useI18n } from "@/i18n/provider";
import type { CustomerPromptRunDto } from "@/server/customer-data-dto";

type ResponseSnapshot = NonNullable<CustomerPromptRunDto["snapshot"]>;

const SOURCE_LABELS: Record<NonNullable<ResponseSnapshot["contentSource"]>, MessageId> = {
	native_answer_html: "snapshot.source.nativeHtml",
	browser_answer_html: "snapshot.source.browserHtml",
	rendered_from_structured_response: "snapshot.source.renderedStructured",
	reconstructed_from_historical_run: "snapshot.source.historical",
};

const STATE_MESSAGES: Partial<Record<ResponseSnapshot["status"], MessageId>> = {
	pending: "snapshot.state.pending",
	failed: "snapshot.state.failed",
	expired: "snapshot.state.expired",
};

function assetUrl(
	snapshotId: string,
	asset: "html" | "json" | "manifest" | "screenshot",
	download: boolean,
	artifactId?: string,
) {
	const params = new URLSearchParams({ asset, download: download ? "1" : "0" });
	if (artifactId) params.set("artifactId", artifactId);
	return `/api/app/response-snapshots/${encodeURIComponent(snapshotId)}?${params.toString()}`;
}

type ExportEstimate = {
	count: number;
	uncompressedBytes: number;
	startDate: string;
	endDate: string;
};

export function ResponseSnapshotExportControls({ brandId, initialDate }: { brandId: string; initialDate?: string }) {
	const { t, formatNumber } = useI18n();
	const endDefault = initialDate ?? beijingToday();
	const [startDate, setStartDate] = useState(() => shiftIsoDate(endDefault, -30));
	const [endDate, setEndDate] = useState(endDefault);
	const [estimate, setEstimate] = useState<ExportEstimate | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const url = (mode: "estimate" | "download") => {
		const params = new URLSearchParams({ brandId, start: startDate, end: endDate, mode });
		return `/api/app/response-snapshots/export?${params.toString()}`;
	};
	const estimateExport = async () => {
		setLoading(true);
		setError(null);
		setEstimate(null);
		try {
			const response = await fetch(url("estimate"), { headers: { Accept: "application/json" } });
			const payload = (await response.json()) as ExportEstimate;
			if (!response.ok) throw new Error("export-estimate-failed");
			setEstimate(payload);
		} catch {
			setError(t("snapshot.estimateError"));
		} finally {
			setLoading(false);
		}
	};

	return (
		<section className="space-y-3 rounded-lg border bg-muted/20 p-4" aria-label={t("snapshot.export")}>
			<div>
				<h3 className="text-sm font-medium">{t("snapshot.export")}</h3>
				<p className="text-xs text-muted-foreground">{t("snapshot.exportDescription")}</p>
			</div>
			<div className="flex flex-wrap items-end gap-3">
				<label className="grid gap-1 text-xs text-muted-foreground">
					{t("snapshot.startDate")}
					<input
						type="date"
						value={startDate}
						max={endDefault}
						onChange={(event) => {
							setStartDate(event.currentTarget.value);
							setEstimate(null);
						}}
						className="rounded-md border bg-background px-3 py-2 text-sm text-foreground"
					/>
				</label>
				<label className="grid gap-1 text-xs text-muted-foreground">
					{t("snapshot.endDate")}
					<input
						type="date"
						value={endDate}
						max={endDefault}
						onChange={(event) => {
							setEndDate(event.currentTarget.value);
							setEstimate(null);
						}}
						className="rounded-md border bg-background px-3 py-2 text-sm text-foreground"
					/>
				</label>
				<button
					type="button"
					onClick={() => void estimateExport()}
					disabled={loading}
					className="rounded-md border bg-background px-3 py-2 text-sm font-medium disabled:opacity-50"
				>
					{loading ? t("snapshot.estimating") : t("snapshot.estimate")}
				</button>
				{estimate && estimate.count > 0 && (
					<a
						className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
						href={url("download")}
					>
						{t("snapshot.downloadZip")}
					</a>
				)}
			</div>
			<div className="text-xs text-muted-foreground" aria-live="polite">
				{error && <span className="text-destructive">{error}</span>}
				{estimate &&
					(estimate.count > 0
						? t("snapshot.exportCount", {
								count: formatNumber(estimate.count),
								size: formatBytes(estimate.uncompressedBytes, formatNumber),
							})
						: t("snapshot.exportEmpty"))}
			</div>
		</section>
	);
}

export function ResponseSnapshotPanel({ snapshot, channel }: { snapshot: ResponseSnapshot; channel: string }) {
	const { t, formatDate } = useI18n();
	const stateMessage = STATE_MESSAGES[snapshot.status];
	const expiresAt = formatDate(new Date(snapshot.expiresAt), {
		dateStyle: "medium",
		timeStyle: "short",
		timeZone: "Asia/Shanghai",
	});
	const evidence = snapshot.visualEvidence;
	const v3 = snapshot.schemaVersion === "response-snapshot.v3";
	const evidenceUrl = (artifactId: string, download: boolean) =>
		assetUrl(snapshot.id, "screenshot", download, v3 ? artifactId : undefined);

	return (
		<section className="space-y-3 rounded-md border bg-background p-4" aria-label={t("snapshot.title")}>
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div>
					<h4 className="text-sm font-medium">{t("snapshot.title")}</h4>
					<p className="text-xs text-muted-foreground">
						{snapshot.contentSource ? t(SOURCE_LABELS[snapshot.contentSource]) : t("snapshot.preparing")} · {channel}
					</p>
				</div>
				<p className="text-xs text-muted-foreground">
					{t("snapshot.retainedUntil", { date: expiresAt })} ({t("snapshot.beijing")})
				</p>
			</div>

			{snapshot.status !== "ready" ? (
				<p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
					{t(stateMessage ?? "snapshot.state.failed")}
				</p>
			) : (
				<>
					{evidence && (
						<figure className="space-y-3 rounded-md border bg-muted/20 p-3">
							<figcaption className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
								<span>{t("snapshot.browserEvidence")}</span>
								<span className="text-xs font-normal text-muted-foreground">
									{t(`snapshot.evidence.${evidence.status}` as MessageId, {
										captured: evidence.capturedSegmentCount,
										expected: evidence.expectedSegmentCount,
									})}
								</span>
							</figcaption>

							{evidence.status === "complete" && evidence.primary && (
								<>
									<img
										src={evidenceUrl(evidence.primary.artifactId, false)}
										alt={t("snapshot.visualAlt", { channel })}
										loading="lazy"
										className="max-h-[48rem] w-auto max-w-full rounded-md border bg-white object-contain object-top"
									/>
									<p className="text-xs text-muted-foreground">
										{t("snapshot.screenshotHash")}:{" "}
										<code className="break-all text-foreground">{evidence.primary.sha256}</code>
									</p>
								</>
							)}

							{evidence.status === "unavailable" && (
								<p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
									{t("snapshot.evidenceUnavailableDescription")}
								</p>
							)}

							{evidence.segments.length > 0 && (
								<details open={evidence.status === "partial"} className="space-y-2">
									<summary className="cursor-pointer text-sm font-medium">
										{t("snapshot.evidenceSegments", { count: evidence.segments.length })}
									</summary>
									<div className="grid gap-3 sm:grid-cols-2">
										{evidence.segments.map((segment, index) => (
											<div key={segment.artifactId} className="space-y-2 rounded-md border bg-background p-2">
												<img
													src={evidenceUrl(segment.artifactId, false)}
													alt={t("snapshot.segmentAlt", { channel, index: index + 1 })}
													loading="lazy"
													className="max-h-[32rem] w-auto max-w-full rounded border bg-white object-contain object-top"
												/>
												<a
													className="text-xs underline underline-offset-4"
													href={evidenceUrl(segment.artifactId, true)}
												>
													{t("snapshot.downloadEvidencePart", { index: index + 1 })}
												</a>
											</div>
										))}
									</div>
								</details>
							)}
						</figure>
					)}
					<iframe
						title={t("snapshot.archivedTitle", { channel })}
						src={assetUrl(snapshot.id, "html", false)}
						sandbox=""
						referrerPolicy="no-referrer"
						loading="lazy"
						className="h-80 w-full rounded-md border bg-white"
					/>
					<div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
						<p>
							{t("snapshot.htmlHash")}:{" "}
							<code className="break-all text-foreground">{snapshot.htmlSha256 ?? t("snapshot.hashUnavailable")}</code>
						</p>
						<p>
							{t("snapshot.jsonHash")}:{" "}
							<code className="break-all text-foreground">{snapshot.jsonSha256 ?? t("snapshot.hashUnavailable")}</code>
						</p>
					</div>
					<div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
						{evidence?.primary && (
							<a className="underline underline-offset-4" href={evidenceUrl(evidence.primary.artifactId, true)}>
								{t("snapshot.downloadScreenshot")}
							</a>
						)}
						<a className="underline underline-offset-4" href={assetUrl(snapshot.id, "html", true)}>
							{t("snapshot.downloadHtml")}
						</a>
						<a className="underline underline-offset-4" href={assetUrl(snapshot.id, "json", true)}>
							{t("snapshot.downloadJson")}
						</a>
						<a className="underline underline-offset-4" href={assetUrl(snapshot.id, "manifest", true)}>
							{t("snapshot.downloadManifest")}
						</a>
					</div>
				</>
			)}
		</section>
	);
}

function beijingToday(): string {
	return new Date(Date.now() + 8 * 60 * 60 * 1_000).toISOString().slice(0, 10);
}

function shiftIsoDate(value: string, days: number): string {
	const date = new Date(`${value}T00:00:00.000Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

function formatBytes(
	bytes: number,
	formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
): string {
	if (bytes < 1024) return `${formatNumber(bytes)} B`;
	if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, { maximumFractionDigits: 1 })} KiB`;
	if (bytes < 1024 * 1024 * 1024) return `${formatNumber(bytes / (1024 * 1024), { maximumFractionDigits: 1 })} MiB`;
	return `${formatNumber(bytes / (1024 * 1024 * 1024), { maximumFractionDigits: 2 })} GiB`;
}
