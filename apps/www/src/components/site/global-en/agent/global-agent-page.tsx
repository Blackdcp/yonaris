import { GLOBAL_ENGLISH_MACHINE_FACTS } from "@/content/site/global-en/machine";
import type { AgentPageKey, CorePageKey } from "@/content/site/types";

export type GlobalAgentViewKey = "index" | AgentPageKey;

const agentPages = ["product", "approach", "research", "geo", "company", "diagnostic"] as const satisfies readonly AgentPageKey[];

function humanHref(key: GlobalAgentViewKey): string {
	return key === "index" ? "/" : `/${key}`;
}

function agentHref(key: GlobalAgentViewKey): string {
	return key === "index" ? "/agent" : `/agent/${key}`;
}

function factsFor(key: GlobalAgentViewKey) {
	return GLOBAL_ENGLISH_MACHINE_FACTS[(key === "index" ? "home" : key) as CorePageKey];
}

function ViewSwitch({ pageKey }: { pageKey: GlobalAgentViewKey }) {
	return (
		<nav className="global-agent__view-switch" aria-label="Reading mode">
			<a href={humanHref(pageKey)}>Human</a>
			<a href={agentHref(pageKey)} aria-current="page">Agent</a>
		</nav>
	);
}

export function GlobalAgentPage({ pageKey }: { pageKey: GlobalAgentViewKey }) {
	const facts = factsFor(pageKey);
	return (
		<div className="global-agent" data-view="agent" lang="en">
			<header className="global-agent__header">
				<a href="/" aria-label="Yonaris home"><img src="/brand/logos/yonaris-wordmark-white.png" alt="Yonaris" /></a>
				<span>PUBLIC FACT INTERFACE</span>
				<ViewSwitch pageKey={pageKey} />
			</header>
			<main>
				<section className="global-agent__hero">
					<p>AGENT VIEW · {pageKey === "index" ? "INDEX" : pageKey.toUpperCase()}</p>
					<h1>{facts.title}</h1>
					<p>{facts.description}</p>
					<div className="global-agent__endpoints">
						<span>Human canonical</span><a href={humanHref(pageKey)}>{humanHref(pageKey)}</a>
						<span>Markdown</span><code>Accept: text/markdown</code>
					</div>
				</section>
				<section className="global-agent__scope">
					<span>01 · CURRENT SCOPE</span>
					<p>{facts.currentScope}</p>
				</section>
				<section className="global-agent__facts">
					<header><span>02 · DECLARED FACTS</span><small>{facts.claims.length} records</small></header>
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
					<span>03 · LIMITATIONS</span>
					<ul>{facts.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
				</section>
				{pageKey === "index" ? (
					<section className="global-agent__directory">
						<header><span>04 · TOPIC DIRECTORY</span><small>Human ↔ Agent</small></header>
						{agentPages.map((key) => (
							<div key={key}>
								<strong>{GLOBAL_ENGLISH_MACHINE_FACTS[key].title}</strong>
								<a href={humanHref(key)}>Human</a>
								<a href={agentHref(key)}>Agent</a>
							</div>
						))}
					</section>
				) : null}
			</main>
			<footer className="global-agent__footer"><span>Yonaris · Evidence before conclusion.</span><a href="/llms.txt">llms.txt</a></footer>
		</div>
	);
}
