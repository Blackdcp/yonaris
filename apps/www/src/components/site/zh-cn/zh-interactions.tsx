import { useState } from "react";
import {
	getZhQuestion,
	ZH_ANSWER_QUESTIONS,
	ZH_DELIVERY_STAGES,
	ZH_MARKET_CONTEXTS,
	ZH_PRODUCT_MODULES,
	type ZhDeliveryStageId,
	type ZhProductModuleId,
	type ZhQuestionId,
} from "@/content/site/zh-cn/experience";
import { ZhGraphic } from "./zh-page-primitives";

export function ZhAnswerScene({ initialQuestion = "recommended" }: { initialQuestion?: ZhQuestionId }) {
	const [activeId, setActiveId] = useState<ZhQuestionId>(initialQuestion);
	const active = getZhQuestion(activeId);
	return (
		<ZhGraphic type="zh-answer-scene" label="AI 品牌问题交互示意">
			<div className="zh-site__scene-bar">
				<span>品牌回答现场</span>
				<span>界面演示 · 非客户数据</span>
			</div>
			<div className="zh-site__scene-layout">
				<div className="zh-site__scene-tabs" role="tablist" aria-label="选择你最担心的问题">
					{ZH_ANSWER_QUESTIONS.map((item, index) => (
						<button
							key={item.id}
							type="button"
							role="tab"
							aria-selected={item.id === activeId}
							onClick={() => setActiveId(item.id)}
						>
							<em>{String(index + 1).padStart(2, "0")}</em>
							<span>{item.label}</span>
						</button>
					))}
				</div>
				<article className="zh-site__scene-panel" role="tabpanel" data-question={active.id}>
					<header>
						<small>客户正在问</small>
						<h3>{active.question}</h3>
					</header>
					<section>
						<small>先看见</small>
						<p>{active.answer}</p>
					</section>
					<div>
						<section>
							<small>再判断</small>
							<p>{active.judgement}</p>
						</section>
						<section>
							<small>看依据</small>
							<p>{active.evidence}</p>
						</section>
						<section>
							<small>下一步</small>
							<p>{active.nextStep}</p>
						</section>
					</div>
				</article>
			</div>
		</ZhGraphic>
	);
}

export function ZhProductWorkbench({ initialModule = "observe" }: { initialModule?: ZhProductModuleId }) {
	const [activeId, setActiveId] = useState<ZhProductModuleId>(initialModule);
	const active = ZH_PRODUCT_MODULES.find(({ id }) => id === activeId) ?? ZH_PRODUCT_MODULES[0];
	return (
		<ZhGraphic type="zh-product-workbench" label="Yonaris 产品能力工作台" dark>
			<div className="zh-site__workbench-tabs" role="tablist" aria-label="选择产品能力">
				{ZH_PRODUCT_MODULES.map((item, index) => (
					<button
						key={item.id}
						type="button"
						role="tab"
						aria-selected={item.id === activeId}
						onClick={() => setActiveId(item.id)}
					>
						<em>{String(index + 1).padStart(2, "0")}</em>
						{item.label}
					</button>
				))}
			</div>
			<article className="zh-site__workbench-panel" role="tabpanel" data-module={active.id}>
				<header>
					<small>结论</small>
					<h3>{active.conclusion}</h3>
				</header>
				<div>
					<section>
						<small>输入</small>
						<p>{active.input}</p>
					</section>
					<section>
						<small>可查看产物</small>
						<p>{active.artifact}</p>
					</section>
					<section>
						<small>边界</small>
						<p>{active.boundary}</p>
					</section>
				</div>
			</article>
		</ZhGraphic>
	);
}

export function ZhDeliveryPath({ initialStage = "diagnose" }: { initialStage?: ZhDeliveryStageId }) {
	const [activeId, setActiveId] = useState<ZhDeliveryStageId>(initialStage);
	const active = ZH_DELIVERY_STAGES.find(({ id }) => id === activeId) ?? ZH_DELIVERY_STAGES[0];
	return (
		<ZhGraphic type="zh-delivery-path" label="五步服务交付路径">
			<div className="zh-site__delivery-tabs" role="tablist" aria-label="选择服务阶段">
				{ZH_DELIVERY_STAGES.map((item, index) => (
					<button
						key={item.id}
						type="button"
						role="tab"
						aria-selected={item.id === activeId}
						onClick={() => setActiveId(item.id)}
					>
						<em>{String(index + 1).padStart(2, "0")}</em>
						<span>{item.label}</span>
					</button>
				))}
			</div>
			<article className="zh-site__delivery-panel" role="tabpanel" data-stage={active.id}>
				<section>
					<small>客户提供</small>
					<p>{active.customerInput}</p>
				</section>
				<section>
					<small>Yonaris 执行</small>
					<p>{active.yonarisWork}</p>
				</section>
				<section>
					<small>交付产物</small>
					<p>{active.output}</p>
				</section>
				<section>
					<small>人工审核</small>
					<p>{active.review}</p>
				</section>
			</article>
		</ZhGraphic>
	);
}

export function ZhMarketContext({ initialContext = "china" }: { initialContext?: "china" | "global" }) {
	const [activeId, setActiveId] = useState<"china" | "global">(initialContext);
	const active = ZH_MARKET_CONTEXTS.find(({ id }) => id === activeId) ?? ZH_MARKET_CONTEXTS[0];
	return (
		<ZhGraphic type="zh-market-context" label="中国与全球市场配置对照">
			<div className="zh-site__context-tabs" role="tablist" aria-label="选择市场范围">
				{ZH_MARKET_CONTEXTS.map((item) => (
					<button
						key={item.id}
						type="button"
						role="tab"
						aria-selected={item.id === activeId}
						onClick={() => setActiveId(item.id)}
					>
						{item.label}
					</button>
				))}
			</div>
			<article className="zh-site__context-panel" role="tabpanel" data-context={active.id}>
				<h3>{active.conclusion}</h3>
				<ol>
					{active.dimensions.map((item, index) => (
						<li key={item}>
							<em>{String(index + 1).padStart(2, "0")}</em>
							{item}
						</li>
					))}
				</ol>
				<p>
					<strong>能力边界：</strong>
					{active.boundary}
				</p>
			</article>
		</ZhGraphic>
	);
}

const evidenceFields = [
	["观察范围", "市场、语言、问题、界面、时间"],
	["有效分母", "只有符合规则的样本进入比较"],
	["回答记录", "原问题、原回答和比较上下文"],
	["可用来源", "可见则记录，不可见则标记未知"],
	["人工判断", "结论、边界、负责人和下一步"],
] as const;

export function ZhEvidenceRecord() {
	const [active, setActive] = useState(0);
	const selected = evidenceFields[active] ?? evidenceFields[0];
	return (
		<ZhGraphic type="zh-evidence-record" label="可检查的证据记录">
			<div className="zh-site__record-index" role="tablist" aria-label="选择证据字段">
				{evidenceFields.map(([label], index) => (
					<button
						key={label}
						type="button"
						role="tab"
						aria-selected={index === active}
						onClick={() => setActive(index)}
					>
						<em>{String(index + 1).padStart(2, "0")}</em>
						{label}
					</button>
				))}
			</div>
			<article className="zh-site__record-panel" role="tabpanel">
				<small>{selected[0]}</small>
				<h3>{selected[1]}</h3>
				<p>当前演示没有载入客户观察数据；字段结构用于说明一条结论需要保留什么。</p>
			</article>
		</ZhGraphic>
	);
}

const answerNodes = [
	["出现", "品牌有没有进入答案？", "出现记录"],
	["描述", "品牌和品类怎么被解释？", "事实标注"],
	["比较", "什么标准决定了偏好？", "比较记录"],
	["依据", "界面提供了哪些可用来源？", "来源状态"],
	["变化", "相同规则下发生了什么变化？", "复测记录"],
] as const;

export function ZhAnswerMap() {
	const [active, setActive] = useState(0);
	const selected = answerNodes[active] ?? answerNodes[0];
	return (
		<ZhGraphic type="zh-answer-map" label="品牌与 AI 答案关系图">
			<div className="zh-site__answer-map" role="tablist" aria-label="选择答案关系">
				{answerNodes.map(([label], index) => (
					<button
						key={label}
						type="button"
						role="tab"
						aria-selected={index === active}
						onClick={() => setActive(index)}
					>
						<em>{String(index + 1).padStart(2, "0")}</em>
						{label}
					</button>
				))}
			</div>
			<article className="zh-site__answer-node" role="tabpanel">
				<small>业务问题</small>
				<h3>{selected[1]}</h3>
				<span>{selected[2]}</span>
			</article>
		</ZhGraphic>
	);
}
