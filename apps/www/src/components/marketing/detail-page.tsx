import {
	getMarketingContent,
	getMarketingDetailPage,
	type Locale,
	type MarketingDetailPageKey,
} from "@/lib/marketing-content";
import { MarketingLink } from "./marketing-link";
import { MarketingShell } from "./marketing-shell";
import { MarketingSection } from "./section";
import { SignalField } from "./signal-field";

function DetailEvidence({ locale, page }: { locale: Locale; page: MarketingDetailPageKey }) {
	const content = getMarketingContent(locale);
	const isZh = locale === "zh";

	if (page === "results") {
		return (
			<div>
				<div className="grid border-t border-[var(--yonaris-ink)]/18 sm:grid-cols-5">
					{content.evidence.scope.map((value, index) => (
						<div
							key={content.evidence.labels[index]}
							className="border-b border-[var(--yonaris-ink)]/14 py-7 sm:border-r sm:border-b-0 sm:px-5 first:sm:pl-0 last:sm:border-r-0"
						>
							<p className="text-5xl font-medium tracking-[-0.05em]">{value}</p>
							<p className="mt-3 text-[10px] uppercase tracking-[0.1em] text-[var(--yonaris-slate)]/58">
								{content.evidence.labels[index]}
							</p>
						</div>
					))}
				</div>
				<div className="mt-14 border-l-2 border-[var(--yonaris-signal)] pl-6">
					<p className="marketing-kicker text-[var(--yonaris-slate)]/58">{content.evidence.outcomeLabel}</p>
					<p className="mt-4 text-5xl font-medium tracking-[-0.05em] sm:text-7xl">{content.evidence.outcome}</p>
					<p className="mt-5 max-w-2xl text-xs leading-5 text-[var(--yonaris-slate)]/58">{content.evidence.note}</p>
				</div>
			</div>
		);
	}

	if (page === "methodology") {
		return (
			<ol className="border-t border-[var(--yonaris-ink)]/18">
				{content.method.steps.map((step, index) => (
					<li key={step.name} className="grid gap-5 border-b border-[var(--yonaris-ink)]/14 py-7 sm:grid-cols-12">
						<span className="font-mono text-[10px] text-[var(--yonaris-signal)] sm:col-span-1">0{index + 1}</span>
						<h3 className="text-xl font-medium tracking-[-0.03em] sm:col-span-4">{step.name}</h3>
						<p className="text-sm leading-6 text-[var(--yonaris-slate)]/68 sm:col-span-6 sm:col-start-7">
							{step.description}
						</p>
					</li>
				))}
			</ol>
		);
	}

	const items =
		page === "platform"
			? content.capabilities
			: [
					{
						name: isZh ? "发现" : "Discovery",
						description: isZh ? "知道品牌何时进入答案" : "Know when the brand enters the answer.",
					},
					{
						name: isZh ? "理解" : "Understanding",
						description: isZh ? "知道模型为什么这样判断" : "Know why the model frames the brand that way.",
					},
					{
						name: isZh ? "改善" : "Improvement",
						description: isZh ? "改变证据并重复验证" : "Change the evidence and repeat the test.",
					},
				];

	return (
		<div
			className={`grid border-t border-[var(--yonaris-ink)]/18 ${items.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}
		>
			{items.map((item, index) => (
				<div
					key={item.name}
					className="min-h-64 border-b border-[var(--yonaris-ink)]/14 py-7 sm:border-r sm:px-6 sm:border-b-0 first:sm:pl-0 last:sm:border-r-0"
				>
					<p className="font-mono text-[10px] text-[var(--yonaris-signal)]">0{index + 1}</p>
					<h3 className="mt-16 text-2xl font-medium tracking-[-0.035em]">{item.name}</h3>
					<p className="mt-4 max-w-[18rem] text-sm leading-6 text-[var(--yonaris-slate)]/68">{item.description}</p>
				</div>
			))}
		</div>
	);
}

export function MarketingDetailPage({ locale, page }: { locale: Locale; page: MarketingDetailPageKey }) {
	const content = getMarketingContent(locale);
	const detail = getMarketingDetailPage(locale, page);
	const diagnosticPath = locale === "zh" ? "/zh/diagnostic" : "/diagnostic";

	return (
		<MarketingShell locale={locale} page={page}>
			<MarketingSection
				tone="ink"
				className="relative min-h-[44rem] overflow-hidden"
				innerClassName="relative grid min-h-[44rem] items-end py-20 sm:py-28 lg:grid-cols-12 lg:py-32"
			>
				<div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[56%] opacity-75 md:block">
					<SignalField density="section" />
				</div>
				<div className="relative z-10 lg:col-span-7">
					<p className="marketing-kicker text-[var(--yonaris-paper)]/52">{detail.eyebrow}</p>
					<h1 className="marketing-display mt-7 max-w-[12ch] text-[clamp(3.2rem,7vw,7.2rem)] leading-[0.92] font-medium tracking-[-0.057em] text-balance">
						{detail.title}
					</h1>
					<p className="mt-8 max-w-[42rem] text-base leading-7 text-[var(--yonaris-paper)]/68 sm:text-lg sm:leading-8">
						{detail.summary}
					</p>
				</div>
			</MarketingSection>

			<MarketingSection
				tone="paper"
				className="border-b border-[var(--yonaris-ink)]/12"
				innerClassName="py-24 sm:py-32 lg:py-40"
			>
				<div className="grid gap-8 lg:grid-cols-12">
					<p className="marketing-kicker text-[var(--yonaris-slate)]/60 lg:col-span-3">
						{locale === "zh" ? "当前能力" : "CURRENT SCOPE"}
					</p>
					<p className="max-w-[48rem] text-2xl leading-[1.35] tracking-[-0.025em] text-[var(--yonaris-slate)] lg:col-span-8 lg:col-start-5 sm:text-3xl">
						{detail.description}
					</p>
				</div>
				<div className="mt-20 lg:ml-[25%] lg:mt-28">
					<DetailEvidence locale={locale} page={page} />
				</div>
			</MarketingSection>

			{detail.sections.map((section, index) => (
				<MarketingSection
					key={section.title}
					tone={index % 2 === 0 ? "mist" : "paper"}
					className="border-b border-[var(--yonaris-ink)]/12"
					innerClassName="py-20 sm:py-28 lg:py-32"
				>
					<div className="grid gap-8 lg:grid-cols-12">
						<p className="marketing-kicker text-[var(--yonaris-slate)]/56 lg:col-span-3">{section.eyebrow}</p>
						<div className="lg:col-span-8 lg:col-start-5">
							<h2 className="marketing-display max-w-[16ch] text-[clamp(2.2rem,4.5vw,4.8rem)] leading-[0.99] font-medium tracking-[-0.045em] text-balance">
								{section.title}
							</h2>
							<p className="mt-7 max-w-[42rem] text-base leading-7 text-[var(--yonaris-slate)]/72">{section.body}</p>
							{section.points ? (
								<ul className="mt-10 border-t border-[var(--yonaris-ink)]/14">
									{section.points.map((point, pointIndex) => (
										<li key={point} className="flex gap-5 border-b border-[var(--yonaris-ink)]/12 py-4 text-sm">
											<span className="font-mono text-[10px] text-[var(--yonaris-signal)]">0{pointIndex + 1}</span>
											<span>{point}</span>
										</li>
									))}
								</ul>
							) : null}
						</div>
					</div>
				</MarketingSection>
			))}

			<MarketingSection tone="ink" innerClassName="py-24 sm:py-32 lg:py-36">
				<div className="grid gap-10 lg:grid-cols-12 lg:items-end">
					<div className="lg:col-span-8">
						<p className="marketing-kicker text-[var(--yonaris-paper)]/48">{content.diagnostic.eyebrow}</p>
						<h2 className="marketing-display mt-7 max-w-[13ch] text-[clamp(2.7rem,5vw,5.7rem)] leading-[0.95] font-medium tracking-[-0.05em] text-balance">
							{content.diagnostic.title}
						</h2>
					</div>
					<div className="lg:col-span-3 lg:col-start-10">
						<MarketingLink href={diagnosticPath} className="w-full">
							{content.cta.primary}
						</MarketingLink>
					</div>
				</div>
			</MarketingSection>
		</MarketingShell>
	);
}
