import { Link } from "@tanstack/react-router";
import { externalRel } from "@/lib/external-link";
import { Logo } from "./logo";

const cols = [
	{
		heading: "Product",
		links: [
			{ label: "Features", href: "/features" },
			{ label: "Pricing", href: "/pricing" },
			{ label: "Provider Status", href: "/status" },
		],
	},
	{
		heading: "Resources",
		links: [
			{ label: "Documentation", href: "/docs" },
			{ label: "API Reference", href: "/docs/api" },
			{
				label: "Upstream issues",
				href: "https://github.com/elmohq/elmo/issues",
				external: true,
			},
		],
	},
	{
		heading: "Learn",
		links: [
			{ label: "AEO Glossary", href: "/glossary" },
			{ label: "AI Search Guides", href: "/ai-search" },
			{ label: "AEO by Industry", href: "/aeo-for" },
		],
	},
	{
		heading: "Company",
		links: [
			{
				label: "Upstream source",
				href: "https://github.com/elmohq/elmo",
				external: true,
			},
			{ label: "llms.txt", href: "/llms.txt" },
		],
	},
];

export function Footer() {
	return (
		<footer className="bg-white">
			<div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
				<div className="grid gap-10 md:grid-cols-12">
					<div className="md:col-span-3">
						<Link to="/" aria-label="Yonaris homepage">
							<Logo className="h-8" />
						</Link>
						<p className="mt-5 max-w-[36ch] text-pretty text-sm text-zinc-600">
							AI visibility tracking and optimization.
						</p>
						<div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 font-mono text-[11px] text-zinc-700">
							<span className="size-1.5 rounded-full bg-emerald-500" />v{__APP_VERSION__}
						</div>
					</div>
					<div className="grid grid-cols-2 gap-10 md:col-span-9 md:grid-cols-4">
						{cols.map((col) => (
							<div key={col.heading}>
								<h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">{col.heading}</h3>
								<ul className="mt-4 space-y-2.5 text-sm text-zinc-700">
									{col.links.map((link) =>
										"external" in link && link.external ? (
											<li key={link.href}>
												<a
													href={link.href}
													target="_blank"
													rel={externalRel(link.href)}
													className="hover:text-zinc-950 hover:underline"
												>
													{link.label}
												</a>
											</li>
										) : link.href.startsWith("/") ? (
											<li key={link.href}>
												<a href={link.href} className="hover:text-zinc-950 hover:underline">
													{link.label}
												</a>
											</li>
										) : (
											<li key={link.href}>
												<a href={link.href} className="hover:text-zinc-950 hover:underline">
													{link.label}
												</a>
											</li>
										),
									)}
								</ul>
							</div>
						))}
					</div>
				</div>

				<div className="mt-12 flex flex-col items-start gap-4 border-t border-zinc-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
					<p className="font-mono text-[11px] text-zinc-500">&copy; {new Date().getFullYear()} Yonaris</p>
					<div className="text-xs text-zinc-600">
						<a
							href="https://github.com/elmohq/elmo"
							target="_blank"
							rel={externalRel("https://github.com/elmohq/elmo")}
							className="hover:text-zinc-900 hover:underline"
						>
							Upstream source: Elmo on GitHub
						</a>
					</div>
				</div>
			</div>
		</footer>
	);
}
