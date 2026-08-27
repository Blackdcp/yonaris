import type { ReactNode } from "react";
import { PAGE_FACTS, ZH_CATEGORY } from "@/content/experience/canonical-public-facts";
import { CHINA_COPY, CHINA_READING_RECORDS } from "@/content/experience/china-copy";
import type { HumanPageKey } from "@/content/experience/types";
import { CinematicField } from "../shared/cinematic-field";
import { LeadForm } from "../shared/lead-form";
import {
	AnxietySelector,
	ApproachPreview,
	CompanyReadingScene,
	HomeReadingScene,
	MarketConditionsRecord,
	ReplayStage,
	SystemField,
	SystemRelationshipPreview,
} from "./china-scenes";
import { ChinaShell } from "./china-shell";

function ActionLink({ href, children }: { href: string; children: ReactNode }) {
	return <a className="site-06-action" href={href}>{children}</a>;
}

export function ChinaHomePage() {
	const copy = CHINA_COPY.home;

	return (
		<ChinaShell pageKey="home">
			<div className="site-06-page-composition site-06-page-composition--cinematic site-06-zh-home" data-page-composition="cinematic-anxiety">
				<CinematicField
					image={{ src: "/brand/site-06/business-walk.jpg", alt: "两位商务人士在现代办公园区交流", focalPosition: "center center" }}
					credit="Photo: Mikhail Nilov / Pexels"
					className="site-06-zh-home__cinematic"
				>
					<header className="site-06-zh-home__lead">
						<p className="site-06-kicker">{ZH_CATEGORY}</p>
						<h1>{copy.title}</h1>
						<p>{copy.lead}</p>
						<ActionLink href={copy.primaryAction.href}>{copy.primaryAction.label}</ActionLink>
					</header>
					<HomeReadingScene />
				</CinematicField>

				<section className="site-06-zh-anxiety-field">
					<div className="site-06-section">
						<header className="site-06-split-intro">
							<h2>真正要担心的，不是 AI 有没有提到你。</h2>
							<p>真正难受的是：客户已经拿着答案做选择，你却不知道自己在哪里被漏掉、说错，或者被竞品抢走了理由。</p>
						</header>
						<AnxietySelector />
					</div>
				</section>

				<section className="site-06-section site-06-zh-source-trace">
					<header className="site-06-split-intro">
						<h2>不是再刷一层曝光，而是把“为什么选你”接到证据上。</h2>
						<p>客户问题、产品事实、可信来源和 AI 答案经常各说各话。Yonaris 把断点放回同一张判断底稿里，让团队知道哪里值得先投入。</p>
					</header>
					<dl>
						<div><dt>客户真正关心</dt><dd>“谁能降低复杂交付中的执行风险？”</dd><dd>这是进入比较的业务条件，不是一句传播口号。</dd></div>
						<div data-broken-relationship><dt>品牌现在怎么说</dt><dd>“我们拥有领先的一站式能力。”</dd><dd>表达太泛，无法让客户或 Agent 判断在什么条件下成立。</dd></div>
						<div><dt>下一步先处理</dt><dd>公开一条有范围、有来源、能被复核的证明。</dd><dd>再用同一道问题查看答案和比较是否发生变化。</dd></div>
					</dl>
				</section>

				<CinematicField
					image={{ src: "/brand/site-06/glass-venue.jpg", alt: "商务人士穿行于玻璃空间", focalPosition: "center center" }}
					credit="Photo: Zerrin Velizade / Pexels"
					className="site-06-zh-practice-cinematic"
				>
					<header>
						<h2>模型会变，但你不能每次都从头猜。</h2>
						<p>换一个市场，客户问题、语言和可信来源都会变。Yonaris 逐一保存当地条件，再用同一标准复核，不把一套材料直接翻译成所有市场的答案。</p>
						<blockquote>问题怎么问、谁的来源更有权威、客户用什么理由做选择，都按当地市场重新验证。</blockquote>
					</header>
				</CinematicField>

				<section className="site-06-section site-06-zh-public-truth">
					<header className="site-06-split-intro">
						<h2>同一套事实，人要能判断，Agent 也要能引用。</h2>
						<p>不是另做一个“机器专用网站”。类别、用途、依据和边界保持一致，只把同一事实组织成更适合不同读者使用的结构。</p>
					</header>
					<div className="site-06-zh-public-truth__records" data-scene-object="fact-disclosure">
						{CHINA_READING_RECORDS.map((record) => (
							<article key={record.id} id={record.stableId} data-stable-id={record.stableId} tabIndex={-1}>
								<details data-public-fact={record.id}>
									<summary><span>{record.prompt}</span>{record.human}</summary>
									<dl>
										<div><dt>事实</dt><dd>{record.fact}</dd></div>
										<div><dt>证据</dt><dd>{record.evidence}</dd></div>
										<div><dt>边界</dt><dd>{record.boundary}</dd></div>
										<div><dt>稳定 ID</dt><dd><code>{record.stableId}</code></dd></div>
									</dl>
								</details>
							</article>
						))}
					</div>
				</section>

				<section className="site-06-dark-close">
					<div><h2>{copy.closingTitle}</h2><p>{copy.closingBody}</p></div>
					<ActionLink href={copy.primaryAction.href}>{copy.primaryAction.label}</ActionLink>
				</section>
			</div>
		</ChinaShell>
	);
}

export function ChinaProductPage() {
	const copy = CHINA_COPY.product;
	const fact = PAGE_FACTS.zh.product;
	return (
		<ChinaShell pageKey="product">
			<div className="site-06-page-composition site-06-page-composition--cinematic site-06-zh-product" data-page-composition="system-field">
				<CinematicField image={{ src: "/brand/site-06/conference-room.jpg", alt: "暖色会议空间", focalPosition: "center center" }} credit="Photo: Nastuh Abootalebi / Unsplash" className="site-06-zh-product__cinematic">
					<header className="site-06-zh-route-lead">
						<p className="site-06-kicker">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.lead}</p>
					</header>
					<SystemRelationshipPreview />
				</CinematicField>
				<section className="site-06-zh-system-stage">
					<div className="site-06-section">
						<header className="site-06-split-intro"><h2>点击一个节点，看它断掉会影响什么。</h2><p>这不是线性步骤，也不是一次性报告。任何一个节点变化，团队都能沿着关系回到同一道业务问题。</p></header>
						<SystemField />
					</div>
				</section>
				<section className="site-06-section site-06-editorial-close">
					<h2>每次变化，都能回到原问题、原来源和原判断。</h2>
					<article id={fact.id} tabIndex={-1}><p>{fact.value}</p><p>观察时间、Agent 环境、来源变化和客户行为会保留在同一条记录里；团队能判断哪里变了、哪里没变，以及下一笔投入有没有依据。</p><small>{fact.source} · {fact.boundary}</small></article>
				</section>
			</div>
		</ChinaShell>
	);
}

export function ChinaApproachPage() {
	const copy = CHINA_COPY.approach;
	const fact = PAGE_FACTS.zh.approach;
	return (
		<ChinaShell pageKey="approach">
			<div className="site-06-page-composition site-06-page-composition--cinematic site-06-zh-approach" data-page-composition="breakdown-replay">
				<CinematicField image={{ src: "/brand/site-06/evidence-room.jpg", alt: "正在核对书面材料", focalPosition: "center center" }} credit="Photo: Scott Graham / Unsplash" className="site-06-zh-approach__cinematic">
					<header className="site-06-zh-route-lead"><p className="site-06-kicker">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.lead}</p></header>
					<ApproachPreview />
				</CinematicField>
				<section className="site-06-section site-06-zh-replay-stage">
					<article className="site-06-route-record-note" id={fact.id} tabIndex={-1}><p>{fact.value}</p><p>{fact.source}</p><p>{fact.boundary}</p></article>
					<ReplayStage />
				</section>
			</div>
		</ChinaShell>
	);
}

export function ChinaCompanyPage() {
	const copy = CHINA_COPY.company;
	return (
		<ChinaShell pageKey="company">
			<div className="site-06-page-composition site-06-zh-company" data-page-composition="dual-reading-field-zh">
				<section className="site-06-company-field"><CompanyReadingScene /></section>
				<section className="site-06-section site-06-company-document" data-scene-object="canonical-fact-record">
					<header className="site-06-split-intro"><h2>机器可读，不等于机器写作。</h2><p>清楚的标题、稳定地址、可见来源、有范围的事实和一致公开记录有助于检索与核对，但不保证排名、收录、检索或引用。</p></header>
					<div className="site-06-zh-company-record" aria-label="Yonaris 公司公开事实">
						{CHINA_READING_RECORDS.map((record) => (
							<div key={record.id}>
								<span>{record.prompt}</span>
								<p>{record.fact}</p>
								<small>{record.evidence} · {record.boundary}</small>
							</div>
						))}
					</div>
					<p className="site-06-company-document__statement">人获得做判断所需的语境；Agent 获得同一事实的依据、范围与稳定位置。</p>
					<ActionLink href="/zh/agent/company">阅读对应的 Agent 记录</ActionLink>
				</section>
				<section className="site-06-dark-close" data-scene-object="company-close">
					<div><h2>{copy.closingTitle}</h2><p>{copy.closingBody}</p></div>
					<ActionLink href={copy.primaryAction.href}>{copy.primaryAction.label}</ActionLink>
				</section>
			</div>
		</ChinaShell>
	);
}

export function ChinaGeoPage() {
	const copy = CHINA_COPY.geo;
	const fact = PAGE_FACTS.zh.geo;
	return (
		<ChinaShell pageKey="geo" tone="paper">
			<div className="site-06-page-composition site-06-zh-market" data-page-composition="market-editorial-zh">
				<section className="site-06-market-editorial">
					<header className="site-06-zh-paper-lead"><p className="site-06-kicker">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.lead}</p></header>
					<figure className="site-06-editorial-photo"><img src="/brand/site-06/glass-meeting.jpg" alt="玻璃会议空间里的商务对话" /><figcaption>Photo: Andrea Piacquadio / Pexels</figcaption></figure>
				</section>
				<section className="site-06-section">
					<MarketConditionsRecord />
					<div className="site-06-zh-market__evidence" data-scene-object="market-evidence-lines">
						<p><strong>问题语言</strong><span>保留客户实际使用的需求、风险和比较词，不把总部表达直接换字。</span></p>
						<p><strong>来源条件</strong><span>记录公开来源、所有者、核对日期、适用范围和限制。</span></p>
						<p><strong>比较边界</strong><span>只在问题与观察条件仍然可比时复核答案，不把单次变化写成因果。</span></p>
					</div>
					<article className="site-06-zh-market__fact" id={fact.id} tabIndex={-1}><p>{fact.value}</p><p>{fact.source}</p><p>{fact.boundary}</p></article>
				</section>
				<section className="site-06-dark-close" data-scene-object="geo-close">
					<div><h2>{copy.closingTitle}</h2><p>{copy.closingBody}</p></div>
					<ActionLink href={copy.primaryAction.href}>{copy.primaryAction.label}</ActionLink>
				</section>
			</div>
		</ChinaShell>
	);
}

export function ChinaDiagnosticPage() {
	const copy = CHINA_COPY.diagnostic;
	const fact = PAGE_FACTS.zh.diagnostic;
	return (
		<ChinaShell pageKey="diagnostic">
			<div className="site-06-page-composition site-06-page-composition--cinematic site-06-zh-contact" data-page-composition="contact-cinematic-zh">
				<CinematicField image={{ src: "/brand/site-06/working-session.jpg", alt: "暖色真实办公空间", focalPosition: "center center" }} credit="Photo: Annie Spratt / Unsplash" className="site-06-contact-cinematic">
					<article className="site-06-contact-scene" id={fact.id} tabIndex={-1}>
						<header className="site-06-zh-route-lead"><p className="site-06-kicker">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.lead}</p></header>
						<div id="contact-form" className="site-06-contact-form"><LeadForm locale="zh" compact /></div>
						<span className="sr-only" data-contact-fact>{fact.value} {fact.source} {fact.boundary}</span>
					</article>
				</CinematicField>
			</div>
		</ChinaShell>
	);
}

export function ChinaPrivacyPage() {
	const copy = CHINA_COPY.privacy;
	const fact = PAGE_FACTS.zh.privacy;
	return (
		<ChinaShell pageKey="privacy" tone="paper">
			<div className="site-06-page-composition site-06-privacy-composition site-06-zh-privacy" data-page-composition="privacy-editorial-zh">
				<article className="site-06-privacy-document" id={fact.id} tabIndex={-1}>
					<header className="site-06-privacy-document__header"><p className="site-06-kicker">{copy.eyebrow}</p><h1>{copy.title}</h1><p>{copy.lead}</p><p className="site-06-privacy-document__purpose">{fact.value}</p><p className="site-06-privacy-document__basis">{fact.source}</p><p className="site-06-privacy-document__boundary">{fact.boundary}</p></header>
					<section><h2>只要求三项可见信息</h2><p>姓名、电话和公司，是中文咨询申请唯一要求填写的可见字段。</p></section>
					<section><h2>这些信息只用于回复这次咨询</h2><p>我们用这些信息理解并回复本次申请。若申请未完成，页面会保留已填内容，方便再次尝试；浏览器分析不会收到表单字段内容。</p></section>
					<section><h2>回到一道具体问题</h2><div><p>第一次沟通不要求长问卷或预先准备完整报告。</p><ActionLink href="/zh/diagnostic">返回预约沟通</ActionLink></div></section>
				</article>
			</div>
		</ChinaShell>
	);
}

export const CHINA_PAGES = {
	home: ChinaHomePage,
	product: ChinaProductPage,
	approach: ChinaApproachPage,
	geo: ChinaGeoPage,
	company: ChinaCompanyPage,
	diagnostic: ChinaDiagnosticPage,
	privacy: ChinaPrivacyPage,
} as const satisfies Record<HumanPageKey, () => ReactNode>;
