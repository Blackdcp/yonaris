import { type ExperienceLocale, HUMAN_PAGE_KEYS, type HumanPageKey } from "@/content/experience/types";
import { agentCatalogPath, getAgentTopic } from "@/lib/machine-documents";
import { HumanAgentLink } from "../shared/human-agent-link";
import { LocaleSwitchLink } from "../shared/locale-switch-link";
import "@/styles/experience/agent.css";

function agentPath(locale: ExperienceLocale, pageKey: HumanPageKey): string {
	return getAgentTopic(locale, pageKey).agentPath;
}

const interfaceCopy = {
	en: {
		interfaceLabel: "Agent fact interface",
		format: "PUBLIC HTML · UTF-8",
		directory: "Fact directory",
		canonical: "Human canonical",
		markdown: "Markdown document",
		catalogue: "JSON-LD catalogue",
		language: "Language",
		lastReviewed: "Last reviewed",
		reviewedBy: "Reviewed by",
		scope: "Scope",
		limitations: "Limitations",
		evidence: "Human evidence",
		returnHuman: "Return to the Human site",
		facts: "Public facts",
		railHint: "Swipe topics",
		pageLabels: {
			home: "Overview",
			product: "Product",
			approach: "How it works",
			geo: "Markets & GEO",
			company: "Company",
			diagnostic: "Contact",
			privacy: "Privacy",
		},
	},
	zh: {
		interfaceLabel: "Agent 事实入口",
		format: "公开网页 · UTF-8",
		directory: "事实目录",
		canonical: "官网对应页面",
		markdown: "Markdown 文档",
		catalogue: "JSON-LD 目录",
		language: "语言",
		lastReviewed: "最近核对",
		reviewedBy: "核对方",
		scope: "范围",
		limitations: "限制",
		evidence: "官网依据",
		returnHuman: "返回官网",
		facts: "公开事实",
		railHint: "横向滑动查看更多",
		pageLabels: {
			home: "概览",
			product: "产品能力",
			approach: "服务方式",
			geo: "全球市场",
			company: "关于 Yonaris",
			diagnostic: "联系",
			privacy: "隐私",
		},
	},
} as const;

export function AgentPage({ locale, pageKey }: { locale: ExperienceLocale; pageKey: HumanPageKey }) {
	const topic = getAgentTopic(locale, pageKey);
	const copy = interfaceCopy[locale];
	const homePath = locale === "en" ? "/" : "/zh";

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
					<img src="/brand/logos/yonaris-wordmark-white.png" alt="Yonaris" />
				</a>
				<div className="agent-experience__identity">
					<span>{copy.interfaceLabel}</span>
					<code>{copy.format}</code>
				</div>
				<div className="agent-experience__actions">
					<HumanAgentLink locale={locale} pageKey={pageKey} mode="agent" />
					<LocaleSwitchLink locale={locale} pageKey={pageKey} surface="agent" />
				</div>
			</header>

			<main className="agent-experience__layout">
				<aside className="agent-experience__rail">
					<p>{copy.directory}</p>
					<p className="agent-experience__rail-hint">
						{copy.railHint} <span aria-hidden="true">→</span>
					</p>
					<nav aria-label={copy.directory}>
						{HUMAN_PAGE_KEYS.map((key, index) => (
							<a key={key} href={agentPath(locale, key)} aria-current={key === pageKey ? "page" : undefined}>
								<em>{String(index + 1).padStart(2, "0")}</em>
								<span>{copy.pageLabels[key]}</span>
							</a>
						))}
					</nav>
				</aside>

				<article className="agent-experience__document">
					<header className="agent-experience__intro">
						<div className="agent-experience__signal" aria-hidden="true">
							<span />
							<i />
						</div>
						<p>
							{copy.facts} / {copy.pageLabels[pageKey]}
						</p>
						<h1>{topic.title}</h1>
						<p>{topic.summary}</p>
						<dl className="agent-experience__metadata">
							<div>
								<dt>{copy.canonical}</dt>
								<dd>
									<a href={topic.humanPath} data-human-canonical="true">
										{topic.humanPath}
									</a>
								</dd>
							</div>
							<div>
								<dt>{copy.markdown}</dt>
								<dd>
									<a href={topic.markdownPath}>{topic.markdownPath}</a>
								</dd>
							</div>
							<div>
								<dt>{copy.catalogue}</dt>
								<dd>
									<a href={agentCatalogPath(locale)}>{agentCatalogPath(locale)}</a>
								</dd>
							</div>
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
							<div className="agent-experience__metadata-wide">
								<dt>{copy.scope}</dt>
								<dd>{topic.scope}</dd>
							</div>
						</dl>
						<a className="agent-experience__human-return" href={topic.humanPath}>
							<span aria-hidden="true">←</span> {copy.returnHuman}
						</a>
					</header>

					<section className="agent-experience__facts" id="agent-facts" aria-label={copy.facts}>
						{topic.groups.map((group, groupIndex) => (
							<section key={group.id} data-fact-group={group.id}>
								<header>
									<em>{String(groupIndex + 1).padStart(2, "0")}</em>
									<h2>{group.title}</h2>
								</header>
								<ul>
									{group.facts.map((fact) => (
										<li key={fact.id} data-claim-id={fact.id}>
											<span aria-hidden="true">↳</span>
											<div>
												<p>{fact.value}</p>
												<a href={fact.evidenceUrl}>{copy.evidence}</a>
											</div>
										</li>
									))}
								</ul>
							</section>
						))}
					</section>

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
		</div>
	);
}
