import type { ReactNode } from "react";

export function ZhHero({
	id = "hero",
	eyebrow,
	title,
	lead,
	visual,
	secondaryHref = "/zh/approach",
	secondaryLabel = "了解 Yonaris 如何工作",
	dark = false,
}: {
	id?: string;
	eyebrow: string;
	title: string;
	lead: string;
	visual: ReactNode;
	secondaryHref?: string;
	secondaryLabel?: string;
	dark?: boolean;
}) {
	return (
		<section
			id={id}
			className={`zh-site__hero${dark ? " zh-site__band--dark" : ""}`}
			data-stage="market-command"
			data-layout="decision-canvas"
			data-tone={dark ? "ink" : "paper"}
		>
			<div className="zh-site__hero-network" aria-hidden="true">
				<i />
				<i />
				<i />
				<b />
			</div>
			<div className="zh-site__hero-copy">
				<p className="zh-site__eyebrow">{eyebrow}</p>
				<h1>{title}</h1>
				<p className="zh-site__lead">{lead}</p>
				<div className="zh-site__hero-actions">
					<a className="zh-site__button" href="/zh/diagnostic">
						查看品牌在 AI 中的表现
					</a>
					<a className="zh-site__text-link" href={secondaryHref}>
						{secondaryLabel} →
					</a>
				</div>
			</div>
			<div className="zh-site__hero-evidence">{visual}</div>
		</section>
	);
}

function decisionStage(id: string): string {
	if (id === "product-capability") return "service-system";
	if (id === "service-process") return "delivery-proof";
	if (id === "global-capability") return "global-capability";
	if (id === "market-change") return "market-context";
	if (id === "core-questions") return "buyer-anxiety";
	if (id === "human-agent") return "human-agent";
	return "decision-section";
}

export function ZhSection({
	id,
	number,
	label,
	title,
	body,
	children,
	dark = false,
}: {
	id: string;
	number: string;
	label?: string;
	title: string;
	body: string;
	children?: ReactNode;
	dark?: boolean;
}) {
	return (
		<section
			id={id}
			className={`zh-site__section${dark ? " zh-site__band--dark" : ""}`}
			data-stage={decisionStage(id)}
			data-layout="decision-canvas"
			data-tone={dark ? "ink" : "paper"}
		>
			<header className="zh-site__decision-intro">
				<div className="zh-site__decision-label">
					<span>{number}</span>
					{label ? <p className="zh-site__eyebrow">{label}</p> : null}
				</div>
				<h2>{title}</h2>
				<p className="zh-site__decision-summary">{body}</p>
			</header>
			{children ? <div className="zh-site__decision-body">{children}</div> : null}
		</section>
	);
}

export function ZhClose({
	title,
	body = "留下姓名、电话和公司。我们会先了解你的市场问题，再由人判断下一步。",
}: {
	title: string;
	body?: string;
}) {
	return (
		<section id="diagnostic-close" className="zh-site__close" data-stage="contact" data-layout="decision-canvas">
			<p className="zh-site__eyebrow">下一步</p>
			<h2>{title}</h2>
			<p>{body}</p>
			<a className="zh-site__button" href="/zh/diagnostic">
				提交需求
			</a>
		</section>
	);
}

export function ZhGraphic({
	type,
	label,
	children,
	dark = false,
	protagonist,
}: {
	type: string;
	label: string;
	children: ReactNode;
	dark?: boolean;
	protagonist?: string;
}) {
	return (
		<figure
			className={`zh-site__graphic${dark ? " zh-site__graphic--dark" : ""}`}
			data-graphic={type}
			data-protagonist={protagonist}
			aria-label={label}
		>
			{children}
		</figure>
	);
}
