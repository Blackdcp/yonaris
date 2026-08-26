import type { ReactNode } from "react";
import { CHINA_COPY } from "@/content/experience/china-copy";
import type { HumanPageKey } from "@/content/experience/types";
import { LeadForm } from "../shared/lead-form";
import {
	AnxietySelector,
	BreakdownReplay,
	CompanyReadingScene,
	HomeReadingScene,
	MarketConditionsRecord,
	SystemRelationshipMap,
} from "./china-scenes";
import { ChinaShell } from "./china-shell";

function ActionLink({ href, children }: { href: string; children: ReactNode }) {
	return (
		<a className="site-06-action" href={href}>
			{children}
		</a>
	);
}

function Photo({ src, alt, credit }: { src: string; alt: string; credit: string }) {
	return (
		<figure className="site-06-hero__media">
			<img src={src} alt={alt} />
			<figcaption>{credit}</figcaption>
		</figure>
	);
}

function Hero({ pageKey, media }: { pageKey: HumanPageKey; media: ReactNode }) {
	const copy = CHINA_COPY[pageKey];
	return (
		<section className="site-06-hero">
			<div className="site-06-hero__copy">
				<p className="site-06-kicker">{copy.eyebrow}</p>
				<h1>{copy.title}</h1>
				<p className="site-06-hero__lead">{copy.lead}</p>
				<ActionLink href={copy.primaryAction.href}>{copy.primaryAction.label}</ActionLink>
			</div>
			{media}
		</section>
	);
}

function ClosingSection({ pageKey }: { pageKey: HumanPageKey }) {
	const copy = CHINA_COPY[pageKey];
	return (
		<section className="site-06-section site-06-close">
			<h2>{copy.closingTitle}</h2>
			<p className="site-06-hero__lead">{copy.closingBody}</p>
			<ActionLink href={copy.primaryAction.href}>{copy.primaryAction.label}</ActionLink>
		</section>
	);
}

export function ChinaHomePage() {
	return (
		<ChinaShell pageKey="home">
			<Hero
				pageKey="home"
				media={
					<Photo
						src="/brand/site-06/business-walk.jpg"
						alt="两位商务人士在现代办公园区交流"
						credit="Photo: Mikhail Nilov / Pexels"
					/>
				}
			/>

			<section className="site-06-section">
				<header className="site-06-section__intro">
					<p className="site-06-kicker">真正要担心的，不是 AI 有没有提到你</p>
					<h2>客户已经拿着答案做选择，你却看不见自己在哪里被漏掉。</h2>
					<p className="site-06-hero__lead">选一个最接近当前处境的问题，看它怎样改变诊断和生意影响。</p>
				</header>
				<AnxietySelector />
			</section>

			<section className="site-06-section">
				<header className="site-06-section__intro">
					<p className="site-06-kicker">把业务问题接回证据</p>
					<h2>目标不是更多曝光，而是把“为什么选你”接到可信依据上。</h2>
					<p className="site-06-hero__lead">
						当客户问题、品牌事实、公开内容和答案各说各话，预算只会继续分散。把它们接到可观察的客户行为上，团队才能判断下一步先动哪里。
					</p>
				</header>
				<article className="site-06-evidence-document" aria-label="业务问题与证据连接示例">
					<p className="site-06-evidence-document__answer">谁能降低复杂交付中的决策风险？</p>
					<dl>
						<div>
							<dt>客户真正关心</dt>
							<dd>这是进入比较的业务条件，不是一句传播口号。</dd>
						</div>
						<div>
							<dt>品牌需要证明</dt>
							<dd>把适用条件、能力范围与可核对来源放在一起。</dd>
						</div>
						<div>
							<dt>客户行为</dt>
							<dd>观察是否进入进一步了解、询盘或真实比较，不把提及当成选择。</dd>
						</div>
					</dl>
				</article>
			</section>

			<section className="site-06-section">
				<header className="site-06-section__intro">
					<p className="site-06-kicker">同一条公开事实，两种阅读需要</p>
					<h2>人需要决策语境，Agent 需要事实、证据与适用范围。</h2>
				</header>
				<HomeReadingScene />
			</section>

			<ClosingSection pageKey="home" />
		</ChinaShell>
	);
}

export function ChinaProductPage() {
	return (
		<ChinaShell pageKey="product">
			<Hero pageKey="product" media={<SystemRelationshipMap />} />

			<section className="site-06-section">
				<header className="site-06-section__intro">
					<p className="site-06-kicker">连接比堆叠更重要</p>
					<h2>任何一个节点断开，预算都会失去判断依据。</h2>
					<p className="site-06-hero__lead">
						这不是线性流程，也不是一次性报告。团队围绕同一道市场问题，查看品牌事实在哪里被承接、当时观察到什么、客户怎样回应，以及下一次要复核什么。
					</p>
				</header>
				<article className="site-06-evidence-document">
					<dl>
						<div>
							<dt>预算判断</dt>
							<dd>先投到影响当前选择的断点，不用同时重做所有公开内容。</dd>
						</div>
						<div>
							<dt>可观察记录</dt>
							<dd>保留特定市场、语言、问题和时间下的答案，不包装成实时能力。</dd>
						</div>
						<div>
							<dt>复核条件</dt>
							<dd>只有问题与观察条件可比较，前后变化才值得进入下一次决定。</dd>
						</div>
					</dl>
				</article>
			</section>

			<ClosingSection pageKey="product" />
		</ChinaShell>
	);
}

export function ChinaApproachPage() {
	return (
		<ChinaShell pageKey="approach">
			<Hero
				pageKey="approach"
				media={
					<Photo
						src="/brand/site-06/conference-room.jpg"
						alt="暖色日光中的会议空间"
						credit="Photo: Nastuh Abootalebi / Unsplash"
					/>
				}
			/>

			<section className="site-06-section">
				<header className="site-06-section__intro">
					<h2>同一道问题不动，让证据和判断接受复核。</h2>
					<p className="site-06-hero__lead">
						以下去标识记录只演示怎么从答案走到行动。它不代表真实客户，也不把一次变化写成因果结论。
					</p>
				</header>
				<BreakdownReplay />
			</section>

			<ClosingSection pageKey="approach" />
		</ChinaShell>
	);
}

export function ChinaGeoPage() {
	return (
		<ChinaShell pageKey="geo" tone="paper">
			<Hero pageKey="geo" media={<MarketConditionsRecord />} />

			<section className="site-06-section">
				<header className="site-06-section__intro">
					<h2>变化的是判断条件，不是公司身份。</h2>
					<p className="site-06-hero__lead">
						同一项品牌事实，在不同语言和商业语境里可能进入不同的品类框架，也会面对不同替代选择。每次观察都把这些条件留在记录里。
					</p>
				</header>
				<article className="site-06-evidence-document">
					<dl>
						<div>
							<dt>市场与语言</dt>
							<dd>客户怎样描述问题，以及哪些公开材料能被找到。</dd>
						</div>
						<div>
							<dt>当地品类表述与替代选择</dt>
							<dd>答案采用什么比较框架，客户会把哪些方案放在一起看。</dd>
						</div>
						<div>
							<dt>证据条件</dt>
							<dd>来源、适用范围、核对日期和限制共同决定这次阅读能说明什么。</dd>
						</div>
					</dl>
				</article>
			</section>

			<ClosingSection pageKey="geo" />
		</ChinaShell>
	);
}

export function ChinaCompanyPage() {
	return (
		<ChinaShell pageKey="company">
			<Hero
				pageKey="company"
				media={
					<Photo
						src="/brand/site-06/glass-venue.jpg"
						alt="人们穿行在通透的商务空间"
						credit="Photo: Zerrin Velizade / Pexels"
					/>
				}
			/>

			<section className="site-06-section">
				<header className="site-06-section__intro">
					<p className="site-06-kicker">品类、目的与范围</p>
					<h2>公开事实只有一份，人的判断和 Agent 的读取各取所需。</h2>
				</header>
				<CompanyReadingScene />
			</section>

			<section className="site-06-section">
				<h2>机器可读，不等于机器写作。</h2>
				<p className="site-06-hero__lead">
					清楚的标题、稳定地址、可见来源、有范围的事实和一致公开记录有助于检索与核对，但不保证排名、收录、检索或引用。
				</p>
				<ActionLink href="/zh/agent/company">阅读对应的 Agent 记录</ActionLink>
			</section>

			<ClosingSection pageKey="company" />
		</ChinaShell>
	);
}

export function ChinaDiagnosticPage() {
	return (
		<ChinaShell pageKey="diagnostic">
			<Hero
				pageKey="diagnostic"
				media={
					<Photo
						src="/brand/site-06/glass-venue.jpg"
						alt="人们在商务空间里交流"
						credit="Photo: Zerrin Velizade / Pexels"
					/>
				}
			/>

			<section className="site-06-section" id="contact-form">
				<LeadForm locale="zh" />
			</section>
		</ChinaShell>
	);
}

export function ChinaPrivacyPage() {
	return (
		<ChinaShell pageKey="privacy" tone="paper">
			<Hero
				pageKey="privacy"
				media={
					<article className="site-06-evidence-document" aria-label="咨询表单可见字段">
						<span>咨询申请</span>
						<p className="site-06-evidence-document__answer">姓名 · 电话 · 公司</p>
						<p>只要求这三个可见字段；隐藏的反滥用字段不会要求你填写。</p>
					</article>
				}
			/>

			<section className="site-06-section">
				<h2>投递服务接受申请后，页面才显示已送出。</h2>
				<article className="site-06-evidence-document">
					<p>
						表单使用这些信息回复本次咨询。若投递没有确认，页面会保留已填内容并提供重试；浏览器分析不会收到表单字段内容。
					</p>
				</article>
			</section>

			<ClosingSection pageKey="privacy" />
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
