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
		<section id={id} className={`zh-site__hero${dark ? " zh-site__band--dark" : ""}`}>
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
			{visual}
		</section>
	);
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
		<section id={id} className={`zh-site__section${dark ? " zh-site__band--dark" : ""}`}>
			<header className="zh-site__section-head">
				<span>{number}</span>
				<div>
					{label ? <p className="zh-site__eyebrow">{label}</p> : null}
					<h2>{title}</h2>
					<p>{body}</p>
				</div>
			</header>
			{children}
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
		<section id="diagnostic-close" className="zh-site__close">
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
}: {
	type: string;
	label: string;
	children: ReactNode;
	dark?: boolean;
}) {
	return (
		<figure
			className={`zh-site__graphic${dark ? " zh-site__graphic--dark" : ""}`}
			data-graphic={type}
			aria-label={label}
		>
			{children}
		</figure>
	);
}
