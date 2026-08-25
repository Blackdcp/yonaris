import { AGENT_FACTS } from "@/content/experience/agent-facts";
import { type ExperienceLocale, HUMAN_PAGE_KEYS, type HumanPageKey } from "@/content/experience/types";
import { HumanAgentLink } from "../shared/human-agent-link";
import { LocaleSwitchLink } from "../shared/locale-switch-link";
import "@/styles/experience/agent.css";

function agentPath(locale: ExperienceLocale, pageKey: HumanPageKey): string {
	if (locale === "en") return pageKey === "home" ? "/agent" : `/agent/${pageKey}`;
	return pageKey === "home" ? "/zh/agent" : `/zh/agent/${pageKey}`;
}

const interfaceCopy = {
	en: {
		interfaceLabel: "Agent fact interface",
		format: "PUBLIC HTML · UTF-8",
		directory: "Fact directory",
		canonical: "Human canonical",
		returnHuman: "Return to the Human site",
		facts: "Public facts",
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
		returnHuman: "返回官网",
		facts: "公开事实",
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
	const edition = locale === "en" ? "global" : "zh";
	const topic = AGENT_FACTS[edition][pageKey];
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
						<div className="agent-experience__canonical">
							<span>{copy.canonical}</span>
							<a href={topic.humanPath} data-human-canonical="true">
								{topic.humanPath}
							</a>
						</div>
						<a className="agent-experience__human-return" href={topic.humanPath}>
							<span aria-hidden="true">←</span> {copy.returnHuman}
						</a>
					</header>

					<section className="agent-experience__facts" id="agent-facts" aria-label={copy.facts}>
						{topic.groups.map((group, groupIndex) => (
							<section key={group.title} data-fact-group={group.title}>
								<header>
									<em>{String(groupIndex + 1).padStart(2, "0")}</em>
									<h2>{group.title}</h2>
								</header>
								<ul>
									{group.items.map((item, itemIndex) => (
										<li key={item} data-fact-item={itemIndex + 1}>
											<span aria-hidden="true">↳</span>
											<p>{item}</p>
										</li>
									))}
								</ul>
							</section>
						))}
					</section>
				</article>
			</main>
		</div>
	);
}
