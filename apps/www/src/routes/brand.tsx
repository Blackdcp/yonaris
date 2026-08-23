import { createFileRoute } from "@tanstack/react-router";
import { Copy, Download } from "lucide-react";
import { useState } from "react";
import { UtilityShell } from "@/components/site/utility-shell";
import { YONARIS_VI_SWATCHES } from "@/lib/brand-assets";
import { breadcrumbJsonLd } from "@/lib/seo";
import { siteRouteHead } from "@/lib/site-seo";

const title = "Brand Resources · Yonaris";
const description = "Official Yonaris visual identity tokens, wordmarks, and application icons.";

export const Route = createFileRoute("/brand")({
	head: () => ({
		...siteRouteHead("brand", { canonicalPath: "/brand", title, description }),
		scripts: [
			breadcrumbJsonLd([
				{ name: "Home", path: "/" },
				{ name: "Brand", path: "/brand" },
			]),
		],
	}),
	component: BrandPage,
});

type CopyState = "idle" | "copied" | "failed";

interface BrandAsset {
	label: string;
	path: string;
	svgPath?: string;
	kind: "wordmark" | "icon";
	preview: "paper" | "ink" | "transparent";
}

const assets: BrandAsset[] = [
	{
		label: "Ink wordmark",
		path: "/brand/logos/yonaris-wordmark-navy.png",
		kind: "wordmark",
		preview: "transparent",
	},
	{
		label: "Paper wordmark",
		path: "/brand/logos/yonaris-wordmark-white.png",
		kind: "wordmark",
		preview: "ink",
	},
	{
		label: "Application icon",
		path: "/icons/yonaris-icon-512.png",
		svgPath: "/icons/yonaris-icon.svg",
		kind: "icon",
		preview: "transparent",
	},
	{
		label: "Maskable application icon",
		path: "/icons/yonaris-icon-maskable-512.png",
		svgPath: "/icons/yonaris-icon-maskable.svg",
		kind: "icon",
		preview: "paper",
	},
];

function CopySwatch({ label, value }: { label: string; value: string }) {
	const [state, setState] = useState<CopyState>("idle");

	async function copyValue() {
		try {
			if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
			await navigator.clipboard.writeText(value);
			setState("copied");
		} catch {
			setState("failed");
		}
	}

	return (
		<div className="utility-brand-swatch" style={{ "--swatch": value } as React.CSSProperties}>
			<div className="utility-brand-swatch__color" aria-hidden="true" />
			<div>
				<strong>{label}</strong>
				<code>{value}</code>
			</div>
			<button type="button" className="utility-action" onClick={copyValue} aria-label={`Copy ${label} ${value}`}>
				<Copy aria-hidden="true" className="size-3.5" />
				Copy
			</button>
			<span className="utility-brand-copy-status" aria-live="polite">
				{state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : ""}
			</span>
		</div>
	);
}

function DownloadLink({ href, children }: { href: string; children: React.ReactNode }) {
	return (
		<a className="utility-action" href={href} download>
			<Download aria-hidden="true" className="size-3.5" />
			{children}
		</a>
	);
}

function AssetRow({ asset }: { asset: BrandAsset }) {
	return (
		<article className="utility-brand-asset" data-brand-asset={asset.kind}>
			<div
				className={`utility-brand-asset__preview${asset.preview === "ink" ? " utility-brand-asset__preview--ink" : ""}`}
				data-brand-preview={asset.preview}
			>
				<img src={asset.path} alt={`${asset.label} preview`} loading="lazy" />
			</div>
			<div className="utility-brand-asset__meta">
				<strong>{asset.label}</strong>
				<div>
					<DownloadLink href={asset.path}>PNG</DownloadLink>
					{asset.svgPath ? <DownloadLink href={asset.svgPath}>SVG</DownloadLink> : null}
				</div>
			</div>
		</article>
	);
}

function BrandPage() {
	return (
		<UtilityShell section="brand">
			<div className="utility-page utility-brand-page">
				<header className="utility-masthead">
					<div className="utility-masthead__grid">
						<div>
							<p className="utility-kicker">Yonaris visual identity</p>
							<h1 className="utility-title">Brand resources</h1>
							<p className="utility-deck">{description}</p>
						</div>
						<p className="utility-context-note">
							Use supplied artwork without changing its proportions, color, orientation, or clear space.
						</p>
					</div>
				</header>

				<div className="utility-content">
					<section className="utility-brand-section" aria-labelledby="brand-palette-heading">
						<h2 id="brand-palette-heading">Color system</h2>
						<div className="utility-brand-palette">
							{YONARIS_VI_SWATCHES.map((swatch) => (
								<CopySwatch key={swatch.key} label={swatch.label} value={swatch.value} />
							))}
						</div>
					</section>

					<section className="utility-brand-section" aria-labelledby="brand-assets-heading">
						<h2 id="brand-assets-heading">Approved artwork</h2>
						<div className="utility-brand-assets">
							{assets.map((asset) => (
								<AssetRow key={asset.path} asset={asset} />
							))}
						</div>
					</section>

					<section className="utility-brand-section" aria-labelledby="brand-use-heading">
						<h2 id="brand-use-heading">Use</h2>
						<div className="utility-brand-guidance">
							<p>Yonaris is an AI-native MarTech company. The wordmark is supplied as artwork, not recreated text.</p>
							<p>Signal Orange is reserved for action, active state, and focus. Keep applications restrained.</p>
						</div>
					</section>
				</div>
			</div>
		</UtilityShell>
	);
}
