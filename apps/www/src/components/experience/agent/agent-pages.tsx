import { type ExperienceLocale, HUMAN_PAGE_KEYS, type HumanPageKey } from "@/content/experience/types";
import { agentCatalogPath, getAgentTopic } from "@/lib/machine-documents";
import "@/styles/experience/agent.css";
import { HumanAgentLink } from "../shared/human-agent-link";
import { LocaleSwitchLink } from "../shared/locale-switch-link";
import { OrbitField } from "../shared/orbit-field";
import { AgentDirectory, AgentReadingPreview } from "./agent-directory";

export { commitAgentFactNavigation, resolveAgentDirectorySelection } from "./agent-directory";

function agentPath(locale: ExperienceLocale, pageKey: HumanPageKey): string {
	return getAgentTopic(locale, pageKey).agentPath;
}

const interfaceCopy = {
	en: {
		interfaceLabel: "Agent reading",
		format: "SERVER-RENDERED FACT RECORD · UTF-8",
		topics: "Topics",
		facts: "Public facts",
		canonical: "Human HTML",
		markdown: "Topic Markdown",
		catalogue: "JSON-LD catalogue",
		requestMethods: "GET · HEAD",
		representations: "Available representations",
		language: "Language",
		lastReviewed: "Last reviewed",
		reviewedBy: "Reviewed by",
		scope: "Scope",
		limitations: "Boundaries that apply to this topic",
		returnHuman: "Read this topic for people",
		orbitLabel: "One public fact read through evidence and boundary",
		innerOrbitLabel: "Stable fact geometry",
		pageLabels: {
			home: "Overview",
			product: "Platform",
			approach: "Evidence",
			geo: "Across markets",
			company: "Human + Agent",
			diagnostic: "Contact",
			privacy: "Privacy",
		},
	},
	zh: {
		interfaceLabel: "Agent 阅读",
		format: "服务端渲染事实记录 · UTF-8",
		topics: "主题",
		facts: "公开事实",
		canonical: "人类阅读 HTML",
		markdown: "主题 Markdown",
		catalogue: "JSON-LD 目录",
		requestMethods: "GET · HEAD",
		representations: "可用读取格式",
		language: "语言",
		lastReviewed: "最近核对",
		reviewedBy: "核对方",
		scope: "范围",
		limitations: "本主题适用的边界",
		returnHuman: "以人类视角阅读本主题",
		orbitLabel: "同一条公开事实的证据与边界",
		innerOrbitLabel: "稳定事实关系",
		pageLabels: {
			home: "概览",
			product: "系统",
			approach: "证据",
			geo: "跨市场",
			company: "人类与 Agent",
			diagnostic: "联系",
			privacy: "隐私",
		},
	},
} as const;

function HumanReturn({ locale, href, label }: { locale: ExperienceLocale; href: string; label: string }) {
	return (
		<a
			className="agent-experience__human-return"
			href={href}
			data-human-canonical="true"
			hrefLang={locale === "en" ? "en" : "zh-CN"}
		>
			{label}
		</a>
	);
}

export function AgentPage({ locale, pageKey }: { locale: ExperienceLocale; pageKey: HumanPageKey }) {
	const topic = getAgentTopic(locale, pageKey);
	const copy = interfaceCopy[locale];
	const homePath = locale === "en" ? "/" : "/zh";
	const firstFact = topic.groups[0]?.facts[0];

	return (
		<div
			className="agent-experience"
			data-agent-surface="true"
			data-agent-locale={locale}
			data-page-key={pageKey}
			lang={locale === "en" ? "en" : "zh-CN"}
		>
			<a className="agent-experience__skip" href="#agent-facts">
				{copy.facts}
			</a>
			<header className="agent-experience__masthead">
				<a className="agent-experience__brand" href={homePath} aria-label="Yonaris">
					<img src="/brand/logos/yonaris-wordmark-white.png" alt="Yonaris" width="340" height="94" />
				</a>
				<div className="agent-experience__identity">
					<span>{copy.interfaceLabel}</span>
					<code>{copy.format}</code>
				</div>
				<div className="agent-experience__actions">
					<HumanAgentLink locale={locale} pageKey={pageKey} mode="agent" className="agent-experience__mode-desktop" />
					<HumanAgentLink
						locale={locale}
						pageKey={pageKey}
						mode="agent"
						className="agent-experience__mode-mobile"
						compact
					/>
					<LocaleSwitchLink locale={locale} pageKey={pageKey} surface="agent" />
				</div>
			</header>

			<nav className="agent-experience__topics" aria-label={copy.topics}>
				{HUMAN_PAGE_KEYS.map((key) => (
					<a key={key} href={agentPath(locale, key)} aria-current={key === pageKey ? "page" : undefined}>
						{copy.pageLabels[key]}
					</a>
				))}
			</nav>

			<main className="agent-experience__main">
				<article
					className="agent-experience__document"
					data-page-composition="fact-directory"
					data-agent-page-kind={pageKey === "home" ? "home" : "inner"}
				>
					{pageKey === "home" ? (
						<header className="agent-experience__home-intro">
							<div className="agent-experience__intro-copy">
								<p className="agent-experience__kicker">
									{copy.facts} · {copy.pageLabels[pageKey]}
								</p>
								<h1>{topic.title}</h1>
								<p>{topic.summary}</p>
								<HumanReturn locale={locale} href={topic.humanPath} label={copy.returnHuman} />
							</div>
							<div className="agent-experience__home-reading">
								<OrbitField label={copy.orbitLabel} interactive />
								<AgentReadingPreview topic={topic} locale={locale} />
							</div>
						</header>
					) : (
						<header className="agent-experience__route-intro">
							<div className="agent-experience__intro-copy">
								<p className="agent-experience__kicker">
									{copy.facts} · {copy.pageLabels[pageKey]}
								</p>
								<h1>{topic.title}</h1>
								<p>{topic.summary}</p>
								<HumanReturn locale={locale} href={topic.humanPath} label={copy.returnHuman} />
							</div>
							<OrbitField label={copy.innerOrbitLabel}>
								<code>{firstFact?.id}</code>
							</OrbitField>
						</header>
					)}

					<section
						className="agent-experience__record-meta"
						aria-label={locale === "en" ? "Record metadata and representations" : "记录信息与读取格式"}
					>
						<div className="agent-experience__metadata">
							<dl>
								<div>
									<dt>{copy.language}</dt>
									<dd>{topic.language}</dd>
								</div>
								<div>
									<dt>{copy.lastReviewed}</dt>
									<dd>{topic.lastReviewed}</dd>
								</div>
								<div>
									<dt>{copy.reviewedBy}</dt>
									<dd>{topic.reviewedBy}</dd>
								</div>
								<div>
									<dt>{copy.scope}</dt>
									<dd>{topic.scope}</dd>
								</div>
							</dl>
						</div>
						<nav className="agent-experience__representations" aria-label={copy.representations}>
							<h2>{copy.representations}</h2>
							<a href={topic.humanPath} type="text/html">
								{copy.canonical}
							</a>
							<a href={topic.markdownPath} type="text/markdown">
								{copy.markdown}
							</a>
							<a href={agentCatalogPath(locale)} type="application/ld+json">
								{copy.catalogue}
							</a>
							<small>{copy.requestMethods}</small>
						</nav>
					</section>

					<AgentDirectory topic={topic} locale={locale} />

					<section className="agent-experience__limitations" aria-labelledby="agent-limitations">
						<h2 id="agent-limitations">{copy.limitations}</h2>
						<ul>
							{topic.limitations.map((limitation) => (
								<li key={limitation}>{limitation}</li>
							))}
						</ul>
					</section>
				</article>
			</main>

			<footer className="agent-experience__footer">
				<a href={homePath} aria-label="Yonaris">
					<img src="/brand/logos/yonaris-wordmark-white.png" alt="Yonaris" width="340" height="94" />
				</a>
				<a href={topic.humanPath}>{copy.returnHuman}</a>
			</footer>
		</div>
	);
}
