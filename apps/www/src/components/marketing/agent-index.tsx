import { Logo } from "../logo";

const documents = [
	{ index: "01", title: "Company", path: "/agent/company", description: "Identity, category, aliases, and current scope." },
	{ index: "02", title: "Platform", path: "/agent/platform", description: "What Yonaris can do today." },
	{ index: "03", title: "Methodology", path: "/agent/methodology", description: "Recursive Forest and the evidence loop." },
	{ index: "04", title: "Results", path: "/agent/results", description: "Verified, anonymized engagement evidence." },
] as const;

export function AgentIndex() {
	return (
		<div className="marketing-site flex min-h-[100svh] flex-col bg-[var(--yonaris-ink)] text-[var(--yonaris-paper)]">
			<header className="border-b border-white/10">
				<div className="mx-auto flex h-[4.5rem] max-w-[90rem] items-center justify-between px-5 sm:px-8 lg:px-12">
					<a href="/" aria-label="Yonaris home" className="inline-flex min-h-11 items-center"><Logo variant="white" className="h-7" /></a>
					<a href="/" className="inline-flex min-h-11 items-center gap-3 text-[10px] uppercase tracking-[0.13em] text-[var(--yonaris-paper)]/62 hover:text-[var(--yonaris-paper)]">Human view <span aria-hidden="true">↗</span></a>
				</div>
			</header>

			<main className="mx-auto grid w-full max-w-[90rem] flex-1 gap-16 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-12 lg:px-12 lg:py-36">
				<div className="lg:col-span-5">
					<p className="marketing-kicker text-[var(--yonaris-paper)]/48">AGENT VIEW / TEXT-MARKDOWN</p>
					<h1 className="marketing-display mt-8 max-w-[9ch] text-[clamp(3.4rem,6.5vw,7rem)] leading-[0.91] font-medium tracking-[-0.058em]">One set of facts.<br />Two readable surfaces.</h1>
					<div className="mt-9 h-px w-10 bg-[var(--yonaris-signal)]" />
					<p className="mt-8 max-w-lg text-base leading-7 text-[var(--yonaris-paper)]/64">Yonaris publishes the same company, platform, methodology, and results facts for people and autonomous agents. Agent documents declare their human canonical source and current scope.</p>
				</div>

				<div className="lg:col-span-6 lg:col-start-7">
					<div className="flex items-center justify-between border-b border-white/16 pb-4 text-[10px] uppercase tracking-[0.12em] text-[var(--yonaris-paper)]/42"><span>Document index</span><span>Updated 2026-08-21</span></div>
					<ol>
						{documents.map((document) => (
							<li key={document.path} className="border-b border-white/12">
								<a href={document.path} className="group grid min-h-32 gap-5 py-6 sm:grid-cols-12 sm:items-center">
									<span className="font-mono text-[10px] text-[var(--yonaris-signal)] sm:col-span-1">{document.index}</span>
									<span className="text-2xl font-medium tracking-[-0.035em] sm:col-span-4">{document.title}</span>
									<span className="text-sm leading-6 text-[var(--yonaris-paper)]/52 sm:col-span-5">{document.description}</span>
									<span className="text-right text-[var(--yonaris-paper)]/42 transition-transform group-hover:-translate-y-px group-hover:translate-x-px sm:col-span-2">↗</span>
								</a>
							</li>
						))}
					</ol>
					<div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-xs text-[var(--yonaris-paper)]/54"><a href="/llms.txt" className="hover:text-[var(--yonaris-paper)]">llms.txt ↗</a><a href="/llms-full.txt" className="hover:text-[var(--yonaris-paper)]">llms-full.txt ↗</a></div>
				</div>
			</main>

			<footer className="border-t border-white/10"><div className="mx-auto flex min-h-16 max-w-[90rem] items-center justify-between gap-5 px-5 py-4 text-[10px] uppercase tracking-[0.12em] text-[var(--yonaris-paper)]/42 sm:px-8 lg:px-12"><span>Yonaris / AI-native MarTech</span><span>For humans and agents.</span></div></footer>
		</div>
	);
}
