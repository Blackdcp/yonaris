import { DOCS_IDENTITY_DISCLOSURE } from "./docs-context";

export function renderDocsOgImage(title: string) {
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
				padding: "64px 72px",
			}}
		>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
				<div style={{ display: "flex", fontSize: 46, fontWeight: 500 }}>Yonaris</div>
				<div style={{ display: "flex", color: "#2F3E50", fontSize: 20, letterSpacing: 4 }}>
					OPEN-SOURCE DOCUMENTATION
				</div>
			</div>
			<div style={{ display: "flex", width: 56, height: 6, marginTop: 68, backgroundColor: "#FF6A00" }} />
			<div style={{ display: "flex", marginTop: 28, fontSize: 68, fontWeight: 500, lineHeight: 1.03 }}>{title}</div>
			<div
				style={{
					display: "flex",
					maxWidth: 980,
					marginTop: 28,
					borderTop: "2px solid #0B1220",
					paddingTop: 22,
					color: "#1E2A39",
					fontSize: 26,
					lineHeight: 1.4,
				}}
			>
				{DOCS_IDENTITY_DISCLOSURE}
			</div>
		</div>
	);
}
