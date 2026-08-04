import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";
import { Footer } from "@/components/footer";
import { Logo } from "@/components/logo";
import { Navbar } from "@/components/navbar";
import { breadcrumbJsonLd, canonicalUrl, ogMeta } from "@/lib/seo";

const title = "Brand · Yonaris";
const description = "Download Yonaris wordmarks and app icons.";

export const Route = createFileRoute("/brand")({
	head: () => ({
		meta: [{ title }, { name: "description", content: description }, ...ogMeta({ title, description, path: "/brand" })],
		links: [{ rel: "canonical", href: canonicalUrl("/brand") }],
		scripts: [
			breadcrumbJsonLd([
				{ name: "Home", path: "/" },
				{ name: "Brand", path: "/brand" },
			]),
		],
	}),
	component: BrandPage,
});

const BRAND_COLOR = "#0A1A2A";

interface BrandAsset {
	label: string;
	filename: string;
	path: string;
	svgPath?: string;
	transparent?: boolean;
	preview: {
		bg: string;
		padding?: string;
	};
}

const icons: BrandAsset[] = [
	{
		label: "Icon",
		filename: "yonaris-icon-512.png",
		path: "/icons/yonaris-icon-512.png",
		svgPath: "/icons/yonaris-icon.svg",
		transparent: true,
		preview: { bg: "#ffffff" },
	},
	{
		label: "Maskable Icon",
		filename: "yonaris-icon-maskable-512.png",
		path: "/icons/yonaris-icon-maskable-512.png",
		svgPath: "/icons/yonaris-icon-maskable.svg",
		preview: { bg: "#F8F6F3" },
	},
];

const logos: BrandAsset[] = [
	{
		label: "Navy Wordmark",
		filename: "yonaris-wordmark-navy.png",
		path: "/brand/logos/yonaris-wordmark-navy.png",
		transparent: true,
		preview: { bg: "#ffffff", padding: "p-8" },
	},
	{
		label: "White Wordmark",
		filename: "yonaris-wordmark-white.png",
		path: "/brand/logos/yonaris-wordmark-white.png",
		preview: { bg: "#111827", padding: "p-8" },
	},
];

function DownloadButton({ href, label }: { href: string; label: string }) {
	return (
		<a
			href={href}
			download
			className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-zinc-950"
		>
			<Download className="size-3" />
			{label}
		</a>
	);
}

const CHECKERED_BG = {
	backgroundImage:
		"linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)",
	backgroundSize: "16px 16px",
	backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
};

function AssetCard({ asset }: { asset: BrandAsset }) {
	return (
		<div className="group overflow-hidden rounded-md border border-zinc-200 bg-white transition-shadow hover:shadow-md">
			<div
				className={`relative flex items-center justify-center overflow-hidden ${asset.preview.padding ?? "p-6"}`}
				style={{
					backgroundColor: asset.preview.bg,
					minHeight: 180,
					...(asset.transparent ? CHECKERED_BG : {}),
				}}
			>
				<img src={asset.path} alt={asset.label} className="max-h-28 max-w-full object-contain" loading="lazy" />
			</div>
			<div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3">
				<span className="text-sm font-medium text-zinc-950">{asset.label}</span>
				<div className="flex items-center gap-1.5">
					<DownloadButton href={asset.path} label="PNG" />
					{asset.svgPath && <DownloadButton href={asset.svgPath} label="SVG" />}
				</div>
			</div>
		</div>
	);
}

function ColorSwatch({ color, label, value }: { color: string; label: string; value: string }) {
	const [copied, setCopied] = useState(false);

	function handleCopy() {
		navigator.clipboard.writeText(value).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		});
	}

	return (
		<button
			type="button"
			onClick={handleCopy}
			className="group flex cursor-pointer items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-zinc-50"
		>
			<div
				className="size-12 shrink-0 rounded-md border border-zinc-200 shadow-sm"
				style={{ backgroundColor: color }}
			/>
			<div className="min-w-0 flex-1">
				<p className="text-sm font-medium text-zinc-950">{label}</p>
				<p className="flex items-center gap-1 font-mono text-xs text-zinc-500">
					{value}
					{copied ? (
						<Check className="size-3 text-emerald-500" />
					) : (
						<Copy className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
					)}
				</p>
			</div>
		</button>
	);
}

function BrandPage() {
	return (
		<div className="min-h-screen">
			<Navbar />
			<main className="mx-auto max-w-6xl px-4 py-12 md:px-6 lg:py-20">
				<header className="mb-16 space-y-4">
					<p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">/ BRAND</p>
					<h1 className="font-heading text-4xl text-zinc-950 lg:text-5xl">Brand Assets</h1>
					<p className="max-w-2xl text-lg text-balance text-zinc-600">
						Use these official Yonaris wordmarks and app icons in approved product, partner, and customer-facing
						materials.
					</p>
				</header>

				{/* Guidelines */}
				<section className="mb-16">
					<h2 className="mb-6 text-xl font-semibold text-zinc-950">Guidelines</h2>
					<div className="rounded-md border border-zinc-200 bg-white p-6">
						<div className="grid gap-6 sm:grid-cols-2">
							<div className="space-y-1">
								<p className="text-sm font-medium text-zinc-950">Do</p>
								<ul className="list-disc space-y-1 pl-4 text-sm text-zinc-600">
									<li>Use the provided assets without modification</li>
									<li>Maintain clear space around the logo</li>
									<li>Use on solid backgrounds with good contrast</li>
								</ul>
							</div>
							<div className="space-y-1">
								<p className="text-sm font-medium text-zinc-950">Don't</p>
								<ul className="list-disc space-y-1 pl-4 text-sm text-zinc-600">
									<li>Alter the colors, proportions, or orientation</li>
									<li>Add effects like shadows, outlines, or gradients</li>
									<li>Use the logo to imply endorsement without permission</li>
								</ul>
							</div>
						</div>
					</div>
				</section>

				{/* Colors */}
				<section className="mb-16">
					<h2 className="mb-6 text-xl font-semibold text-zinc-950">Colors</h2>
					<div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
						<ColorSwatch color={BRAND_COLOR} label="Yonaris Navy" value="#0A1A2A" />
						<ColorSwatch color="#F8F6F3" label="Yonaris Warm White" value="#F8F6F3" />
					</div>
				</section>

				{/* Icons */}
				<section className="mb-16">
					<div className="mb-6 flex items-center justify-between">
						<h2 className="text-xl font-semibold text-zinc-950">Icons</h2>
						<span className="font-mono text-[11px] text-zinc-500">512 × 512px</span>
					</div>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{icons.map((asset) => (
							<AssetCard key={asset.filename} asset={asset} />
						))}
					</div>
				</section>

				{/* Logos */}
				<section className="mb-16">
					<div className="mb-6 flex items-center justify-between">
						<h2 className="text-xl font-semibold text-zinc-950">Wordmark</h2>
						<span className="font-mono text-[11px] text-zinc-500">278 × 67px</span>
					</div>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{logos.map((asset) => (
							<AssetCard key={asset.filename} asset={asset} />
						))}
					</div>
				</section>

				{/* Typography */}
				<section className="mb-16">
					<h2 className="mb-6 text-xl font-semibold text-zinc-950">Typography</h2>
					<div className="grid gap-6 sm:grid-cols-2">
						<div className="rounded-md border border-zinc-200 bg-white p-6">
							<Logo className="h-10" />
							<p className="mt-3 text-sm font-medium text-zinc-950">Yonaris Wordmark</p>
							<p className="text-xs text-zinc-500">Use the supplied artwork without recreating it as text.</p>
						</div>
						<a
							href="https://vercel.com/font"
							target="_blank"
							rel="noopener noreferrer"
							className="group rounded-md border border-zinc-200 bg-white p-6 transition-colors hover:bg-zinc-50"
						>
							<p className="text-4xl font-semibold tracking-tight text-zinc-950">Geist Sans</p>
							<p className="mt-3 text-sm font-medium text-zinc-950 group-hover:text-blue-600">Geist Sans</p>
							<p className="text-xs text-zinc-500">Used for body text, headings, and UI elements</p>
						</a>
					</div>
				</section>

				{/* CTA */}
				<div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
					<h3 className="text-lg font-semibold text-zinc-950">Need something else?</h3>
					<p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
						Use the provided assets as-is. Contact the Yonaris team internally if another format or size is required.
					</p>
				</div>
			</main>
			<Footer />
		</div>
	);
}
