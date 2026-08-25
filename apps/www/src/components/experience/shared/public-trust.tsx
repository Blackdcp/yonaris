import type { ExperienceLocale } from "@/content/experience/types";

const SUPPORT_EMAIL = "black.dcp@outlook.com";

const deliveryCopy = {
	en: {
		label: "How delivery works now",
		title: "A Yonaris-led review, with a workspace you can inspect.",
		intro:
			"Yonaris runs a hands-on review and keeps the selected evidence in a workspace the customer can inspect. It is not a self-serve ranking dashboard.",
		customerTitle: "You select",
		customerItems: [
			"The question scope: brand, market, language, buyer question, and named alternatives.",
			"The recheck timing: whether and when the same agreed questions should be reviewed again.",
		],
		yonarisTitle: "Yonaris operates",
		yonarisItems: [
			"Answer collection and organization inside the selected scope.",
			"Human review of the captured record and a next scoped recommendation.",
		],
		handoffLabel: "Customer-visible handoff",
		handoff:
			"The handoff keeps the question scope, complete answer snapshot, citations only when the answer exposes them, named-alternative comparison, prioritized next review, and recheck record together.",
		cadence: "Rechecks are scheduled around the agreed questions, rather than run as continuous monitoring.",
	},
	zh: {
		label: "当前交付方式",
		title: "由 Yonaris 主导复核，客户能看到并核对完整记录。",
		intro: "Yonaris 团队负责采集与核对，客户在同一工作空间查看问题范围、完整答案和下一步优先级；不是只给一个分数。",
		customerTitle: "客户确定",
		customerItems: [
			"问题范围：品牌、市场、语言、购买问题和指定对标对象。",
			"复盘节点：是否以及何时围绕约定问题再核对一次。",
		],
		yonarisTitle: "Yonaris 负责",
		yonarisItems: ["在已定范围内采集、整理答案与相关记录。", "由复核团队核对记录，并提出下一步范围明确的建议。"],
		handoffLabel: "客户可核对的交接记录",
		handoff:
			"交接内容包括问题范围、完整答案快照、仅记录答案明确展示的引用、指定对标对象的比较、下一次优先复核项和复查记录。",
		cadence: "按项目节奏围绕约定问题复盘，不包装成实时监控。",
	},
} as const;

const recordCopy = {
	en: {
		label: "Who operates the record",
		title: "First-party facts you can inspect directly.",
		operator: "Reviewed and operated by the Yonaris review team.",
		review: "Last reviewed: 2026-08-25",
		intro:
			"The links below are Yonaris first-party public records, not independent validation. They expose the current product, company, and catalogue statements in stable machine-readable formats.",
		proof:
			"These public records prove what Yonaris currently publishes about its scope, delivery model, handoff, and limitations. They do not prove customer outcomes, rankings, coverage beyond the selected scope, or live AI observations.",
		links: [
			["Product Markdown", "/agent/product.md"],
			["Company Markdown", "/agent/company.md"],
			["JSON-LD catalogue", "/agent/catalog.json"],
		] as const,
		support: "Questions about these records or privacy?",
		fallback: "The email link opens a draft; nothing is sent until you send it.",
	},
	zh: {
		label: "谁在维护这份记录",
		title: "可直接核对的 Yonaris 第一方公开事实。",
		operator: "复核与维护方：Yonaris 复核团队。",
		review: "最近核对：2026-08-25",
		intro:
			"以下链接是 Yonaris 自己发布的第一方公开记录，不是独立第三方背书；它们以稳定、机器可读的格式公开当前产品、公司和目录说明。",
		proof:
			"这些公开记录只能证明 Yonaris 当前公开的范围、交付方式、交接内容和限制；不证明客户结果、排名、范围外覆盖或实时 AI 观察。",
		links: [
			["产品 Markdown", "/zh/agent/product.md"],
			["公司 Markdown", "/zh/agent/company.md"],
			["JSON-LD 目录", "/zh/agent/catalog.json"],
		] as const,
		support: "对公开记录或隐私有疑问？",
		fallback: "邮件链接只会打开草稿；在你主动发送前，不会发出任何内容。",
	},
} as const;

const privacyCopy = {
	en: {
		label: "Delivery status",
		title: "A receipt appears only after provider acceptance.",
		body: "The page confirms form delivery only after the delivery service accepts the request. Otherwise it says delivery is unconfirmed, keeps the entered values, and makes no claim that Yonaris or an inbox received it.",
		fallback: "Email fallback",
		note: "This link opens a draft. Nothing is sent until you send it.",
	},
	zh: {
		label: "投递状态",
		title: "只有服务方确认接收后，页面才显示投递成功。",
		body: "只有投递服务接受申请后，页面才显示已送出；否则会明确提示投递尚未确认、保留已填内容，也不会声称 Yonaris 或任何收件箱已经收到。",
		fallback: "邮件兜底",
		note: "链接只会打开草稿；在你主动发送前，不会发出任何内容。",
	},
} as const;

export function ManagedReviewTrust({ locale }: { locale: ExperienceLocale }) {
	const copy = deliveryCopy[locale];
	const className = locale === "en" ? "sf-managed-delivery" : "china-managed-delivery";
	return (
		<section className={className} data-public-trust="managed-review" aria-labelledby={`managed-review-${locale}`}>
			<header>
				<span>{copy.label}</span>
				<h2 id={`managed-review-${locale}`}>{copy.title}</h2>
				<p>{copy.intro}</p>
			</header>
			<div className={`${className}__roles`}>
				<article data-managed-role="customer">
					<h3>{copy.customerTitle}</h3>
					<ul>
						{copy.customerItems.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</article>
				<article data-managed-role="yonaris">
					<h3>{copy.yonarisTitle}</h3>
					<ul>
						{copy.yonarisItems.map((item) => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</article>
			</div>
			<div className={`${className}__handoff`}>
				<strong>{copy.handoffLabel}</strong>
				<p>{copy.handoff}</p>
				<p>{copy.cadence}</p>
			</div>
		</section>
	);
}

export function PublicRecordTrust({ locale }: { locale: ExperienceLocale }) {
	const copy = recordCopy[locale];
	const className = locale === "en" ? "sf-public-record" : "china-public-record";
	return (
		<section className={className} data-public-trust="first-party-records" aria-labelledby={`public-record-${locale}`}>
			<header>
				<span>{copy.label}</span>
				<h2 id={`public-record-${locale}`}>{copy.title}</h2>
				<p>{copy.intro}</p>
			</header>
			<div className={`${className}__proof`}>
				<p>{copy.operator}</p>
				<p>{copy.review}</p>
				<p>{copy.proof}</p>
			</div>
			<nav aria-label={locale === "en" ? "Public Yonaris records" : "Yonaris 公开记录"}>
				{copy.links.map(([label, href]) => (
					<a key={href} href={href}>
						{label}
						<span aria-hidden="true">↗</span>
					</a>
				))}
			</nav>
			<p className={`${className}__support`}>
				{copy.support} <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. {copy.fallback}
			</p>
		</section>
	);
}

export function DeliveryTruth({ locale }: { locale: ExperienceLocale }) {
	const copy = privacyCopy[locale];
	const className = locale === "en" ? "sf-delivery-note" : "china-delivery-note";
	return (
		<section
			className={className}
			data-delivery-truth="provider-confirmed"
			aria-labelledby={`delivery-truth-${locale}`}
		>
			<span>{copy.label}</span>
			<h2 id={`delivery-truth-${locale}`}>{copy.title}</h2>
			<p>{copy.body}</p>
			<p>
				<strong>{copy.fallback}:</strong> <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. {copy.note}
			</p>
		</section>
	);
}
