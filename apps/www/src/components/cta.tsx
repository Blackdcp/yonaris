import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export function CTA() {
	return (
		<section className="relative border-b border-zinc-200 bg-white">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgb(0_0_0/0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgb(0_0_0/0.04)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_top,black,transparent_85%)]"
			/>
			<div className="relative mx-auto max-w-6xl px-4 py-16 md:px-6 lg:py-24">
				<p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">/ GET STARTED</p>
				<h2 className="mt-4 max-w-[18ch] text-4xl font-semibold leading-[1.05] tracking-tight text-balance text-zinc-950 md:text-5xl">
					Build your GEO baseline.
				</h2>
				<p className="mt-5 max-w-[52ch] text-pretty text-zinc-600 md:text-lg">
					Configure your models and prompts, then turn repeatable observations into an optimization roadmap.
				</p>
				<div className="mt-7">
					<Link
						to="/docs"
						className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-sm font-medium leading-none text-white ring-1 ring-blue-600 hover:bg-blue-700"
					>
						Get Started
						<ArrowRight className="size-3.5" />
					</Link>
				</div>
			</div>
		</section>
	);
}
