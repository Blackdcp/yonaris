import { useState } from "react";
import {
	CHINA_ANXIETIES,
	CHINA_BREAKDOWN_QUESTION,
	CHINA_BREAKDOWN_STATES,
	CHINA_READING_RECORDS,
	CHINA_SYSTEM_NODES,
} from "@/content/experience/china-copy";
import { OrbitField } from "../shared/orbit-field";
import { ReadingLens } from "../shared/reading-lens";
import { ReviewSwitch } from "../shared/review-switch";
import { useRovingTabs } from "../shared/use-roving-tabs";

export function AnxietySelector() {
	const ids = CHINA_ANXIETIES.map((item) => item.id);
	const [active, setActive] = useState<(typeof ids)[number]>("shortlist");
	const tabs = useRovingTabs({ items: ids, active, onChange: setActive, idPrefix: "zh-anxiety" });

	return (
		<section className="site-06-anxiety" data-anxiety-selector aria-label="选择最接近当前生意的问题">
			<div className="site-06-tabs" role="tablist" aria-label="选择业务焦虑">
				{CHINA_ANXIETIES.map((item, index) => (
					<button key={item.id} type="button" {...tabs.getTabProps(item.id, index)}>
						{item.label}
					</button>
				))}
			</div>
			<div className="site-06-anxiety__records" aria-live="polite">
				{CHINA_ANXIETIES.map((item) => (
					<article key={item.id} className="site-06-evidence-document" {...tabs.getPanelProps(item.id)}>
						<span>答案里发生了什么</span>
						<h3>{item.diagnosis}</h3>
						<p className="site-06-evidence-document__answer">{item.answer}</p>
						<strong>{item.impact}</strong>
					</article>
				))}
			</div>
		</section>
	);
}

export function SystemRelationshipMap() {
	const ids = CHINA_SYSTEM_NODES.map((item) => item.id);
	const [active, setActive] = useState<(typeof ids)[number]>("question");
	const tabs = useRovingTabs({ items: ids, active, onChange: setActive, idPrefix: "zh-system" });

	return (
		<section className="site-06-system" data-system-map aria-label="六个相互连接的系统节点">
			<OrbitField label="一套相互连接的品牌判断系统" interactive>
				<strong>同一道业务问题</strong>
			</OrbitField>
			<div className="site-06-system__records">
				<div className="site-06-tabs" role="tablist" aria-label="选择系统节点">
					{CHINA_SYSTEM_NODES.map((item, index) => (
						<button key={item.id} type="button" {...tabs.getTabProps(item.id, index)}>
							{item.label}
						</button>
					))}
				</div>
				<div className="site-06-system__panels" aria-live="polite">
					{CHINA_SYSTEM_NODES.map((item) => (
						<article key={item.id} className="site-06-evidence-document" {...tabs.getPanelProps(item.id)}>
							<span>正在查看 · {item.label}</span>
							<h3>{item.question}</h3>
							<dl>
								<div>
									<dt>接通之后</dt>
									<dd>{item.connected}</dd>
								</div>
								<div>
									<dt>断开之后</dt>
									<dd>{item.disconnected}</dd>
								</div>
							</dl>
						</article>
					))}
				</div>
			</div>
		</section>
	);
}

export function HomeReadingScene() {
	return (
		<div className="site-06-reading-scene">
			<OrbitField label="同一条公开事实的人类与 Agent 双阅读" interactive>
				<strong>同一条公开事实</strong>
			</OrbitField>
			<ReadingLens locale="zh" records={CHINA_READING_RECORDS.slice(2)} initialId="scope" />
		</div>
	);
}

export function CompanyReadingScene() {
	return <ReadingLens locale="zh" records={CHINA_READING_RECORDS} initialId="category" />;
}

export function BreakdownReplay() {
	return (
		<ReviewSwitch
			locale="zh"
			question={CHINA_BREAKDOWN_QUESTION}
			states={CHINA_BREAKDOWN_STATES}
			initialId="baseline"
		/>
	);
}

export function MarketConditionsRecord() {
	return (
		<article className="site-06-evidence-document site-06-market-conditions" aria-label="跨市场判断条件">
			<header>
				<span>同一道选择题旁边保留的条件</span>
				<strong>公司事实可以一致，市场判断必须有语境</strong>
			</header>
			<dl>
				<div>
					<dt>市场</dt>
					<dd>客户做出选择时所在的商业环境与约束。</dd>
				</div>
				<div>
					<dt>语言</dt>
					<dd>客户描述需求、风险和选择条件时真正使用的词。</dd>
				</div>
				<div>
					<dt>当地品类表述</dt>
					<dd>市场用什么框架理解这家公司属于哪一类选择。</dd>
				</div>
				<div>
					<dt>替代选择</dt>
					<dd>客户在同一道问题下真正会拿来比较的其他方案。</dd>
				</div>
				<div>
					<dt>证据条件</dt>
					<dd>当时可获得的来源、核对日期、适用范围和限制。</dd>
				</div>
			</dl>
		</article>
	);
}
