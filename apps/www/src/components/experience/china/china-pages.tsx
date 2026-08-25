import { CHINA_COPY, CHINA_PRODUCT_STAGES, CHINA_SITUATIONS } from "@/content/experience/china-copy";
import { LeadForm } from "../shared/lead-form";
import {
	AiAnswerFlow,
	BrandGapConsole,
	CompanyNetwork,
	ConsultationBrief,
	GlobalMarketBridge,
	PrivacyPath,
	ServiceRoute,
} from "./china-scenes";
import { ChinaShell } from "./china-shell";
import "../../../styles/experience/china.css";

export function ChinaHomePage() {
	const copy = CHINA_COPY.home;
	return (
		<ChinaShell pageKey="home" scene="ai-answer-flow">
			<div className="china-home">
				<section className="china-home-hero">
					<div className="china-home-hero__copy">
						<span className="china-eyebrow">{copy.eyebrow}</span>
						<h1>{copy.title}</h1>
						<p>{copy.lead}</p>
						<div className="china-actions">
							<a className="china-action" href="/zh/diagnostic">
								{copy.primaryCta} <span aria-hidden="true">↗</span>
							</a>
							<a className="china-text-link" href="/zh/product">
								先看产品怎么工作 <span aria-hidden="true">→</span>
							</a>
						</div>
						<div className="china-home-hero__shift" role="img" aria-label="客户决策方式变化">
							<span>传统路径</span>
							<strong>搜索 → 浏览 → 比较</strong>
							<i aria-hidden="true">↓</i>
							<span>AI 参与的新路径</span>
							<strong>提问 → 获得答案 → 缩小选择</strong>
						</div>
					</div>
					<AiAnswerFlow />
				</section>

				<section className="china-situation-band" aria-labelledby="china-situations-title">
					<header>
						<span>你可能已经遇到</span>
						<h2 id="china-situations-title">问题不是“要不要做 AI”，而是品牌正在怎样被理解</h2>
					</header>
					<div>
						{CHINA_SITUATIONS.map((item, index) => (
							<article key={item.id}>
								<span>{String(index + 1).padStart(2, "0")}</span>
								<h3>{item.label}</h3>
								<p>{item.answer}</p>
							</article>
						))}
					</div>
				</section>

				<section className="china-home-story">
					<div className="china-home-story__statement">
						<span>你能看到</span>
						<h2>把担心落到具体答案上</h2>
						<p>从一个客户问题开始，查看完整答案、品牌描述和竞品；如答案提供引用，再查看相应来源，并比较之后的变化。</p>
						<a className="china-text-link" href="/zh/product">
							了解产品 <span aria-hidden="true">→</span>
						</a>
					</div>
					<ol className="china-home-story__route">
						{CHINA_PRODUCT_STAGES.map((stage, index) => (
							<li key={stage.id}>
								<span>{String(index + 1).padStart(2, "0")}</span>
								<div>
									<strong>{stage.label}</strong>
									<p>{stage.body}</p>
								</div>
								<small>{stage.output}</small>
							</li>
						))}
					</ol>
				</section>

				<section className="china-home-global">
					<div className="china-home-global__map" aria-hidden="true">
						<span className="china-home-global__cn">中国</span>
						<i />
						<i />
						<i />
						<span>目标市场</span>
						<span>目标语言</span>
						<span>当地问题</span>
					</div>
					<div className="china-home-global__copy">
						<span>中国市场 × 海外目标市场</span>
						<h2>服务中国市场，也支持企业进入已确定的海外目标市场</h2>
						<p>
							不同市场里的客户，用不同语言、不同标准理解品牌。Yonaris 不做逐句翻译，而是从当地客户会提出的问题重新开始。
						</p>
						<div>
							<a href="/zh/geo">
								查看全球市场能力 <span aria-hidden="true">→</span>
							</a>
							<small>市场 · 语言 · 购买问题 · 竞争语境</small>
						</div>
					</div>
				</section>

				<section className="china-home-lead">
					<div>
						<span>从一个具体问题开始</span>
						<h2>{copy.closingTitle}</h2>
						<p>{copy.closingBody}</p>
					</div>
					<LeadForm locale="zh" compact />
				</section>
			</div>
		</ChinaShell>
	);
}

export function ChinaProductPage() {
	const copy = CHINA_COPY.product;
	return (
		<ChinaShell pageKey="product" scene="brand-gap-console">
			<div className="china-product">
				<section className="china-product-intro">
					<div>
						<span className="china-eyebrow">{copy.eyebrow}</span>
						<h1>{copy.title}</h1>
					</div>
					<div>
						<p>{copy.lead}</p>
						<a className="china-action" href="/zh/diagnostic">
							{copy.primaryCta} <span aria-hidden="true">↗</span>
						</a>
					</div>
				</section>

				<section className="china-product-workspace" aria-labelledby="product-workspace-title">
					<header>
						<span>一个问题，四个业务视角</span>
						<h2 id="product-workspace-title">客户怎么问，AI 怎么答，品牌先看哪里</h2>
						<p>切换四个视角，查看同一个问题下的答案、品牌比较和之后的变化。</p>
					</header>
					<BrandGapConsole />
				</section>

				<section className="china-product-outputs" aria-labelledby="product-output-title">
					<div className="china-product-outputs__title">
						<span>每一步都回答一个业务问题</span>
						<h2 id="product-output-title">客户怎么问、AI 怎么答、先看哪里、后来怎么变</h2>
					</div>
					<div className="china-product-outputs__stack">
						{CHINA_PRODUCT_STAGES.map((stage, index) => (
							<article key={stage.id}>
								<span>{String(index + 1).padStart(2, "0")}</span>
								<div>
									<h3>{stage.output}</h3>
									<p>{stage.body}</p>
								</div>
								<i aria-hidden="true">↗</i>
							</article>
						))}
					</div>
				</section>

				<section className="china-product-close">
					<span>带着你的问题来</span>
					<h2>{copy.closingTitle}</h2>
					<p>{copy.closingBody}</p>
					<a className="china-action" href="/zh/diagnostic">
						开始沟通 <span aria-hidden="true">↗</span>
					</a>
				</section>
			</div>
		</ChinaShell>
	);
}

export function ChinaApproachPage() {
	const copy = CHINA_COPY.approach;
	return (
		<ChinaShell pageKey="approach" scene="service-route">
			<div className="china-approach">
				<section className="china-approach-intro">
					<div className="china-approach-intro__index" aria-hidden="true">
						<span>01</span>
						<i />
						<span>04</span>
					</div>
					<div>
						<span className="china-eyebrow">{copy.eyebrow}</span>
						<h1>{copy.title}</h1>
						<p>{copy.lead}</p>
						<a className="china-action" href="/zh/diagnostic">
							{copy.primaryCta} <span aria-hidden="true">↗</span>
						</a>
					</div>
				</section>

				<section className="china-approach-router" aria-labelledby="service-router-title">
					<header>
						<span>选择你最接近的情况</span>
						<h2 id="service-router-title">问题不同，服务起点也不同</h2>
					</header>
					<ServiceRoute />
				</section>

				<section className="china-approach-promise">
					<div>
						<span>01</span>
						<strong>起点清楚</strong>
						<p>从品牌、市场、语言和客户问题开始。</p>
					</div>
					<div>
						<span>02</span>
						<strong>答案看得懂</strong>
						<p>查看完整回答、品牌描述、竞品和答案列出的引用来源（如有）。</p>
					</div>
					<div>
						<span>03</span>
						<strong>下一步明确</strong>
						<p>先判断哪一处品牌表达或市场差异更值得关注。</p>
					</div>
				</section>

				<section className="china-approach-close">
					<div>
						<span>从小处开始</span>
						<h2>{copy.closingTitle}</h2>
					</div>
					<div>
						<p>{copy.closingBody}</p>
						<a href="/zh/diagnostic">
							预约第一次沟通 <span aria-hidden="true">↗</span>
						</a>
					</div>
				</section>
			</div>
		</ChinaShell>
	);
}

export function ChinaGeoPage() {
	const copy = CHINA_COPY.geo;
	return (
		<ChinaShell pageKey="geo" scene="global-market-bridge">
			<div className="china-geo">
				<section className="china-geo-intro">
					<div>
						<span className="china-eyebrow">{copy.eyebrow}</span>
						<h1>{copy.title}</h1>
						<p>{copy.lead}</p>
						<a className="china-action" href="/zh/diagnostic">
							{copy.primaryCta} <span aria-hidden="true">↗</span>
						</a>
					</div>
					<div className="china-geo-intro__signal" role="img" aria-label="从中国连接全球市场">
						<strong>中国</strong>
						<i />
						<span>目标市场</span>
						<i />
						<strong>当地客户问题</strong>
					</div>
				</section>

				<section className="china-geo-bridge" aria-labelledby="market-bridge-title">
					<header>
						<span>切换市场，看问题怎样改变</span>
						<h2 id="market-bridge-title">同一个品牌，在不同市场面对不同的购买问题</h2>
					</header>
					<GlobalMarketBridge />
				</section>

				<section className="china-geo-contrast">
					<div>
						<span>只换语言</span>
						<h2>中文表达逐句搬到海外</h2>
						<ul>
							<li>沿用中国市场的问题</li>
							<li>忽略当地品类定义</li>
							<li>品牌容易被重新归类</li>
						</ul>
					</div>
					<i aria-hidden="true">≠</i>
					<div>
						<span>重新理解市场</span>
						<h2>从当地客户会怎么问开始</h2>
						<ul>
							<li>使用目标市场语言</li>
							<li>进入当地竞争语境</li>
							<li>保持核心品牌事实一致</li>
						</ul>
					</div>
				</section>

				<section className="china-geo-close">
					<div>
						<span>面向中国企业的全球市场支持</span>
						<h2>{copy.closingTitle}</h2>
						<p>{copy.closingBody}</p>
					</div>
					<a className="china-action" href="/zh/diagnostic">
						告诉我们目标市场 <span aria-hidden="true">↗</span>
					</a>
				</section>
			</div>
		</ChinaShell>
	);
}

export function ChinaCompanyPage() {
	const copy = CHINA_COPY.company;
	return (
		<ChinaShell pageKey="company" scene="company-network">
			<div className="china-company">
				<section className="china-company-intro">
					<div>
						<span className="china-eyebrow">{copy.eyebrow}</span>
						<h1>{copy.title}</h1>
						<p>{copy.lead}</p>
						<a className="china-action" href="/zh/diagnostic">
							和 Yonaris 沟通 <span aria-hidden="true">↗</span>
						</a>
					</div>
					<CompanyNetwork />
				</section>

				<section className="china-company-belief">
					<header>
						<span>我们为什么做 Yonaris</span>
						<h2>越来越多客户会先问 AI，企业需要先知道答案是什么</h2>
					</header>
					<div>
						<article>
							<span>客户问题</span>
							<h3>先看客户怎么问</h3>
							<p>不从抽象趋势开始，从会影响选择的问题开始。</p>
						</article>
						<article>
							<span>品牌表达</span>
							<h3>看清 AI 怎么说</h3>
							<p>看见品牌被忽略、混淆或说偏的位置。</p>
						</article>
						<article>
							<span>市场语境</span>
							<h3>按选定市场重新理解</h3>
							<p>分别看当地语言、客户问题和竞品怎样改变答案。</p>
						</article>
					</div>
				</section>

				<section className="china-company-regions">
					<div className="china-company-regions__china">
						<span>中国市场</span>
						<strong>理解中文客户如何提问、比较和选择</strong>
					</div>
					<i aria-hidden="true">Y</i>
					<div className="china-company-regions__global">
						<span>海外目标市场</span>
						<strong>按目标语言与当地语境重新理解品牌</strong>
					</div>
				</section>

				<section className="china-company-close">
					<span>Yonaris</span>
					<h2>{copy.closingTitle}</h2>
					<p>{copy.closingBody}</p>
					<div>
						<a className="china-action" href="/zh/diagnostic">
							开始沟通 <span aria-hidden="true">↗</span>
						</a>
						<a href="/zh/geo">查看全球市场能力 →</a>
					</div>
				</section>
			</div>
		</ChinaShell>
	);
}

export function ChinaDiagnosticPage() {
	const copy = CHINA_COPY.diagnostic;
	return (
		<ChinaShell pageKey="diagnostic" scene="consultation-brief">
			<div className="china-diagnostic">
				<section className="china-diagnostic-intro">
					<div>
						<span className="china-eyebrow">{copy.eyebrow}</span>
						<h1>{copy.title}</h1>
						<p>{copy.lead}</p>
					</div>
					<ConsultationBrief />
				</section>
				<section className="china-diagnostic-form" aria-label="预约沟通表单">
					<div>
						<span>只需三项</span>
						<h2>{copy.closingTitle}</h2>
						<p>{copy.closingBody}</p>
					</div>
					<LeadForm locale="zh" />
				</section>
			</div>
		</ChinaShell>
	);
}

export function ChinaPrivacyPage() {
	const copy = CHINA_COPY.privacy;
	return (
		<ChinaShell pageKey="privacy" scene="privacy-path">
			<div className="china-privacy">
				<section className="china-privacy-intro">
					<div>
						<span className="china-eyebrow">{copy.eyebrow}</span>
						<h1>{copy.title}</h1>
						<p>{copy.lead}</p>
						<a className="china-text-link" href="/zh/diagnostic">
							{copy.primaryCta} <span aria-hidden="true">→</span>
						</a>
					</div>
					<PrivacyPath />
				</section>

				<section className="china-privacy-details">
					<article>
						<span>01</span>
						<h2>收集哪些信息</h2>
						<p>咨询表单只需要姓名、电话和公司，不要求填写职位、行业或详细业务资料。</p>
					</article>
					<article>
						<span>02</span>
						<h2>为什么需要这些信息</h2>
						<p>姓名用于确认称呼，电话用于回复咨询，公司帮助我们了解基本业务背景。</p>
					</article>
					<article>
						<span>03</span>
						<h2>这些信息如何使用</h2>
						<p>只用于回复本次咨询、了解你的需求和安排后续沟通，不会出现在公开页面。</p>
					</article>
				</section>

				<section className="china-privacy-close">
					<div>
						<span>信息用途</span>
						<h2>{copy.closingTitle}</h2>
						<p>{copy.closingBody}</p>
					</div>
					<a className="china-action" href="/zh/diagnostic">
						返回预约沟通 <span aria-hidden="true">↗</span>
					</a>
				</section>
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
} as const;
