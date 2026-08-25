"use client";

import { useState } from "react";
import {
	CHINA_MARKETS,
	CHINA_PRODUCT_STAGES,
	CHINA_SERVICE_SITUATIONS,
	CHINA_SITUATIONS,
} from "@/content/experience/china-copy";
import { useRovingTabs } from "../shared/use-roving-tabs";

const situationIds = CHINA_SITUATIONS.map((item) => item.id);
const productStageIds = CHINA_PRODUCT_STAGES.map((item) => item.id);
const serviceIds = CHINA_SERVICE_SITUATIONS.map((item) => item.id);
const marketIds = CHINA_MARKETS.map((item) => item.id);

export function AiAnswerFlow() {
	const [activeId, setActiveId] = useState<(typeof CHINA_SITUATIONS)[number]["id"]>("missing");
	const tabs = useRovingTabs({
		items: situationIds,
		active: activeId,
		onChange: setActiveId,
		idPrefix: "china-answer",
	});

	return (
		<section className="china-answer-flow" aria-label="品牌在 AI 答案中的四种处境">
			<div className="china-answer-flow__controls" role="tablist" aria-label="选择你最关心的情况">
				{CHINA_SITUATIONS.map((item, index) => (
					<button
						key={item.id}
						type="button"
						data-situation-control={item.id}
						{...tabs.getTabProps(item.id, index)}
					>
						<span>{String(index + 1).padStart(2, "0")}</span>
						{item.label}
					</button>
				))}
			</div>

			<div className="china-answer-flow__stage">
				{CHINA_SITUATIONS.map((item) => (
					<section
						key={item.id}
						className="china-answer-flow__panel"
						data-diagnostic-state={item.id}
						aria-live="polite"
						{...tabs.getPanelProps(item.id)}
					>
						<div className="china-answer-flow__window-bar">
							<span aria-hidden="true" />
							<span aria-hidden="true" />
							<span aria-hidden="true" />
							<strong>品牌摸底 · 当次观察</strong>
							<small>状态：范围已确认</small>
						</div>
						<div className="china-answer-flow__question">
							<span>Q</span>
							<div>
								<p>{item.question}</p>
								<small data-output-field="scope">{item.scope}</small>
							</div>
						</div>
						<div className="china-answer-flow__answer">
							<div className="china-answer-flow__avatar" aria-hidden="true">
								AI
							</div>
							<div>
								<small>观察到的答案</small>
								<strong data-output-field="answer">{item.answer}</strong>
								<div className="china-answer-flow__gap">
									<span>差距</span>
									<p data-output-field="gap">{item.gap}</p>
								</div>
							</div>
						</div>
						<div className="china-answer-flow__move">
							<span>下一步优先级</span>
							<p data-output-field="priority">{item.priority}</p>
							<i aria-hidden="true">↗</i>
						</div>
					</section>
				))}
			</div>
		</section>
	);
}

export function BrandGapConsole() {
	const [activeId, setActiveId] = useState<(typeof CHINA_PRODUCT_STAGES)[number]["id"]>("ask");
	const tabs = useRovingTabs({
		items: productStageIds,
		active: activeId,
		onChange: setActiveId,
		idPrefix: "china-product",
	});

	return (
		<section className="china-gap-console" aria-label="一份品牌摸底记录的四个步骤">
			<div className="china-gap-console__rail" role="tablist" aria-label="四个摸底步骤">
				{CHINA_PRODUCT_STAGES.map((stage, index) => (
					<button key={stage.id} type="button" {...tabs.getTabProps(stage.id, index)}>
						<span>{String(index + 1).padStart(2, "0")}</span>
						<strong>{stage.label}</strong>
					</button>
				))}
			</div>
			<div className="china-gap-console__workspace">
				<header>
					<div>
						<span>会议用品牌摸底记录</span>
						<small>状态：范围已确认 · 可逐项核对</small>
					</div>
					<i aria-hidden="true">Y</i>
				</header>
				{CHINA_PRODUCT_STAGES.map((stage) => (
					<div
						key={stage.id}
						className="china-gap-console__body"
						data-diagnostic-state={stage.id}
						aria-live="polite"
						{...tabs.getPanelProps(stage.id)}
					>
						<aside aria-label="问题上下文">
							<span>问题范围</span>
							<strong data-output-field="scope">{stage.scope}</strong>
							<span>当前步骤</span>
							<strong>{stage.label}</strong>
							<span>会议输出</span>
							<strong>{stage.output}</strong>
						</aside>
						<section>
							<small>{stage.label}</small>
							<h3>{stage.title}</h3>
							<p>{stage.body}</p>
							<div className="china-gap-console__readout">
								<span>观察结果</span>
								<strong data-output-field="answer">{stage.answer}</strong>
								<span>当前掉点</span>
								<p data-output-field="gap">{stage.gap}</p>
							</div>
							<div className="china-gap-console__output">
								<span>下一步优先级</span>
								<strong data-output-field="priority">{stage.priority}</strong>
							</div>
						</section>
					</div>
				))}
			</div>
		</section>
	);
}

export function ServiceRoute() {
	const [activeId, setActiveId] = useState<(typeof CHINA_SERVICE_SITUATIONS)[number]["id"]>("visibility");
	const tabs = useRovingTabs({
		items: serviceIds,
		active: activeId,
		onChange: setActiveId,
		idPrefix: "china-service",
	});

	return (
		<section className="china-service-route" aria-label="按品牌问题选择摸底起点">
			<div className="china-service-route__map" role="tablist" aria-label="选择品牌问题">
				{CHINA_SERVICE_SITUATIONS.map((service, index) => (
					<button key={service.id} type="button" {...tabs.getTabProps(service.id, index)}>
						<span>{service.number}</span>
						<strong>{service.situation}</strong>
						<i aria-hidden="true">→</i>
					</button>
				))}
			</div>
			{CHINA_SERVICE_SITUATIONS.map((service) => (
				<article
					key={service.id}
					className="china-service-route__detail"
					data-diagnostic-state={service.id}
					aria-live="polite"
					{...tabs.getPanelProps(service.id)}
				>
					<span>建议起点 · 范围内观察</span>
					<h3>{service.startingPoint}</h3>
					<p>{service.description}</p>
					<div className="china-service-route__readout">
						<small>问题范围</small>
						<p data-output-field="scope">{service.scope}</p>
						<small>观察结果</small>
						<strong data-output-field="answer">{service.answer}</strong>
						<small>业务差距</small>
						<p data-output-field="gap">{service.gap}</p>
					</div>
					<div>
						<small>摸底时逐项核对</small>
						<ul>
							{service.visibleItems.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					</div>
					<p className="china-service-route__priority" data-output-field="priority">
						{service.priority}
					</p>
					<a href="/zh/diagnostic">
						从这个问题开始沟通 <span aria-hidden="true">↗</span>
					</a>
				</article>
			))}
		</section>
	);
}

export function GlobalMarketBridge() {
	const [activeId, setActiveId] = useState<(typeof CHINA_MARKETS)[number]["id"]>("china");
	const tabs = useRovingTabs({
		items: marketIds,
		active: activeId,
		onChange: setActiveId,
		idPrefix: "china-market",
	});

	return (
		<section className="china-market-bridge" aria-label="中国市场基线与海外目标市场对照">
			<div className="china-market-bridge__controls" role="tablist" aria-label="选择市场视角">
				{CHINA_MARKETS.map((market, index) => (
					<button
						key={market.id}
						type="button"
						data-market-control={market.id}
						{...tabs.getTabProps(market.id, index)}
					>
						{market.label}
					</button>
				))}
			</div>
			{CHINA_MARKETS.map((market) => (
				<div
					key={market.id}
					className="china-market-bridge__canvas"
					data-diagnostic-state={market.id}
					aria-live="polite"
					{...tabs.getPanelProps(market.id)}
				>
					<section data-market-track="china">
						<span>01 · 服务中国市场 · 建立基线</span>
						<strong>先记录中文客户的购买问题</strong>
						<p>固定品类表达、购买角色和同一组对标对象。</p>
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
						<strong>按当地买家的品类心智重做问题</strong>
						<p>只增加已定义的国家、语言、购买角色和对标品牌。</p>
					</section>
					<article className="china-market-bridge__readout">
						<small>{market.label} · 状态：可核对</small>
						<h3>{market.question}</h3>
						<p data-output-field="scope">{market.scope}</p>
						<strong data-output-field="answer">{market.answer}</strong>
						<p data-output-field="gap">{market.gap}</p>
						<strong data-output-field="priority">{market.priority}</strong>
					</article>
				</div>
			))}
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
				<p>从可核对答案出发</p>
			</div>
			<div className="china-company-network__node china-company-network__node--one">
				<span>01</span>
				<strong>问题范围</strong>
			</div>
			<div className="china-company-network__node china-company-network__node--two">
				<span>02</span>
				<strong>答案快照</strong>
			</div>
			<div className="china-company-network__node china-company-network__node--three">
				<span>03</span>
				<strong>业务差距</strong>
			</div>
			<div className="china-company-network__node china-company-network__node--four">
				<span>04</span>
				<strong>下一步优先级</strong>
			</div>
		</div>
	);
}

export function ConsultationBrief() {
	return (
		<section className="china-consultation-brief" aria-label="首次沟通内容">
			<header>
				<span>第一次沟通</span>
				<strong>只确认摸底范围</strong>
				<i aria-hidden="true">不在此步给结论</i>
			</header>
			<ol>
				<li>
					<span>01</span>
					<div>
						<strong>确认市场与语言</strong>
						<p>先选中国市场，或一个已经明确的目标国家与目标语言。</p>
					</div>
				</li>
				<li>
					<span>02</span>
					<div>
						<strong>确认购买问题</strong>
						<p>从一组会影响选择的真实问题开始，不把不同场景混在一起。</p>
					</div>
				</li>
				<li>
					<span>03</span>
					<div>
						<strong>确认对标对象</strong>
						<p>说明需要一起核对的品牌，以及当前最担心的一类差距。</p>
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
