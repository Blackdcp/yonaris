import { useState } from "react";
import type { CustomerPromptRunDto } from "@/server/customer-data-dto";

type ResponseSnapshot = NonNullable<CustomerPromptRunDto["snapshot"]>;

const SOURCE_LABELS: Record<NonNullable<ResponseSnapshot["contentSource"]>, string> = {
	native_answer_html: "Provider answer HTML",
	browser_answer_html: "Browser answer HTML",
	rendered_from_structured_response: "Rendered structured response",
	reconstructed_from_historical_run: "Historical reconstruction",
};

const STATE_MESSAGES: Partial<Record<ResponseSnapshot["status"], string>> = {
	pending: "Snapshot is being prepared",
	failed: "Snapshot is unavailable",
	expired: "Snapshot has expired",
};

function formatBeijingDate(value: string) {
	return new Intl.DateTimeFormat("en-CA", {
		dateStyle: "medium",
		timeStyle: "short",
		timeZone: "Asia/Shanghai",
	}).format(new Date(value));
}

function assetUrl(snapshotId: string, asset: "html" | "json" | "manifest" | "screenshot", download: boolean) {
	return `/api/app/response-snapshots/${encodeURIComponent(snapshotId)}?asset=${asset}&download=${download ? 1 : 0}`;
}

type ExportEstimate = {
	count: number;
	uncompressedBytes: number;
	startDate: string;
	endDate: string;
};

export function ResponseSnapshotExportControls({ brandId, initialDate }: { brandId: string; initialDate?: string }) {
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
			const payload = (await response.json()) as ExportEstimate & { message?: string };
			if (!response.ok) throw new Error(payload.message ?? "Could not estimate the export");
			setEstimate(payload);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not estimate the export");
		} finally {
			setLoading(false);
		}
	};

	return (
		<section className="space-y-3 rounded-lg border bg-muted/20 p-4" aria-label="Export response snapshots">
			<div>
				<h3 className="text-sm font-medium">Export response snapshots</h3>
				<p className="text-xs text-muted-foreground">
					Download the archived HTML, JSON and manifest files. Up to 31 days and 2 GiB per ZIP.
				</p>
			</div>
			<div className="flex flex-wrap items-end gap-3">
				<label className="grid gap-1 text-xs text-muted-foreground">
					Start date (Beijing)
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
					End date (Beijing)
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
					{loading ? "Estimating…" : "Estimate export"}
				</button>
				{estimate && estimate.count > 0 && (
					<a
						className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
						href={url("download")}
					>
						Download ZIP
					</a>
				)}
			</div>
			<div className="text-xs text-muted-foreground" aria-live="polite">
				{error && <span className="text-destructive">{error}</span>}
				{estimate &&
					(estimate.count > 0
						? `${estimate.count.toLocaleString()} snapshots · ${formatBytes(estimate.uncompressedBytes)} before ZIP compression`
						: "No ready snapshots are available in this date range.")}
			</div>
		</section>
	);
}

export function ResponseSnapshotPanel({ snapshot, channel }: { snapshot: ResponseSnapshot; channel: string }) {
	const stateMessage = STATE_MESSAGES[snapshot.status];

	return (
		<section className="space-y-3 rounded-md border bg-background p-4" aria-label="Response snapshot">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div>
					<h4 className="text-sm font-medium">Response snapshot</h4>
					<p className="text-xs text-muted-foreground">
						{snapshot.contentSource ? SOURCE_LABELS[snapshot.contentSource] : "Preparing"} · {channel}
					</p>
				</div>
				<p className="text-xs text-muted-foreground">
					Retained until {formatBeijingDate(snapshot.expiresAt)} (Beijing)
				</p>
			</div>

			{snapshot.status !== "ready" ? (
				<p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
					{stateMessage ?? "Snapshot is unavailable"}
				</p>
			) : (
				<>
					{snapshot.visualEvidence && (
						<figure className="space-y-2 rounded-md border bg-muted/20 p-3">
							<figcaption className="text-sm font-medium">Captured browser evidence</figcaption>
							<img
								src={assetUrl(snapshot.id, "screenshot", false)}
								alt={`Captured browser evidence for ${channel}`}
								loading="lazy"
								className="max-h-[32rem] w-auto max-w-full rounded-md border bg-white"
							/>
							<p className="text-xs text-muted-foreground">
								Screenshot SHA-256: <code className="break-all text-foreground">{snapshot.visualEvidence.sha256}</code>
							</p>
						</figure>
					)}
					<iframe
						title={`Archived response from ${channel}`}
						src={assetUrl(snapshot.id, "html", false)}
						sandbox=""
						referrerPolicy="no-referrer"
						loading="lazy"
						className="h-80 w-full rounded-md border bg-white"
					/>
					<div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
						<p>
							HTML SHA-256: <code className="break-all text-foreground">{snapshot.htmlSha256 ?? "Unavailable"}</code>
						</p>
						<p>
							JSON SHA-256: <code className="break-all text-foreground">{snapshot.jsonSha256 ?? "Unavailable"}</code>
						</p>
					</div>
					<div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
						{snapshot.visualEvidence && (
							<a className="underline underline-offset-4" href={assetUrl(snapshot.id, "screenshot", true)}>
								Download screenshot
							</a>
						)}
						<a className="underline underline-offset-4" href={assetUrl(snapshot.id, "html", true)}>
							Download HTML
						</a>
						<a className="underline underline-offset-4" href={assetUrl(snapshot.id, "json", true)}>
							Download JSON
						</a>
						<a className="underline underline-offset-4" href={assetUrl(snapshot.id, "manifest", true)}>
							Download manifest
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

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
}
