import { getMarketingContent, type Locale } from "@/lib/marketing-content";
import { HomeHero } from "./home-hero";
import { MarketingLink } from "./marketing-link";
import { MarketingSection, SectionIntro } from "./section";
import { MarketingShell } from "./marketing-shell";
import { SignalField } from "./signal-field";

export function MarketingHomePage({ locale }: { locale: Locale }) {
	const content = getMarketingContent(locale);
	const isZh = locale === "zh";
	const diagnosticPath = isZh ? "/zh/diagnostic" : "/diagnostic";

	return (
		<MarketingShell locale={locale} page="home">
			<HomeHero locale={locale} content={content.homeHero} previewLabel={content.preview.label} />

			<MarketingSection id="company" tone="paper" className="border-b border-[var(--yonaris-ink)]/12" innerClassName="grid gap-7 py-20 sm:py-24 lg:grid-cols-12 lg:gap-10 lg:py-28">
				<p className="marketing-kicker text-[var(--yonaris-slate)]/70 lg:col-span-3">{content.navigation[3].label}</p>
				<div className="lg:col-span-8 lg:col-start-5">
					<h2 className="marketing-display max-w-[17ch] text-[clamp(2.35rem,5vw,5.25rem)] leading-[0.98] font-medium tracking-[-0.045em] text-balance">{content.brandThesis}</h2>
					<p className="mt-7 max-w-[46rem] text-base leading-7 text-[var(--yonaris-slate)]/78 sm:text-lg sm:leading-8">{content.companyDefinition}</p>
				</div>
			</MarketingSection>

			<MarketingSection tone="surface" className="border-b border-[var(--yonaris-ink)]/12" innerClassName="py-24 sm:py-32 lg:py-40">
				<SectionIntro {...content.capabilitiesIntro} />
				<div className="mt-20 grid border-t border-[var(--yonaris-ink)]/18 sm:grid-cols-2 lg:mt-28 lg:grid-cols-4">
					{content.capabilities.map((capability, index) => (
						<article key={capability.name} className="min-h-72 border-b border-[var(--yonaris-ink)]/14 py-7 sm:border-r sm:px-6 lg:min-h-80 lg:border-b-0 first:sm:pl-0 last:sm:border-r-0">
							<p className="font-mono text-[10px] text-[var(--yonaris-signal-strong)]">0{index + 1}</p>
							<h3 className="mt-16 text-3xl font-medium tracking-[-0.04em] sm:mt-20">{capability.name}</h3>
							<p className="mt-4 max-w-[17rem] text-sm leading-6 text-[var(--yonaris-slate)]/70">{capability.description}</p>
						</article>
					))}
				</div>
			</MarketingSection>

			<MarketingSection tone="ink" className="relative overflow-hidden border-b border-white/10" innerClassName="relative py-24 sm:py-32 lg:py-40">
				<div className="pointer-events-none absolute -right-24 bottom-0 h-[70%] w-[58%] opacity-45 max-lg:hidden"><SignalField density="section" /></div>
				<div className="relative z-10">
					<SectionIntro {...content.foundationsIntro} tone="ink" />
					<div className="mt-20 grid border-t border-white/14 lg:ml-[25%] lg:mt-28 lg:grid-cols-2">
						{content.foundations.map((foundation, index) => (
							<div key={foundation.name} className="group min-h-60 border-b border-white/12 py-7 lg:border-r lg:px-8 lg:odd:pl-0 lg:even:border-r-0">
								<div className="flex items-center justify-between gap-5">
									<p className="marketing-kicker text-[var(--yonaris-paper)]/44">0{index + 1}</p>
									<span className="size-1.5 bg-[var(--yonaris-signal)]" />
								</div>
								<h3 className="mt-12 text-2xl font-medium tracking-[-0.035em]">{foundation.name}</h3>
								<p className="mt-2 text-xs text-[var(--yonaris-paper)]/42">{foundation.label}</p>
								<p className="mt-5 max-w-sm text-sm leading-6 text-[var(--yonaris-paper)]/62">{foundation.description}</p>
							</div>
						))}
					</div>
				</div>
			</MarketingSection>

			<MarketingSection tone="paper" className="border-b border-[var(--yonaris-ink)]/12" innerClassName="py-24 sm:py-32 lg:py-40">
				<SectionIntro eyebrow={content.method.eyebrow} title={content.method.title} body={content.method.body} />
				<ol className="mt-20 border-t border-[var(--yonaris-ink)]/18 lg:ml-[25%] lg:mt-28">
					{content.method.steps.map((step, index) => (
						<li key={step.name} className="grid gap-5 border-b border-[var(--yonaris-ink)]/14 py-7 sm:grid-cols-12 sm:items-start sm:gap-8">
							<span className="font-mono text-[10px] text-[var(--yonaris-signal-strong)] sm:col-span-1">0{index + 1}</span>
							<h3 className="text-xl font-medium tracking-[-0.03em] sm:col-span-4">{step.name}</h3>
							<p className="max-w-[34rem] text-sm leading-6 text-[var(--yonaris-slate)]/68 sm:col-span-6 sm:col-start-7">{step.description}</p>
						</li>
					))}
				</ol>
				<div className="mt-10 lg:ml-[25%]"><MarketingLink href={isZh ? "/zh/methodology" : "/methodology"} variant="text" tone="paper">{isZh ? "了解递归森林" : "Explore Recursive Forest"}</MarketingLink></div>
			</MarketingSection>

			<MarketingSection tone="surface" className="border-b border-[var(--yonaris-ink)]/12" innerClassName="py-24 sm:py-32 lg:py-40">
				<SectionIntro eyebrow={content.evidence.eyebrow} title={content.evidence.title} body={content.evidence.body} />
				<div className="mt-20 grid border-t border-[var(--yonaris-ink)]/18 sm:grid-cols-5 lg:ml-[25%] lg:mt-28">
					{content.evidence.scope.map((value, index) => (
						<div key={content.evidence.labels[index]} className="border-b border-[var(--yonaris-ink)]/14 py-6 sm:border-r sm:border-b-0 sm:px-5 first:sm:pl-0 last:sm:border-r-0">
							<p className="text-[clamp(2.4rem,4vw,4.2rem)] leading-none font-medium tracking-[-0.05em]">{value}</p>
							<p className="mt-4 text-[10px] leading-4 uppercase tracking-[0.08em] text-[var(--yonaris-slate)]/58">{content.evidence.labels[index]}</p>
						</div>
					))}
				</div>
				<div className="mt-14 grid gap-6 border-l-2 border-[var(--yonaris-signal)] pl-6 lg:ml-[25%] lg:grid-cols-2 lg:items-end">
					<div><p className="marketing-kicker text-[var(--yonaris-slate)]/60">{content.evidence.outcomeLabel}</p><p className="mt-4 text-4xl font-medium tracking-[-0.04em] sm:text-5xl">{content.evidence.outcome}</p></div>
					<p className="max-w-md text-xs leading-5 text-[var(--yonaris-slate)]/58">{content.evidence.note}</p>
				</div>
				<div className="mt-10 lg:ml-[25%]"><MarketingLink href={isZh ? "/zh/results" : "/results"} variant="text" tone="paper">{isZh ? "查看结果" : "Read the evidence"}</MarketingLink></div>
			</MarketingSection>

			<MarketingSection tone="paper" className="border-b border-[var(--yonaris-ink)]/12" innerClassName="py-24 sm:py-32 lg:py-40">
				<SectionIntro {...content.geo} />
				<div className="mt-10 lg:ml-[33.333%]"><MarketingLink href={isZh ? "/zh/geo" : "/geo"} variant="text" tone="paper">{isZh ? "了解我们的 GEO 方法" : "See our approach to GEO"}</MarketingLink></div>
			</MarketingSection>

			<MarketingSection tone="ink" innerClassName="py-24 sm:py-32 lg:py-40">
				<div className="grid gap-12 lg:grid-cols-12 lg:items-end">
					<div className="lg:col-span-8">
						<p className="marketing-kicker text-[var(--yonaris-paper)]/50">{content.diagnostic.eyebrow}</p>
						<h2 className="marketing-display mt-7 max-w-[14ch] text-[clamp(2.8rem,6vw,6.4rem)] leading-[0.94] font-medium tracking-[-0.05em] text-balance">{content.diagnostic.title}</h2>
						<p className="mt-8 max-w-[39rem] text-base leading-7 text-[var(--yonaris-paper)]/66 sm:text-lg">{content.diagnostic.body}</p>
					</div>
					<div className="lg:col-span-3 lg:col-start-10"><MarketingLink href={diagnosticPath} className="w-full sm:w-auto lg:w-full">{content.cta.primary}</MarketingLink></div>
				</div>
			</MarketingSection>
		</MarketingShell>
	);
}
