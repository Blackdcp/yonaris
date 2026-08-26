import { type ExperienceLocale, HUMAN_PAGE_KEYS, type HumanPageKey } from "@/content/experience/types";
import { agentCatalogPath, getAgentTopic } from "@/lib/machine-documents";
import "@/styles/experience/agent.css";
import { HumanAgentLink } from "../shared/human-agent-link";
import { LocaleSwitchLink } from "../shared/locale-switch-link";
import { OrbitField } from "../shared/orbit-field";

function agentPath(locale: ExperienceLocale, pageKey: HumanPageKey): string {
	return getAgentTopic(locale, pageKey).agentPath;
}

const interfaceCopy = {
	en: {
		interfaceLabel: "Agent reading",
		format: "PUBLIC FACT DOCUMENT · UTF-8",
		topics: "Topics",
		factDirectory: "Fact directory",
		canonical: "Human canonical",
		markdown: "Markdown",
		catalogue: "JSON-LD catalogue",
		requestMethods: "Request methods",
		negotiation: "Content negotiation",
		language: "Language",
		lastReviewed: "Last reviewed",
		reviewedBy: "Reviewed by",
		scope: "Scope",
		limitations: "Boundaries that apply to this topic",
		evidence: "Open the Human evidence",
		source: "Evidence",
		boundary: "Boundary",
		stableId: "Stable ID",
		returnHuman: "Read this topic for people",
		facts: "Public facts",
		orbitLabel: "One public fact read as fact, evidence and boundary",
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
		format: "公开事实文档 · UTF-8",
		topics: "主题",
		factDirectory: "事实目录",
		canonical: "人类阅读对应页",
		markdown: "Markdown",
		catalogue: "JSON-LD 目录",
		requestMethods: "请求方法",
		negotiation: "内容协商",
		language: "语言",
		lastReviewed: "最近核对",
		reviewedBy: "核对方",
		scope: "范围",
		limitations: "本主题适用的边界",
		evidence: "打开人类阅读依据",
		source: "证据",
		boundary: "边界",
		stableId: "稳定 ID",
		returnHuman: "以人类视角阅读本主题",
		facts: "公开事实",
		orbitLabel: "同一条公开事实的事实、证据与边界",
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

export function AgentPage({ locale, pageKey }: { locale: ExperienceLocale; pageKey: HumanPageKey }) {
	const topic = getAgentTopic(locale, pageKey);
	const copy = interfaceCopy[locale];
	const homePath = locale === "en" ? "/" : "/zh";
	const facts = topic.groups.flatMap((group) => group.facts);

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

			<nav className="agent-experience__topics" aria-label={copy.topics}>
				{HUMAN_PAGE_KEYS.map((key) => (
					<a key={key} href={agentPath(locale, key)} aria-current={key === pageKey ? "page" : undefined}>
						{copy.pageLabels[key]}
					</a>
				))}
			</nav>

			<main className="agent-experience__main">
				<article className="agent-experience__document">
					<header className="agent-experience__intro">
						<div className="agent-experience__intro-copy">
							<p className="agent-experience__kicker">
								{copy.facts} · {copy.pageLabels[pageKey]}
							</p>
							<h1>{topic.title}</h1>
							<p>{topic.summary}</p>
							<a className="agent-experience__human-return" href={topic.humanPath} data-human-canonical="true">
								{copy.returnHuman}
							</a>
						</div>
						<OrbitField label={copy.orbitLabel}>
							<span className="agent-experience__orbit-reading">
								<strong>{copy.facts}</strong>
								<small>
									{copy.source} · {copy.boundary}
								</small>
							</span>
						</OrbitField>
					</header>

					<section
						className="agent-experience__transport"
						aria-label={locale === "en" ? "Document access" : "文档访问方式"}
					>
						<dl>
							<div>
								<dt>{copy.canonical}</dt>
								<dd>
									<a href={topic.humanPath}>{topic.humanPath}</a>
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
								<dt>{copy.requestMethods}</dt>
								<dd>
									<code>GET · HEAD</code>
								</dd>
							</div>
							<div className="agent-experience__transport-wide">
								<dt>{copy.negotiation}</dt>
								<dd>
									<code>text/html · text/markdown · application/ld+json</code>
								</dd>
							</div>
						</dl>
					</section>

					<section
						className="agent-experience__record-meta"
						aria-label={locale === "en" ? "Record metadata" : "记录信息"}
					>
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
					</section>

					<div className="agent-experience__reading">
						<aside className="agent-experience__fact-index">
							<h2>{copy.factDirectory}</h2>
							<nav aria-label={copy.factDirectory}>
								{facts.map((fact) => (
									<a key={fact.id} href={`#${fact.id}`}>
										<code>{fact.id}</code>
										<span>{fact.value}</span>
									</a>
								))}
							</nav>
						</aside>

						<section className="agent-experience__facts" id="agent-facts" aria-label={copy.facts}>
							{topic.groups.map((group) => (
								<section key={group.id} data-fact-group={group.id}>
									<header>
										<h2>{group.title}</h2>
									</header>
									{group.facts.map((fact) => (
										<article key={fact.id} id={fact.id} data-claim-id={fact.id} tabIndex={-1}>
											<h3>{fact.value}</h3>
											<dl>
												<div>
													<dt>{copy.source}</dt>
													<dd>{fact.source}</dd>
												</div>
												<div>
													<dt>{copy.boundary}</dt>
													<dd>{fact.boundary}</dd>
												</div>
												<div>
													<dt>{copy.stableId}</dt>
													<dd>
														<code>{fact.id}</code>
													</dd>
												</div>
											</dl>
											<a href={fact.evidenceUrl}>{copy.evidence}</a>
										</article>
									))}
								</section>
							))}
						</section>
					</div>

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
					<img src="/brand/logos/yonaris-wordmark-white.png" alt="Yonaris" />
				</a>
				<a href={topic.humanPath}>{copy.returnHuman}</a>
			</footer>
		</div>
	);
}
