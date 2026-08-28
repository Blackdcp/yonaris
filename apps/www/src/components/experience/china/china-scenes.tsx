"use client";

import { useState } from "react";
import {
	CHINA_ANXIETIES,
	CHINA_BREAKDOWN_QUESTION,
	CHINA_BREAKDOWN_STATES,
	CHINA_COPY,
	CHINA_READING_RECORDS,
	CHINA_SYSTEM_NODES,
} from "@/content/experience/china-copy";
import { DualReadingStage } from "../shared/dual-reading-stage";
import { OrbitField } from "../shared/orbit-field";
import { useRovingTabs } from "../shared/use-roving-tabs";

const HOME_READING_MODES = ["human", "agent"] as const;

export function HomeReadingScene() {
	const record = CHINA_READING_RECORDS.find((item) => item.id === "purpose") ?? CHINA_READING_RECORDS[0];
	const [mode, setMode] = useState<(typeof HOME_READING_MODES)[number]>("human");
	const tabs = useRovingTabs({
		items: HOME_READING_MODES,
		active: mode,
		onChange: setMode,
		idPrefix: "zh-home-reading",
	});

	if (!record) return null;

	return (
		<div className="site-06-zh-home-orbit" data-scene-object="fixed-claim-reader">
			<OrbitField label="同一条公开事实的人类与 Agent 双阅读" interactive />
			<article className="site-06-zh-home-claim" data-stable-id={record.stableId}>
				<div className="site-06-zh-home-claim__modes" role="tablist" aria-label="选择阅读方式">
					{HOME_READING_MODES.map((item, index) => (
						<button key={item} type="button" {...tabs.getTabProps(item, index)}>
							{item === "human" ? "给人看" : "给 Agent 读"}
						</button>
					))}
				</div>
				<section className="site-06-zh-home-claim__human" {...tabs.getPanelProps("human")}>
					<p>{record.human}</p>
					<p>{record.meaning}</p>
				</section>
				<section className="site-06-zh-home-claim__agent" {...tabs.getPanelProps("agent")}>
					<dl>
						<div><dt>事实</dt><dd>{record.fact}</dd></div>
						<div><dt>证据</dt><dd>{record.evidence}</dd></div>
						<div><dt>边界</dt><dd>{record.boundary}</dd></div>
						<div><dt>稳定 ID</dt><dd><code>{record.stableId}</code></dd></div>
					</dl>
				</section>
			</article>
		</div>
	);
}

export function AnxietySelector() {
	const ids = CHINA_ANXIETIES.map((item) => item.id);
	const [active, setActive] = useState<(typeof ids)[number]>("shortlist");
	const tabs = useRovingTabs({ items: ids, active, onChange: setActive, idPrefix: "zh-anxiety" });

	return (
		<section className="site-06-zh-anxiety" data-anxiety-selector data-scene-object="anxiety-selector" aria-label="选择最接近当前生意的问题">
			<div className="site-06-zh-anxiety__controls">
				<p className="site-06-kicker">选一个现在最像你的问题</p>
				<div role="tablist" aria-label="选择业务焦虑">
					{CHINA_ANXIETIES.map((item, index) => (
						<button key={item.id} type="button" {...tabs.getTabProps(item.id, index)}>{item.label}</button>
					))}
				</div>
			</div>
			<div className="site-06-zh-anxiety__readout" aria-live="polite">
				<OrbitField label="当前问题怎样影响客户选择" interactive />
				{CHINA_ANXIETIES.map((item) => (
					<article key={item.id} className="site-06-motion-swap" {...tabs.getPanelProps(item.id)}>
						<h3>{item.diagnosis}</h3>
						<p>{item.answer}</p>
						<strong>{item.impact}</strong>
					</article>
				))}
			</div>
		</section>
	);
}

export function SystemRelationshipPreview() {
	const preview = [
		["市场问题", "客户正在做什么选择"],
		["品牌事实", "公司真正能证明什么"],
		["AI / 市场观测", "品牌怎样被理解与比较"],
		["内容与渠道", "事实在哪里被承接"],
		["行为与复核", "改变后发生了什么"],
	] as const;

	return (
		<section
			className="site-06-zh-relationship-preview"
			data-scene-object="relationship-preview"
			aria-label="五项业务关系预览"
		>
			{preview.map(([label, detail], index) => (
				<div key={label} data-preview-relation={index + 1}><strong>{label}</strong><span>{detail}</span></div>
			))}
		</section>
	);
}

export function SystemField() {
	const ids = CHINA_SYSTEM_NODES.map((item) => item.id);
	const [active, setActive] = useState<(typeof ids)[number]>("question");
	const tabs = useRovingTabs({ items: ids, active, onChange: setActive, idPrefix: "zh-system" });

	return (
		<section className="site-06-zh-system-field" data-system-map data-scene-object="system-field" aria-label="六个相互连接的系统节点">
			<OrbitField label="围绕同一道业务问题连接的六个节点" interactive />
			<div className="site-06-zh-system-field__nodes" role="tablist" aria-label="选择系统节点">
				{CHINA_SYSTEM_NODES.map((item, index) => (
					<button key={item.id} type="button" data-system-node={item.id} {...tabs.getTabProps(item.id, index)}>{item.label}</button>
				))}
			</div>
			<div className="site-06-zh-system-field__records" aria-live="polite">
				{CHINA_SYSTEM_NODES.map((item) => (
					<article key={item.id} className="site-06-motion-swap" {...tabs.getPanelProps(item.id)}>
						<p>正在查看 · {item.label}</p>
						<h3>{item.question}</h3>
						<p>{item.connected}</p>
						<aside><strong>断开之后</strong>{item.disconnected}</aside>
					</article>
				))}
			</div>
		</section>
	);
}

export function ApproachPreview() {
	return (
		<aside className="site-06-zh-break-preview" data-scene-object="breakdown-preview" aria-label="示例场景的证据断点">
			<p className="site-06-kicker">同一道示例问题</p>
			<blockquote>{CHINA_BREAKDOWN_QUESTION}</blockquote>
			<dl>
				<div><dt>品牌事实</dt><dd>支持复杂组织的跨团队交付。</dd></div>
				<div><dt>断点</dt><dd>公开材料没有说明它怎样降低客户正在担心的执行风险。</dd></div>
				<div><dt>复核</dt><dd>只记录已变化、未变化或无法归因，不预设成功。</dd></div>
			</dl>
		</aside>
	);
}

export function ReplayStage() {
	const ids = CHINA_BREAKDOWN_STATES.map((item) => item.id);
	const [active, setActive] = useState<(typeof ids)[number]>("baseline");
	const tabs = useRovingTabs({ items: ids, active, onChange: setActive, idPrefix: "zh-replay" });

	return (
		<section className="site-06-zh-replay site-06-review" data-scene-object="replay-stage" aria-label="同一示例的基线、断点、行动与复核">
			<aside className="site-06-zh-replay__controls">
				<p className="site-06-kicker">一次判断的完整记录</p>
				<p>{CHINA_BREAKDOWN_QUESTION}</p>
				<div role="tablist" aria-label="选择复核状态">
					{CHINA_BREAKDOWN_STATES.map((item, index) => (
						<button key={item.id} type="button" data-replay-state={item.id} {...tabs.getTabProps(item.id, index)}>{item.label}</button>
					))}
				</div>
			</aside>
			<div className="site-06-zh-replay__document" aria-live="polite">
				{CHINA_BREAKDOWN_STATES.map((item) => (
					<article key={item.id} className="site-06-motion-swap" {...tabs.getPanelProps(item.id)}>
						<p className="site-06-kicker">{item.label} · 同一道去标识示例</p>
						<h2>{item.answer}</h2>
						<p className="site-06-zh-replay__verdict">{item.judgment}</p>
						<dl>
							<div><dt>证据</dt><dd>{item.evidence}</dd></div>
							<div><dt>下一步</dt><dd>{item.action}</dd></div>
						</dl>
					</article>
				))}
			</div>
		</section>
	);
}

export function CompanyReadingScene() {
	return (
		<DualReadingStage locale="zh" eyebrow={CHINA_COPY.company.eyebrow} headingLevel="h1" heading={CHINA_COPY.company.title} description={CHINA_COPY.company.lead} records={CHINA_READING_RECORDS} initialId="category" />
	);
}

export function MarketConditionsRecord() {
	return (
		<article className="site-06-zh-market-ledger" aria-label="跨市场判断条件" data-scene-object="market-condition-ledger">
			<header><p className="site-06-kicker">同一道选择题旁边保留的条件</p><h2>公司事实可以一致，市场判断必须有语境。</h2></header>
			<dl>
				<div><dt>市场</dt><dd>客户做出选择时所在的商业环境与约束。</dd></div>
				<div><dt>语言</dt><dd>客户描述需求、风险和选择条件时真正使用的词。</dd></div>
				<div><dt>当地品类表述</dt><dd>市场用什么框架理解这家公司属于哪一类选择。</dd></div>
				<div><dt>替代选择</dt><dd>客户在同一道问题下真正会拿来比较的其他方案。</dd></div>
				<div><dt>证据条件</dt><dd>当时可获得的来源、核对日期、适用范围和限制。</dd></div>
			</dl>
		</article>
	);
}
