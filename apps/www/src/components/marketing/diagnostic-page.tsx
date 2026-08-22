import { getMarketingContent, type Locale } from "@/lib/marketing-content";
import { DiagnosticForm } from "./diagnostic-form";
import { MarketingSection } from "./section";
import { MarketingShell } from "./marketing-shell";
import { SignalField } from "./signal-field";

export function DiagnosticPage({ locale, initialWebsite }: { locale: Locale; initialWebsite?: string }) {
	const content = getMarketingContent(locale);
	return (
		<MarketingShell locale={locale} page="diagnostic">
			<MarketingSection tone="ink" className="relative min-h-[38rem] overflow-hidden" innerClassName="relative grid min-h-[38rem] items-end py-20 sm:py-28 lg:grid-cols-12 lg:py-32">
				<div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[54%] opacity-70 md:block"><SignalField density="section" /></div>
				<div className="relative z-10 lg:col-span-8">
					<p className="marketing-kicker text-[var(--yonaris-paper)]/50">{content.diagnostic.eyebrow}</p>
					<h1 className="marketing-display mt-7 max-w-[12ch] text-[clamp(3.2rem,7vw,7rem)] leading-[0.92] font-medium tracking-[-0.057em] text-balance">{content.diagnostic.title}</h1>
					<p className="mt-8 max-w-[42rem] text-base leading-7 text-[var(--yonaris-paper)]/68 sm:text-lg">{content.diagnostic.body}</p>
				</div>
			</MarketingSection>
			<MarketingSection tone="paper" innerClassName="grid gap-16 py-24 sm:py-32 lg:grid-cols-12 lg:gap-12 lg:py-40">
				<aside className="lg:col-span-4">
					<p className="marketing-kicker text-[var(--yonaris-slate)]/58">{locale === "zh" ? "你会获得" : "WHAT YOU WILL GET"}</p>
					<ol className="mt-8 border-t border-[var(--yonaris-ink)]/16">
						{content.diagnostic.outputs.map((output, index) => <li key={output} className="flex gap-5 border-b border-[var(--yonaris-ink)]/12 py-5 text-sm leading-6"><span className="font-mono text-[10px] text-[var(--yonaris-signal-strong)]">0{index + 1}</span><span>{output}</span></li>)}
					</ol>
				</aside>
				<div className="lg:col-span-7 lg:col-start-6">
					<h2 className="marketing-display text-[clamp(2.2rem,4vw,4.2rem)] leading-[0.98] font-medium tracking-[-0.045em]">{locale === "zh" ? "从一个真正重要的问题开始" : "Start with one question that matters."}</h2>
					<DiagnosticForm locale={locale} initialWebsite={initialWebsite} />
				</div>
			</MarketingSection>
		</MarketingShell>
	);
}
