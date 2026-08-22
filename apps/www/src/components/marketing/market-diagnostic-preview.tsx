import type { Locale } from "@/lib/marketing-content";

const previewCopy = {
	en: {
		ariaLabel: "Illustrative market perception diagnostic",
		breadcrumb: "Market perception / Buying question",
		navigationLabel: "Diagnostic views",
		navigationTitle: "Readout",
		navigation: ["Answer landscape", "Comparisons", "Sources", "Opportunities"],
		context: "Yonaris self-diagnostic · Public narrative",
		question: "What is Yonaris—and what category does it belong to?",
		answers: [
			{
				engine: "A",
				label: "Illustrative answer",
				status: "Portal language",
				before: "One public surface categorizes Yonaris as an ",
				emphasis: "AI search optimization platform",
				after: ".",
				sources: ["portal.yonaris.com", "AI Search Optimization"],
			},
			{
				engine: "Y",
				label: "Company narrative",
				status: "Homepage language",
				before: "The company positions itself more broadly as ",
				emphasis: "AI-native MarTech",
				after: "—rebuilt for humans and agents.",
				sources: ["yonaris.com", "Public homepage"],
			},
			{
				engine: "!",
				label: "Observed mismatch",
				status: "Category drift",
				before: "Two public surfaces teach ",
				emphasis: "two different categories",
				after: ". The narrower product label is easier for AI to repeat.",
				sources: ["Illustrative synthesis", "Public metadata"],
			},
		],
		readoutTitle: "Yonaris readout",
		readout: [
			["Observation", "Two surfaces teach two categories."],
			["Diagnostic finding", "The broader MarTech position is not carrying."],
			["Next move", "Align company, product and portal metadata."],
		],
	},
	zh: {
		ariaLabel: "市场认知示例诊断",
		breadcrumb: "市场认知 / 购买问题",
		navigationLabel: "诊断视图",
		navigationTitle: "诊断读数",
		navigation: ["答案全景", "比较方式", "信息来源", "叙事机会"],
		context: "Yonaris 自我诊断 · 公开叙事",
		question: "Yonaris 是什么——它属于哪个品类？",
		answers: [
			{
				engine: "A",
				label: "示例答案",
				status: "产品门户语言",
				before: "一个公开界面将 Yonaris 归类为",
				emphasis: "AI 搜索优化平台",
				after: "。",
				sources: ["portal.yonaris.com", "AI Search Optimization"],
			},
			{
				engine: "Y",
				label: "公司叙事",
				status: "官网语言",
				before: "公司把自身定位为更广义的",
				emphasis: "AI 原生营销科技",
				after: "——同时面向人，也面向智能体。",
				sources: ["yonaris.com", "公开官网"],
			},
			{
				engine: "!",
				label: "观察到的不一致",
				status: "品类漂移",
				before: "两个公开界面正在传递",
				emphasis: "两个不同品类",
				after: "。更窄的产品标签更容易被 AI 重复。",
				sources: ["示例综合判断", "公开元数据"],
			},
		],
		readoutTitle: "Yonaris 诊断读数",
		readout: [
			["观察", "两个公开界面传递两个品类。"],
			["诊断发现", "更广义的 MarTech 定位没有被充分继承。"],
			["下一步", "统一公司、产品与门户元数据。"],
		],
	},
} as const;

export function MarketDiagnosticPreview({ locale, label }: { locale: Locale; label: string }) {
	const copy = previewCopy[locale];

	return (
		<figure className="marketing-product-preview" aria-label={copy.ariaLabel}>
			<figcaption>{label}</figcaption>
			<div className="marketing-product-preview__chrome">
				<span className="marketing-product-preview__dot marketing-product-preview__dot--signal" />
				<span className="marketing-product-preview__dot" />
				<span className="marketing-product-preview__dot" />
				<span className="marketing-product-preview__breadcrumb">{copy.breadcrumb}</span>
			</div>

			<div className="marketing-product-preview__workbench">
				<aside className="marketing-product-preview__nav" aria-label={copy.navigationLabel}>
					<p>{copy.navigationTitle}</p>
					<ul>
						{copy.navigation.map((item, index) => (
							<li key={item} className={index === 0 ? "is-active" : undefined}>
								<i />
								{item}
							</li>
						))}
					</ul>
				</aside>

				<section className="marketing-product-preview__canvas" aria-labelledby={`preview-question-${locale}`}>
					<p className="marketing-product-preview__kicker">{copy.context}</p>
					<h2 id={`preview-question-${locale}`}>{copy.question}</h2>
					<div className="marketing-product-preview__answers">
						{copy.answers.map((answer) => (
							<article key={answer.label}>
								<header>
									<span className="marketing-product-preview__engine">{answer.engine}</span>
									<strong>{answer.label}</strong>
									<small>{answer.status}</small>
								</header>
								<p>{answer.before}<mark>{answer.emphasis}</mark>{answer.after}</p>
								<footer>{answer.sources.map((source) => <span key={source}>{source}</span>)}</footer>
							</article>
						))}
					</div>
				</section>

				<aside className="marketing-product-preview__readout" aria-label={copy.readoutTitle}>
					<h2>{copy.readoutTitle}</h2>
					{copy.readout.map(([readoutLabel, value], index) => (
						<div key={readoutLabel} className={index === 1 ? "is-finding" : undefined}>
							<p>{readoutLabel}</p>
							<strong>{value}</strong>
						</div>
					))}
				</aside>
			</div>
		</figure>
	);
}
