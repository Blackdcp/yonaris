import { ZH_MACHINE_FACTS, type ZhMachinePageKey } from "@/content/site/zh-cn/machine";

export type ZhAgentPageKey = "index" | Exclude<ZhMachinePageKey, "home">;

const topics = [
	"product",
	"approach",
	"research",
	"geo",
	"company",
	"diagnostic",
	"privacy",
] as const satisfies readonly Exclude<ZhMachinePageKey, "home">[];

function humanHref(key: ZhAgentPageKey): string {
	return key === "index" ? "/zh" : `/zh/${key}`;
}

function agentHref(key: ZhAgentPageKey): string {
	return key === "index" ? "/zh/agent" : `/zh/agent/${key}`;
}

export function ZhAgentPage({ pageKey }: { pageKey: ZhAgentPageKey }) {
	const facts = ZH_MACHINE_FACTS[pageKey === "index" ? "home" : pageKey];
	return (
		<div className="global-agent zh-agent" data-view="agent" data-edition="zh-cn-agent" lang="zh-CN">
			<header className="global-agent__header">
				<a href="/zh" aria-label="Yonaris 中文首页">
					<img src="/brand/logos/yonaris-wordmark-white.png" alt="Yonaris" />
				</a>
				<span>中国区域 · 公开事实界面</span>
				<nav className="global-agent__view-switch" aria-label="阅读方式">
					<a href={humanHref(pageKey)}>人类阅读</a>
					<a href={agentHref(pageKey)} aria-current="page">
						Agent 阅读
					</a>
				</nav>
			</header>
			<main>
				<section className="global-agent__hero">
					<p>AGENT 阅读 · {pageKey === "index" ? "区域索引" : pageKey.toUpperCase()}</p>
					<h1>{facts.title}</h1>
					<p>{facts.description}</p>
					<div className="global-agent__endpoints">
						<span>人类页面</span>
						<a href={humanHref(pageKey)}>{humanHref(pageKey)}</a>
						<span>Markdown</span>
						<code>Accept: text/markdown</code>
					</div>
				</section>
				<section className="global-agent__scope">
					<span>01 · 当前范围</span>
					<p>{facts.currentScope}</p>
				</section>
				<section className="global-agent__facts">
					<header>
						<span>02 · 已声明事实</span>
						<small>{facts.claims.length} 条</small>
					</header>
					{facts.claims.map((claim) => (
						<article key={claim.id}>
							<code>{claim.id}</code>
							<span>{claim.status}</span>
							<p>{claim.text}</p>
							{claim.limitation ? <small>{claim.limitation}</small> : null}
						</article>
					))}
				</section>
				<section className="global-agent__limits">
					<span>03 · 边界</span>
					<ul>
						{facts.limitations.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</section>
				{pageKey === "index" ? (
					<section className="global-agent__directory">
						<header>
							<span>04 · 区域页面目录</span>
							<small>人类阅读 ↔ Agent 阅读</small>
						</header>
						{topics.map((key) => (
							<div key={key}>
								<strong>{ZH_MACHINE_FACTS[key].title}</strong>
								<a href={humanHref(key)}>人类阅读</a>
								<a href={agentHref(key)}>Agent 阅读</a>
							</div>
						))}
					</section>
				) : null}
			</main>
			<footer className="global-agent__footer">
				<span>Yonaris 中国区域 · 先看证据，再下结论。</span>
				<a href="/llms.txt">llms.txt</a>
			</footer>
		</div>
	);
}
