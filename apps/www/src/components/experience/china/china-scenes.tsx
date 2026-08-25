"use client";

import { useState } from "react";
import {
	CHINA_MARKETS,
	CHINA_PRODUCT_STAGES,
	CHINA_SERVICE_SITUATIONS,
	CHINA_SITUATIONS,
} from "@/content/experience/china-copy";

export function AiAnswerFlow() {
	const [activeId, setActiveId] = useState<(typeof CHINA_SITUATIONS)[number]["id"]>("missing");
	const active = CHINA_SITUATIONS.find((item) => item.id === activeId) ?? CHINA_SITUATIONS[0];

	return (
		<section className="china-answer-flow" aria-label="品牌在 AI 答案中的四种处境">
			<div className="china-answer-flow__controls" role="tablist" aria-label="选择你最关心的情况">
				{CHINA_SITUATIONS.map((item, index) => (
					<button
						key={item.id}
						type="button"
						role="tab"
						data-situation-control={item.id}
						aria-selected={active.id === item.id}
						aria-controls="china-answer-panel"
						onClick={() => setActiveId(item.id)}
					>
						<span>{String(index + 1).padStart(2, "0")}</span>
						{item.label}
					</button>
				))}
			</div>

			<div className="china-answer-flow__stage" id="china-answer-panel" role="tabpanel" aria-live="polite">
				<div className="china-answer-flow__window-bar">
					<span aria-hidden="true" />
					<span aria-hidden="true" />
					<span aria-hidden="true" />
					<strong>客户正在问</strong>
					<small>购买问题 · 中国 / 全球</small>
				</div>
				<div className="china-answer-flow__question">
					<span>Q</span>
					<p>{active.question}</p>
				</div>
				<div className="china-answer-flow__answer">
					<div className="china-answer-flow__avatar" aria-hidden="true">
						AI
					</div>
					<div>
						<small>答案里的品牌位置</small>
						<strong>{active.answer}</strong>
						<div className="china-answer-flow__signals" role="img" aria-label="答案内容">
							<span>品牌</span>
							<span>竞品</span>
							<span>品类</span>
							<span>市场</span>
						</div>
					</div>
				</div>
				<div className="china-answer-flow__move">
					<span>可以先看</span>
					<p>{active.action}</p>
					<i aria-hidden="true">↗</i>
				</div>
			</div>
		</section>
	);
}
export function BrandGapConsole() {
	const [activeId, setActiveId] = useState<(typeof CHINA_PRODUCT_STAGES)[number]["id"]>("ask");
	const active = CHINA_PRODUCT_STAGES.find((item) => item.id === activeId) ?? CHINA_PRODUCT_STAGES[0];

	return (
		<section className="china-gap-console" aria-label="查看一个客户问题的四个业务视角">
			<div className="china-gap-console__rail" role="tablist" aria-label="四个业务视角">
				{CHINA_PRODUCT_STAGES.map((stage, index) => (
					<button
						key={stage.id}
						type="button"
						role="tab"
						aria-selected={active.id === stage.id}
						aria-controls="china-product-panel"
						onClick={() => setActiveId(stage.id)}
					>
						<span>{String(index + 1).padStart(2, "0")}</span>
						<strong>{stage.label}</strong>
					</button>
				))}
			</div>
			<div className="china-gap-console__workspace" id="china-product-panel" role="tabpanel" aria-live="polite">
				<header>
					<div>
						<span>AI 答案概览</span>
						<small>一个问题，一条清晰路径</small>
					</div>
					<i aria-hidden="true">Y</i>
				</header>
				<div className="china-gap-console__body">
					<aside aria-label="问题上下文">
						<span>目标市场</span>
						<strong>中国市场</strong>
						<span>客户问题</span>
						<strong>这类方案应该怎么选？</strong>
						<span>比较对象</span>
						<strong>品牌 / 同类选择</strong>
					</aside>
					<section>
						<small>{active.label}</small>
						<h3>{active.title}</h3>
						<p>{active.body}</p>
						<div className="china-gap-console__answer-lines" aria-hidden="true">
							<span />
							<span />
							<span />
							<span />
						</div>
						<div className="china-gap-console__output">
							<span>你会看到</span>
							<strong>{active.output}</strong>
						</div>
					</section>
				</div>
			</div>
		</section>
	);
}

export function ServiceRoute() {
	const [activeId, setActiveId] = useState<(typeof CHINA_SERVICE_SITUATIONS)[number]["id"]>("visibility");
	const active = CHINA_SERVICE_SITUATIONS.find((item) => item.id === activeId) ?? CHINA_SERVICE_SITUATIONS[0];

	return (
		<section className="china-service-route" aria-label="按品牌问题选择查看起点">
			<div className="china-service-route__map" role="tablist" aria-label="选择品牌问题">
				{CHINA_SERVICE_SITUATIONS.map((service) => (
					<button
						key={service.id}
						type="button"
						role="tab"
						aria-selected={active.id === service.id}
						aria-controls="china-service-panel"
						onClick={() => setActiveId(service.id)}
					>
						<span>{service.number}</span>
						<strong>{service.situation}</strong>
						<i aria-hidden="true">→</i>
					</button>
				))}
			</div>
			<article className="china-service-route__detail" id="china-service-panel" role="tabpanel" aria-live="polite">
				<span>可以先看</span>
				<h3>{active.startingPoint}</h3>
				<p>{active.description}</p>
				<div>
					<small>先回答这几个问题</small>
					<ul>
						{active.visibleItems.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</div>
				<a href="/zh/diagnostic">
					从这个问题开始沟通 <span aria-hidden="true">↗</span>
				</a>
			</article>
		</section>
	);
}

export function GlobalMarketBridge() {
	const [activeId, setActiveId] = useState<(typeof CHINA_MARKETS)[number]["id"]>("china");
	const active = CHINA_MARKETS.find((item) => item.id === activeId) ?? CHINA_MARKETS[0];

	return (
		<section className="china-market-bridge" aria-label="中国与海外目标市场服务路径">
			<div className="china-market-bridge__controls" role="tablist" aria-label="选择目标市场">
				{CHINA_MARKETS.map((market) => (
					<button
						key={market.id}
						type="button"
						role="tab"
						data-market-control={market.id}
						aria-selected={active.id === market.id}
						aria-controls="china-market-panel"
						onClick={() => setActiveId(market.id)}
					>
						{market.label}
					</button>
				))}
			</div>
			<div className="china-market-bridge__canvas" id="china-market-panel" role="tabpanel" aria-live="polite">
				<section data-market-track="china">
					<span>01 · 服务中国市场</span>
					<strong>从中文客户的真实问题出发</strong>
					<p>理解本地品类表达、购买习惯和国内 AI 场景。</p>
				</section>
				<div className="china-market-bridge__route" aria-hidden="true">
					<i />
					<i />
					<b>Y</b>
					<i />
					<i />
				</div>
				<section data-market-track="global">
					<span>02 · 支持企业进入海外目标市场</span>
					<strong>按选定市场重新理解客户问题</strong>
					<p>按当地语言和购买习惯，查看问题、答案与竞品差异。</p>
				</section>
				<article className="china-market-bridge__readout">
					<small>{active.label} · 当前视角</small>
					<h3>{active.question}</h3>
					<p>{active.context}</p>
					<strong>{active.move}</strong>
				</article>
			</div>
		</section>
	);
}

export function CompanyNetwork() {
	return (
		<div className="china-company-network" role="img" aria-label="Yonaris 的工作连接">
			<div className="china-company-network__orbit" aria-hidden="true">
				<span />
				<span />
				<span />
			</div>
			<div className="china-company-network__center">
				<img src="/brand/logos/yonaris-wordmark-navy.png" alt="Yonaris" width="174" height="38" />
				<p>从客户问题出发</p>
			</div>
			<div className="china-company-network__node china-company-network__node--one">
				<span>01</span>
				<strong>市场语言</strong>
			</div>
			<div className="china-company-network__node china-company-network__node--two">
				<span>02</span>
				<strong>品牌事实</strong>
			</div>
			<div className="china-company-network__node china-company-network__node--three">
				<span>03</span>
				<strong>AI 答案</strong>
			</div>
			<div className="china-company-network__node china-company-network__node--four">
				<span>04</span>
				<strong>答案变化</strong>
			</div>
		</div>
	);
}

export function ConsultationBrief() {
	return (
		<section className="china-consultation-brief" aria-label="首次沟通内容">
			<header>
				<span>首次沟通</span>
				<strong>先把问题聊清楚</strong>
				<i aria-hidden="true">提交后联系</i>
			</header>
			<ol>
				<li>
					<span>01</span>
					<div>
						<strong>你现在最担心什么</strong>
						<p>没有出现、表达不准、竞品领先，还是海外市场不一致。</p>
					</div>
				</li>
				<li>
					<span>02</span>
					<div>
						<strong>客户会提出什么问题</strong>
						<p>从一个会影响选择的真实问题开始，而不是先讲复杂概念。</p>
					</div>
				</li>
				<li>
					<span>03</span>
					<div>
						<strong>先看哪里</strong>
						<p>一起明确品牌、市场、语言、客户问题和相关竞品。</p>
					</div>
				</li>
			</ol>
		</section>
	);
}

export function PrivacyPath() {
	return (
		<div className="china-privacy-path" role="img" aria-label="联系信息用途">
			<div>
				<span>01</span>
				<strong>姓名</strong>
				<small>确认如何称呼你</small>
			</div>
			<i aria-hidden="true">→</i>
			<div>
				<span>02</span>
				<strong>电话</strong>
				<small>回复本次咨询</small>
			</div>
			<i aria-hidden="true">→</i>
			<div>
				<span>03</span>
				<strong>公司</strong>
				<small>了解基本业务背景</small>
			</div>
			<b>只用于本次联系</b>
		</div>
	);
}
