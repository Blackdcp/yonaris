import { createFileRoute } from "@tanstack/react-router";
import { UtilityShell } from "@/components/site/utility-shell";
import { breadcrumbJsonLd } from "@/lib/seo";
import { siteRouteHead } from "@/lib/site-seo";
import { getStatusData } from "@/lib/status";
import {
	dedupeEntries,
	formatLatency,
	formatModel,
	formatProvider,
	parseTarget,
	passRate,
	type TargetStatus,
} from "@/lib/status-helpers";

const title = "Periodic Provider Checks · Yonaris";
const description =
	"Evidence from periodic provider checks sampled every six hours, with a seven-day check pass rate. This is not a service-level report.";

export const Route = createFileRoute("/status")({
	head: () => ({
		...siteRouteHead("status", {
			canonicalPath: "/status",
			title,
			description,
			image: "/og/status.png",
		}),
		scripts: [
			breadcrumbJsonLd([
				{ name: "Home", path: "/" },
				{ name: "Status", path: "/status" },
			]),
		],
	}),
	loader: () => getStatusData(),
	component: StatusPage,
});

function formatCheckTime(timestamp: string): string {
	return new Date(timestamp).toLocaleString("en", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		timeZoneName: "short",
	});
}

function StatusPage() {
	const data = Route.useLoaderData() as TargetStatus[];
	const populated = data.filter((target) => target.entries.length > 0);
	const overallRate = passRate(populated);

	return (
		<UtilityShell section="status">
			<div className="utility-page">
				<header className="utility-masthead">
					<div className="utility-masthead__grid">
						<div>
							<p className="utility-kicker">Periodic provider evidence</p>
							<h1 className="utility-title">Provider check ledger</h1>
							<p className="utility-deck">
								Periodic checks run every six hours. The record below reports observed responses and a 7-day check pass
								rate; it is not a service-level report.
							</p>
						</div>
						<div className="utility-context-note">
							<strong>7-day check pass rate</strong>
							<span>{overallRate === null ? "Waiting for evidence" : `${Math.round(overallRate)}%`}</span>
						</div>
					</div>
				</header>

				<section className="utility-status-ledger" aria-label="Provider check history">
					{populated.length === 0 ? (
						<div className="utility-status-empty">
							<h2>Check history is unavailable here right now</h2>
							<p>No result is inferred while the evidence store cannot be read. Please check again later.</p>
						</div>
					) : (
						populated.map((target) => {
							const { model, provider } = parseTarget(target.target);
							const entries = dedupeEntries(target.entries);
							const latest = entries.at(-1);
							const rate = passRate([target]);

							return (
								<article key={target.target} className="utility-status-panel">
									<header className="utility-status-panel__header">
										<div>
											<p className="utility-activity-entry__meta">{formatProvider(provider)}</p>
											<h2>{formatModel(model)}</h2>
										</div>
										<dl className="utility-status-metrics">
											<div>
												<dt>7-day check pass rate</dt>
												<dd>{rate === null ? "—" : `${Math.round(rate)}%`}</dd>
											</div>
											<div>
												<dt>Latest observed response</dt>
												<dd>{latest ? formatLatency(latest.latency) : "—"}</dd>
											</div>
										</dl>
									</header>
									<ul className="utility-status-history" aria-label={`${formatModel(model)} recent check results`}>
										{entries.map((entry) => (
											<li
												key={entry.ts}
												data-result={entry.status}
												title={`${entry.status === "pass" ? "Passed" : "Failed"} — ${formatCheckTime(entry.ts)}`}
											>
												<span className="sr-only">
													{entry.status === "pass" ? "Passed" : "Failed"} at {formatCheckTime(entry.ts)}
												</span>
											</li>
										))}
									</ul>
								</article>
							);
						})
					)}
				</section>
			</div>
		</UtilityShell>
	);
}
