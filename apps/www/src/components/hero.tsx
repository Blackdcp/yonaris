import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export function Hero() {
	return (
		<section className="relative border-b border-zinc-200 bg-white">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgb(0_0_0/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(0_0_0/0.04)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
			/>
			<div className="relative mx-auto max-w-6xl px-4 py-20 md:px-6 lg:py-28">
				<div className="max-w-4xl">
					<div className="flex flex-wrap items-center gap-3">
						<span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 font-mono text-[11px] text-zinc-700">
							<span className="size-1.5 rounded-full bg-emerald-500" />v{__APP_VERSION__}
						</span>
					</div>
					<h1 className="mt-7 max-w-[18ch] text-5xl font-semibold leading-[1.05] tracking-tight text-balance text-zinc-950 sm:text-6xl lg:text-[4.25rem] lg:leading-[1.0]">
						Know How AI Talks About Your Brand
					</h1>
					<p className="mt-6 max-w-[58ch] text-pretty text-base text-zinc-600 md:text-lg">
						Track visibility across configured AI models, monitor mentions and citations, compare competitors, and build
						an auditable GEO baseline from repeatable prompt runs.
					</p>
					<div className="mt-8 flex flex-wrap items-center gap-2">
						<Link
							to="/docs"
							className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-sm font-medium leading-none text-white ring-1 ring-blue-600 hover:bg-blue-700"
						>
							Get Started
							<ArrowRight className="size-3.5" />
						</Link>
						<Link
							to="/features"
							className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-3 text-sm font-medium leading-none text-zinc-900 ring-1 ring-zinc-200 hover:bg-zinc-50 hover:ring-zinc-300"
						>
							Explore features
						</Link>
					</div>
				</div>
			</div>
		</section>
	);
}
