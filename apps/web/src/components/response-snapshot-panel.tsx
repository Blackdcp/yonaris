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

function assetUrl(snapshotId: string, asset: "html" | "json" | "manifest", download: boolean) {
	return `/api/app/response-snapshots/${encodeURIComponent(snapshotId)}?asset=${asset}&download=${download ? 1 : 0}`;
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
