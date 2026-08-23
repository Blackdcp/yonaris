import {
	PROVIDER_FILTER_LABELS,
	PROVIDER_FILTER_ORDER,
	parseTarget,
	passRate,
	providerCategory,
	type TargetStatus,
} from "./status-helpers";

export function renderStatusOgImage(data: TargetStatus[]) {
	const populated = data.filter((target) => target.entries.length > 0);
	const providers = PROVIDER_FILTER_ORDER.filter((provider) =>
		populated.some((target) => providerCategory(parseTarget(target.target).provider) === provider),
	);
	const providerStats = providers.map((provider) => ({
		label: PROVIDER_FILTER_LABELS[provider] ?? provider,
		rate: passRate(populated.filter((target) => providerCategory(parseTarget(target.target).provider) === provider)),
	}));
	const waiting = populated.length === 0;

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				width: "100%",
				height: "100%",
				backgroundColor: "#F6F4F1",
				color: "#0B1220",
				fontFamily: "Geist Sans",
				padding: "60px 64px",
			}}
		>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
				<div style={{ display: "flex", fontSize: 46, fontWeight: 500 }}>Yonaris</div>
				<div style={{ display: "flex", color: "#2F3E50", fontSize: 20, letterSpacing: 4 }}>
					PERIODIC PROVIDER CHECKS
				</div>
			</div>

			<div style={{ display: "flex", width: 56, height: 6, marginTop: 54, backgroundColor: "#FF6A00" }} />
			<div style={{ display: "flex", marginTop: 24, fontSize: 62, fontWeight: 500, lineHeight: 1.05 }}>
				{waiting ? "Waiting for check data" : "Periodic provider checks"}
			</div>
			<div style={{ display: "flex", marginTop: 16, color: "#1E2A39", fontSize: 27 }}>
				{waiting
					? "No service-level claim · evidence has not loaded"
					: "7-day check pass rate · sampled every six hours"}
			</div>

			<div style={{ display: "flex", flexWrap: "wrap", marginTop: 48 }}>
				{providerStats.map((provider) => (
					<div
						key={provider.label}
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							width: 330,
							marginRight: 16,
							marginBottom: 16,
							borderTop: "2px solid #0B1220",
							paddingTop: 18,
							paddingBottom: 12,
						}}
					>
						<div style={{ display: "flex", color: "#2F3E50", fontSize: 23 }}>{provider.label}</div>
						<div style={{ display: "flex", fontSize: 36, fontWeight: 500 }}>
							{provider.rate === null ? "—" : `${Math.round(provider.rate)}%`}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
