import {
	CHINA_COPY,
	CHINA_DIAGNOSTIC_OUTPUTS,
	CHINA_PRODUCT_STAGES,
	CHINA_SITUATIONS,
} from "@/content/experience/china-copy";
import { LeadForm } from "../shared/lead-form";
import { DeliveryTruth, ManagedReviewTrust, PublicRecordTrust } from "../shared/public-trust";
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
	const [titleBeforePriority, titleAfterPriority] = copy.title.split("第一解释权");
	return (
		<ChinaShell pageKey="home" scene="ai-answer-flow">
			<div className="china-home">
				<section className="china-home-hero">
					<div className="china-home-hero__copy">
						<span className="china-eyebrow">{copy.eyebrow}</span>
						<h1 aria-label={copy.title}>
							{titleBeforePriority}
							<span className="china-home-title__lexeme">第一解释权</span>
							{titleAfterPriority}
						</h1>
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
							<div className="china-home-hero__shift-row">
								<span>客户的新入口</span>
								<strong>先问 AI → 形成判断 → 缩小选择</strong>
							</div>
							<i aria-hidden="true">↓</i>
							<div className="china-home-hero__shift-row">
								<span>品牌要核对</span>
								<strong>有没有出现 → 卖点准不准 → 竞争位置怎样</strong>
							</div>
						</div>
					</div>
					<AiAnswerFlow />
				</section>

				<section className="china-situation-band" aria-labelledby="china-situations-title">
					<header>
						<span>可能损失的生意判断</span>
						<h2 id="china-situations-title">客户已经在问，品牌可能在哪一步掉出选择</h2>
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
						<span>一次摸底会得到什么</span>
						<h2>四项输出，直接带进业务会</h2>
						<p>不是给一个模糊分数，而是把观察范围、答案原文、品牌差距和下一步动作放在同一份记录里。</p>
						<a className="china-text-link" href="/zh/product">
							看一份摸底记录怎么形成 <span aria-hidden="true">→</span>
						</a>
					</div>
					<ol className="china-home-story__route">
						{CHINA_DIAGNOSTIC_OUTPUTS.map((output, index) => (
							<li key={output.id}>
								<span>{String(index + 1).padStart(2, "0")}</span>
								<div>
									<strong>{output.label}</strong>
									<p>{output.body}</p>
								</div>
								<small>可核对</small>
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
						<span>中国市场基线 × 目标市场对照</span>
						<h2>出海不是翻译官网，而是重做一遍当地品类心智。</h2>
						<p>先保留中国市场里的定位基线，再按已确定的国家、语言、当地购买角色和对标品牌重新圈定问题。</p>
						<div>
							<a href="/zh/geo">
								查看目标市场对照 <span aria-hidden="true">→</span>
							</a>
							<small>国家 · 语言 · 购买角色 · 对标品牌</small>
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
						<span>一份记录，四个动作</span>
						<h2 id="product-workspace-title">圈定问题、拆答案、找掉点、做复盘</h2>
						<p>每次切换都保留观察结果和下一步优先级，团队可以在会上沿同一条记录继续判断。</p>
					</header>
					<BrandGapConsole />
				</section>

				<section className="china-product-outputs" aria-labelledby="product-output-title">
					<div className="china-product-outputs__title">
						<span>会前有证据，会中能判断</span>
						<h2 id="product-output-title">不是评分，是一份能逐条核对的业务记录</h2>
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

				<ManagedReviewTrust locale="zh" />

				<section className="china-product-close">
					<span>下一步优先级</span>
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
						<span>按生意问题选择起点</span>
						<h2 id="service-router-title">先查哪一类掉点，再决定怎么做</h2>
					</header>
					<ServiceRoute />
				</section>

				<section className="china-approach-promise">
					<div>
						<span>01</span>
						<strong>问题范围先确认</strong>
						<p>市场、语言、购买问题和对标对象写进同一张范围卡。</p>
					</div>
					<div>
						<span>02</span>
						<strong>可见答案逐项核对</strong>
						<p>保留完整回答、品牌描述、对标对象和答案列出的引用（如有）。</p>
					</div>
					<div>
						<span>03</span>
						<strong>下一步排优先级</strong>
						<p>根据当前差距决定先核对哪一项，不把范围外结果写进结论。</p>
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
							预约一次品牌体检 <span aria-hidden="true">↗</span>
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
						<strong>中国市场基线</strong>
						<i />
						<span>目标国家 / 目标语言</span>
						<i />
						<strong>当地购买角色</strong>
					</div>
				</section>

				<section className="china-geo-bridge" aria-labelledby="market-bridge-title">
					<header>
						<span>先有基线，再做对照</span>
						<h2 id="market-bridge-title">只增加已定义的国家、语言和购买语境</h2>
					</header>
					<GlobalMarketBridge />
				</section>

				<section className="china-geo-contrast">
					<div>
						<span>中国市场基线</span>
						<h2>先记录品牌在中文购买问题里怎么被理解</h2>
						<ul>
							<li>中文品类表达</li>
							<li>企业采购角色</li>
							<li>同一组购买问题与对标对象</li>
						</ul>
					</div>
					<i aria-hidden="true">→</i>
					<div>
						<span>目标市场对照</span>
						<h2>出海不是翻译官网，而是重做一遍当地品类心智。</h2>
						<ul>
							<li>目标国家与目标语言</li>
							<li>当地购买角色与问法</li>
							<li>指定对标品牌</li>
						</ul>
					</div>
				</section>

				<section className="china-geo-close">
					<div>
						<span>支持企业进入已确定的海外目标市场</span>
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
						<span>范围与限制</span>
						<h2>查清当次答案，不把范围外结果包装成结论</h2>
					</header>
					<div>
						<article>
							<span>范围</span>
							<h3>先确认观察边界</h3>
							<p>市场、语言、购买问题和对标品牌没有确认，就不混在一起判断。</p>
						</article>
						<article>
							<span>证据</span>
							<h3>保留答案原文</h3>
							<p>核对品牌描述、比较项和答案列出的引用（如有），不只给摘要。</p>
						</article>
						<article>
							<span>限制</span>
							<h3>不替第三方答案下结论</h3>
							<p>只说明当前范围里观察到什么，并给出可复盘的工作优先级。</p>
						</article>
					</div>
				</section>

				<PublicRecordTrust locale="zh" />

				<section className="china-company-regions">
					<div className="china-company-regions__china">
						<span>中国市场基线</span>
						<strong>记录中文客户如何提问、比较和理解品类</strong>
					</div>
					<i aria-hidden="true">Y</i>
					<div className="china-company-regions__global">
						<span>海外目标市场</span>
						<strong>按目标语言、购买角色和当地品类重新核对品牌</strong>
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
				<section className="china-diagnostic-form" id="china-contact-form" aria-label="预约沟通表单">
					<div>
						<span>姓名 / 电话 / 公司</span>
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
						<p>用于回复这次咨询、了解基本需求和安排后续沟通，不会显示在公开页面。</p>
					</article>
				</section>

				<DeliveryTruth locale="zh" />

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
