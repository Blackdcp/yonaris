export type Locale = "en" | "zh";
export type MarketingPageKey = "home" | "platform" | "methodology" | "results" | "geo" | "diagnostic";
export type MarketingDetailPageKey = Exclude<MarketingPageKey, "home" | "diagnostic">;
export type AgentSection = "company" | "platform" | "methodology" | "results";

export interface DiagnosticInput {
	brand: string;
	website: string;
	market: string;
	competitors: string;
	question: string;
	name: string;
	email: string;
}

interface MarketingRoute {
	key: MarketingPageKey;
	en: string;
	zh: string;
}

interface Capability {
	name: string;
	description: string;
}

interface Foundation {
	name: string;
	label: string;
	description: string;
}

interface MarketingSectionContent {
	eyebrow: string;
	title: string;
	body: string;
	points?: string[];
}

interface DetailPageContent {
	eyebrow: string;
	title: string;
	summary: string;
	description: string;
	sections: MarketingSectionContent[];
}

export const MARKETING_LAST_UPDATED = "2026-08-21";
export const CONTACT_EMAIL = "black.dcp@outlook.com";

export const MARKETING_ROUTES: readonly MarketingRoute[] = [
	{ key: "home", en: "/", zh: "/zh" },
	{ key: "platform", en: "/platform", zh: "/zh/platform" },
	{ key: "methodology", en: "/methodology", zh: "/zh/methodology" },
	{ key: "results", en: "/results", zh: "/zh/results" },
	{ key: "geo", en: "/geo", zh: "/zh/geo" },
	{ key: "diagnostic", en: "/diagnostic", zh: "/zh/diagnostic" },
] as const;

const en = {
	locale: "en" as const,
	category: "AI-native MarTech",
	companyDefinition:
		"Yonaris is an AI-native MarTech company helping brands understand and improve how they are discovered, interpreted, compared, and chosen in AI-mediated markets.",
	cta: {
		primary: "Get a Free Diagnostic",
		agent: "View for agents",
		contact: "Contact",
	},
	navigation: [
		{ label: "Platform", path: "/platform" },
		{ label: "Methodology", path: "/methodology" },
		{ label: "Results", path: "/results" },
		{ label: "GEO", path: "/geo" },
		{ label: "Agent View", path: "/agent" },
	],
	hero: {
		eyebrow: "AI-NATIVE MARTECH",
		title: ["MarTech, rebuilt.", "For humans and agents."],
		body: "Yonaris helps brands understand and improve how they are discovered, interpreted, compared, and chosen in an AI-mediated market.",
	},
	marketShift: {
		eyebrow: "A NEW DECISION SURFACE",
		title: "The market is forming an opinion before the click.",
		body: "People increasingly ask AI to discover options, frame trade-offs, and build a shortlist. The answer is already shaping demand before a traditional search result, website visit, or sales conversation begins.",
	},
	capabilitiesIntro: {
		eyebrow: "THE SYSTEM",
		title: "Turn invisible judgment into evidence.",
		body: "Yonaris connects what your company knows with what the market asks and what AI systems actually answer.",
	},
	capabilities: [
		{ name: "Observe", description: "See how AI systems describe, compare, and recommend your brand across real buying questions." },
		{ name: "Explain", description: "Trace each answer back to the product facts, sources, and context influencing it." },
		{ name: "Improve", description: "Find the knowledge, content, and evidence gaps that are distorting market understanding." },
		{ name: "Verify", description: "Repeat the same scenarios to see whether changes alter model perception and recommendation." },
	] satisfies Capability[],
	foundationsIntro: {
		eyebrow: "THE INTELLIGENCE FOUNDATION",
		title: "Four forms of intelligence. One compounding system.",
		body: "These are the data foundations Yonaris learns from—not four separate products.",
	},
	foundations: [
		{ name: "Product Truth", label: "What is true", description: "Verifiable facts, conditions, boundaries, and differentiators." },
		{ name: "Market Intent", label: "What people need", description: "Questions, scenarios, constraints, and decision criteria that shape demand." },
		{ name: "Model Intelligence", label: "What AI concludes", description: "Answers, comparisons, citations, omissions, and changes across models." },
		{ name: "Commercial Feedback", label: "What the market proves", description: "Signals from conversations and outcomes that refine the next cycle." },
	] satisfies Foundation[],
	method: {
		eyebrow: "RECURSIVE FOREST",
		title: "Finite truths. Recursive growth.",
		body: "Instead of writing for every possible question, Yonaris organizes a finite set of product truths that can support a growing field of market answers.",
		steps: [
			{ name: "Establish truth", description: "Structure product facts, conditions, proof, and boundaries." },
			{ name: "Generate market questions", description: "Model the situations and decision criteria that create real demand." },
			{ name: "Observe answers", description: "Test how multiple AI systems respond and which sources they rely on." },
			{ name: "Correct the gaps", description: "Improve product knowledge, content, and evidence where understanding breaks." },
			{ name: "Repeat the test", description: "Measure the same questions again and turn change into learning." },
		],
	},
	evidence: {
		eyebrow: "SELECTED ENGAGEMENT",
		title: "A diagnosis built from questions the market actually asks.",
		body: "One engagement connected a structured fact base to multi-model testing and repeatable evidence review.",
		scope: [6, 30, 24, 8, 768] as const,
		labels: ["Entities", "Fact cards", "Buying questions", "AI platforms", "Answer samples"],
		outcomeLabel: "DeepSeek brand mention",
		outcome: "0% → 93.3%",
		note: "An anonymized engagement. Scope and outcome are drawn from completed delivery evidence; results vary by market and starting point.",
	},
	geo: {
		eyebrow: "WHERE WE START",
		title: "Starting with GEO. Built for what comes next.",
		body: "GEO is the first commercial application of Yonaris: understanding and improving how AI systems discover, interpret, compare, and recommend a brand. The same intelligence becomes the foundation for a broader AI-mediated marketing system.",
	},
	diagnostic: {
		eyebrow: "FREE DIAGNOSTIC",
		title: "See what AI sees before you decide what to change.",
		body: "Give us one brand, one market, and one question that matters. We will frame the first diagnostic around observable answers and evidence—not a generic score.",
		outputs: [
			"A baseline of how the brand appears against relevant alternatives",
			"Performance across the buying questions that matter",
			"The sources and knowledge gaps influencing the answer",
			"Three priority actions to test next",
		],
		disclosure: "This opens your email client. Nothing is sent until you send the email.",
	},
	pages: {
		platform: {
			eyebrow: "PLATFORM",
			title: "Market understanding, made observable.",
			summary: "Connect product truth, market questions, model responses, and commercial learning in one repeatable system.",
			description: "Yonaris turns AI-mediated market judgment into evidence marketing teams can inspect, improve, and verify.",
			sections: [
				{ eyebrow: "OBSERVE", title: "See the answer, not just the rank.", body: "Track how brands are described, compared, omitted, and recommended across real buying scenarios.", points: ["Multi-model answer capture", "Comparison and recommendation context", "Sources, citations, and omissions"] },
				{ eyebrow: "EXPLAIN", title: "Connect the judgment to its evidence.", body: "Relate model responses to product facts, market intent, and the sources shaping the answer.", points: ["Product truth graph", "Buying-question structure", "Evidence and source mapping"] },
				{ eyebrow: "IMPROVE & VERIFY", title: "Change the inputs. Repeat the test.", body: "Prioritize fixable gaps, improve the underlying knowledge and evidence, then run the same scenarios again.", points: ["Gap diagnosis", "Action priorities", "Repeatable verification"] },
			],
		},
		methodology: {
			eyebrow: "METHODOLOGY",
			title: "Build what generates the answers.",
			summary: "Recursive Forest organizes finite product truths into a system that can support a growing field of market questions.",
			description: "The method links structured facts, situational questions, model evidence, and repeat testing.",
			sections: [
				{ eyebrow: "01 / PRODUCT TRUTH", title: "Start with what can be verified.", body: "Facts are recorded with their conditions, boundaries, proof, and relationships so answers do not depend on generic claims." },
				{ eyebrow: "02 / SEMANTIC GROWTH", title: "Generate questions from context.", body: "Market questions expand from scenarios, roles, constraints, and decision criteria rather than a fixed keyword list." },
				{ eyebrow: "03 / RECURSION", title: "Let every answer improve the system.", body: "Observed responses and commercial feedback reveal the next fact, source, or condition that needs work." },
			],
		},
		results: {
			eyebrow: "RESULTS",
			title: "Evidence before theatre.",
			summary: "A selected engagement shows how structured facts and repeat testing turn an invisible problem into a measurable one.",
			description: "The engagement is anonymized. Yonaris publishes only the scope and outcome supported by completed delivery evidence.",
			sections: [
				{ eyebrow: "THE BASELINE", title: "Map the market before changing it.", body: "Six entities and thirty fact cards were connected to twenty-four buying questions across eight AI platforms." },
				{ eyebrow: "THE EVIDENCE", title: "768 answers created a reviewable record.", body: "Every sample could be inspected for brand inclusion, comparison logic, source use, and missing product truth." },
				{ eyebrow: "THE CHANGE", title: "DeepSeek brand mention moved from 0% to 93.3%.", body: "The figure belongs to this engagement and is not presented as a universal outcome." },
			],
		},
		geo: {
			eyebrow: "GEO",
			title: "Win the answer without becoming an answer-engine company.",
			summary: "Use GEO to diagnose and improve how AI systems understand the brand, while building a reusable market-intelligence foundation.",
			description: "Yonaris starts where demand is already moving: inside AI-generated discovery, comparison, and recommendation.",
			sections: [
				{ eyebrow: "DISCOVERY", title: "Know when the brand enters the answer.", body: "Measure presence in the situations and questions that matter, not an abstract list of prompts." },
				{ eyebrow: "UNDERSTANDING", title: "Know why the model frames the brand that way.", body: "Inspect comparisons, claims, sources, and missing facts behind the output." },
				{ eyebrow: "IMPROVEMENT", title: "Treat GEO as a learning loop.", body: "Change the product knowledge and evidence, repeat the same tests, and retain what the market teaches you." },
			],
		},
	} satisfies Record<Exclude<MarketingPageKey, "home" | "diagnostic">, DetailPageContent>,
};

export type MarketingContent = Omit<typeof en, "locale"> & { locale: Locale };

const zh: MarketingContent = {
	...en,
	locale: "zh",
	category: "AI 原生营销科技",
	companyDefinition: "Yonaris 是一家 AI 原生营销科技公司，帮助品牌理解并改善自己在 AI 介入的市场中，如何被发现、理解、比较与选择。",
	cta: { primary: "获取免费诊断", agent: "Agent 视图", contact: "联系我们" },
	navigation: [
		{ label: "平台", path: "/zh/platform" },
		{ label: "方法", path: "/zh/methodology" },
		{ label: "结果", path: "/zh/results" },
		{ label: "GEO", path: "/zh/geo" },
		{ label: "Agent View", path: "/agent" },
	],
	hero: {
		eyebrow: "AI 原生营销科技",
		title: ["重构 MarTech", "同时面向人，也面向智能体"],
		body: "Yonaris 帮助品牌理解并改善自己在 AI 介入的市场中，如何被发现、理解、比较与选择。",
	},
	marketShift: {
		eyebrow: "新的决策界面",
		title: "在点击发生之前，市场已经形成判断",
		body: "人们越来越多地把发现选择、比较差异和建立候选清单交给 AI。传统搜索、官网访问或销售对话开始之前，答案已经在影响需求。",
	},
	capabilitiesIntro: {
		eyebrow: "系统能力",
		title: "让不可见的判断，成为可验证的证据",
		body: "Yonaris 把企业掌握的事实、市场提出的问题与 AI 实际生成的答案连接起来。",
	},
	capabilities: [
		{ name: "观察", description: "看见 AI 如何在真实购买问题中描述、比较和推荐你的品牌。" },
		{ name: "解释", description: "把每个答案还原到正在影响它的产品事实、来源与上下文。" },
		{ name: "改善", description: "找到正在扭曲市场理解的知识、内容和证据缺口。" },
		{ name: "验证", description: "重复相同场景，判断改变是否真正影响模型认知与推荐。" },
	],
	foundationsIntro: {
		eyebrow: "情报基础",
		title: "四类情报，一个持续复利的系统",
		body: "它们是 Yonaris 持续学习的数据基础，而不是四个彼此独立的产品。",
	},
	foundations: [
		{ name: "Product Truth", label: "什么是真的", description: "可验证的事实、适用条件、边界与差异。" },
		{ name: "Market Intent", label: "市场需要什么", description: "塑造需求的问题、场景、限制与决策标准。" },
		{ name: "Model Intelligence", label: "AI 如何判断", description: "跨模型的答案、比较、引用、缺席与变化。" },
		{ name: "Commercial Feedback", label: "市场证明了什么", description: "来自对话与结果的信号，用于修正下一轮判断。" },
	],
	method: {
		eyebrow: "递归森林",
		title: "有限事实，递归生长",
		body: "Yonaris 不为每一个问题分别写答案，而是组织有限、可信的产品事实，让它们支撑不断生长的市场问题。",
		steps: [
			{ name: "建立事实", description: "结构化产品事实、条件、证据与边界。" },
			{ name: "生成市场问题", description: "还原真实需求背后的场景与决策标准。" },
			{ name: "观察模型答案", description: "测试多个 AI 系统如何回答，以及它们依赖哪些来源。" },
			{ name: "修正理解缺口", description: "改善发生偏差的产品知识、内容与证据。" },
			{ name: "重复同一测试", description: "再次测量相同问题，让变化成为下一轮学习。" },
		],
	},
	evidence: {
		eyebrow: "真实交付片段",
		title: "从市场真正提出的问题开始诊断",
		body: "一次交付把结构化事实库、多模型测试与可复核的证据评审连接在一起。",
		scope: [6, 30, 24, 8, 768],
		labels: ["实体", "事实卡片", "购买问题", "AI 平台", "答案样本"],
		outcomeLabel: "DeepSeek 品牌提及率",
		outcome: "0% → 93.3%",
		note: "匿名交付案例。范围与结果来自已经完成的交付证据；实际结果取决于市场与起始状态。",
	},
	geo: {
		eyebrow: "我们的起点",
		title: "从 GEO 开始，为接下来的一切而构建",
		body: "GEO 是 Yonaris 的第一个商业化应用：理解并改善 AI 如何发现、理解、比较与推荐品牌。同一套情报将成为更广泛的 AI 时代营销系统的基础。",
	},
	diagnostic: {
		eyebrow: "免费诊断",
		title: "先看见 AI 看见了什么，再决定改变什么",
		body: "给我们一个品牌、一个市场和一个真正重要的问题。第一份诊断从可观察的答案与证据出发，而不是给你一个泛化分数。",
		outputs: ["品牌与相关替代方案的认知基线", "关键购买问题中的表现", "影响答案的来源与知识缺口", "下一步最优先验证的三项行动"],
		disclosure: "提交后会打开你的邮件客户端；只有你发送邮件后，申请才会真正发出。",
	},
	pages: {
		platform: {
			eyebrow: "平台",
			title: "让市场理解变得可观察",
			summary: "把产品事实、市场问题、模型回答与商业反馈连接成一个可重复运行的系统。",
			description: "Yonaris 将 AI 介入后的市场判断转化为营销团队可以检查、改善和验证的证据。",
			sections: [
				{ eyebrow: "观察", title: "看见完整答案，而不只是排名", body: "在真实购买场景中追踪品牌如何被描述、比较、忽略与推荐。", points: ["跨模型答案采集", "比较与推荐上下文", "来源、引用与缺失"] },
				{ eyebrow: "解释", title: "把判断连接回它的证据", body: "把模型回答与产品事实、市场意图及影响答案的来源关联起来。", points: ["产品事实图谱", "购买问题结构", "证据与来源映射"] },
				{ eyebrow: "改善与验证", title: "改变输入，再重复同一测试", body: "优先修复可行动的缺口，改善底层知识与证据，再运行相同场景。", points: ["缺口诊断", "行动优先级", "重复验证"] },
			],
		},
		methodology: {
			eyebrow: "方法",
			title: "构建能够生成答案的系统",
			summary: "递归森林把有限的产品事实组织成能够支撑不断生长的市场问题的系统。",
			description: "这套方法连接结构化事实、场景问题、模型证据与重复测试。",
			sections: [
				{ eyebrow: "01 / 产品事实", title: "从可验证的事实开始", body: "每个事实都带着适用条件、边界、证据与关系，让答案不依赖空泛表述。" },
				{ eyebrow: "02 / 语义生长", title: "从上下文生成问题", body: "市场问题从场景、角色、限制与决策标准中生长，而不是固定关键词列表。" },
				{ eyebrow: "03 / 递归", title: "让每一个答案改善系统", body: "模型回答与商业反馈会暴露下一项需要补足的事实、来源或条件。" },
			],
		},
		results: {
			eyebrow: "结果",
			title: "先有证据，再讲故事",
			summary: "一次真实交付展示了结构化事实与重复测试，如何让不可见的问题变得可测量。",
			description: "案例经过匿名处理。Yonaris 只公开已经完成的交付证据能够支持的范围与结果。",
			sections: [
				{ eyebrow: "认知基线", title: "改变市场之前，先还原市场", body: "6 个实体与 30 张事实卡片，被连接到 24 个购买问题和 8 个 AI 平台。" },
				{ eyebrow: "证据记录", title: "768 个答案形成可复核记录", body: "每个样本都可以检查品牌是否出现、如何比较、使用哪些来源以及缺少哪些产品事实。" },
				{ eyebrow: "变化", title: "DeepSeek 品牌提及率从 0% 提升到 93.3%", body: "这个数字属于该次交付，不被描述为所有品牌都能获得的普遍结果。" },
			],
		},
		geo: {
			eyebrow: "GEO",
			title: "赢得答案，但不把自己做成一个答案引擎工具",
			summary: "用 GEO 诊断和改善 AI 如何理解品牌，同时积累可以复用的市场情报基础。",
			description: "Yonaris 从需求已经迁移的地方开始：AI 生成的发现、比较与推荐。",
			sections: [
				{ eyebrow: "发现", title: "知道品牌何时进入答案", body: "测量真正重要的场景与问题，而不是一份抽象的提示词清单。" },
				{ eyebrow: "理解", title: "知道模型为什么这样描述品牌", body: "检查答案背后的比较、主张、来源与缺失事实。" },
				{ eyebrow: "改善", title: "把 GEO 变成学习循环", body: "改变产品知识与证据，重复同一测试，并把市场反馈沉淀下来。" },
			],
		},
	},
};

export function getMarketingContent(locale: Locale): MarketingContent {
	return locale === "zh" ? zh : en;
}

export function getMarketingDetailPage(locale: Locale, page: MarketingDetailPageKey): DetailPageContent {
	return getMarketingContent(locale).pages[page];
}

export function getLocalizedPath(path: string, locale: Locale): string {
	const normalizedPath = path.length > 1 ? path.replace(/\/$/, "") : path;
	const route = MARKETING_ROUTES.find((entry) => entry.en === normalizedPath || entry.zh === normalizedPath);
	if (route) return route[locale];
	if (path.startsWith("/agent") || path.startsWith("/llms")) return path;
	return locale === "zh" ? `/zh${normalizedPath === "/" ? "" : normalizedPath}` : normalizedPath.replace(/^\/zh(?=\/|$)/, "") || "/";
}

export function getMarketingNavigation(locale: Locale, page: MarketingPageKey = "home") {
	const content = getMarketingContent(locale);
	const currentRoute = MARKETING_ROUTES.find((route) => route.key === page) ?? MARKETING_ROUTES[0];
	return {
		home: locale === "zh" ? "/zh" : "/",
		items: content.navigation,
		language: {
			label: locale === "zh" ? "EN" : "中文",
			path: currentRoute[locale === "zh" ? "en" : "zh"],
		},
		diagnostic: {
			label: content.cta.primary,
			path: locale === "zh" ? "/zh/diagnostic" : "/diagnostic",
		},
	};
}

export function getMarketingPageMeta(locale: Locale, page: MarketingPageKey) {
	const content = getMarketingContent(locale);
	const route = MARKETING_ROUTES.find((entry) => entry.key === page) ?? MARKETING_ROUTES[0];
	const title =
		page === "home"
			? `${content.hero.title.join(" ")} | Yonaris`
			: page === "diagnostic"
				? `${content.diagnostic.title} | Yonaris`
				: `${content.pages[page].title} | Yonaris`;
	const description =
		page === "home" ? content.hero.body : page === "diagnostic" ? content.diagnostic.body : content.pages[page].description;

	return {
		title,
		description,
		canonicalPath: route[locale],
		alternatePath: route[locale === "en" ? "zh" : "en"],
	};
}

function diagnosticBody(input: DiagnosticInput, locale: Locale): string {
	const labels =
		locale === "zh"
			? ["品牌", "官网", "市场 / 品类", "主要竞品", "希望 AI 回答的关键问题", "联系人", "邮箱"]
			: ["Brand", "Website", "Market / category", "Known competitors", "One important AI question", "Contact", "Email"];
	const values = [input.brand, input.website, input.market, input.competitors, input.question, input.name, input.email];
	return labels.map((label, index) => `${label}: ${values[index]?.trim() || "—"}`).join("\n");
}

export function buildDiagnosticMailto(input: DiagnosticInput, locale: Locale): string {
	const subject = locale === "zh" ? `Yonaris 免费诊断申请 / ${input.brand.trim()}` : `Yonaris free diagnostic / ${input.brand.trim()}`;
	return `mailto:${encodeURIComponent(CONTACT_EMAIL)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(diagnosticBody(input, locale))}`;
}

export function validateDiagnosticInput(input: DiagnosticInput): (keyof DiagnosticInput)[] {
	const errors: (keyof DiagnosticInput)[] = [];
	for (const field of ["brand", "question", "name"] as const) {
		if (!input[field].trim()) errors.push(field);
	}
	try {
		const website = new URL(input.website.trim());
		if (website.protocol !== "http:" && website.protocol !== "https:") errors.push("website");
	} catch {
		errors.push("website");
	}
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.push("email");
	return ["brand", "website", "question", "name", "email"].filter((field) => errors.includes(field as keyof DiagnosticInput)) as (keyof DiagnosticInput)[];
}

const agentDocuments: Record<AgentSection, { canonical: string; title: string; scope: string; body: () => string }> = {
	company: {
		canonical: "/",
		title: "Yonaris company facts",
		scope: "Yonaris is currently an early-stage AI-native MarTech company with GEO and AI-market perception diagnosis as its first commercial application.",
		body: () => `${en.companyDefinition}\n\nBrand thesis: ${en.hero.title.join(" ")}\n\nThe four intelligence foundations are ${en.foundations.map((item) => item.name).join(", ")}. They are data foundations, not separate product SKUs.`,
	},
	platform: {
		canonical: "/platform",
		title: "Yonaris platform facts",
		scope: "Current capabilities are observing, explaining, improving, and verifying how AI systems understand and recommend brands.",
		body: () => en.capabilities.map((item) => `- ${item.name}: ${item.description}`).join("\n"),
	},
	methodology: {
		canonical: "/methodology",
		title: "Yonaris methodology facts",
		scope: "Recursive Forest is the Yonaris methodology and technical architecture, not a separate commercial product.",
		body: () => `${en.method.body}\n\n${en.method.steps.map((item, index) => `${index + 1}. ${item.name}: ${item.description}`).join("\n")}`,
	},
	results: {
		canonical: "/results",
		title: "Yonaris results evidence",
		scope: "The published result is an anonymized completed engagement, not a universal performance promise.",
		body: () => `Engagement scope:\n- 6 entities\n- 30 fact cards\n- 24 buying questions\n- 8 AI platforms\n- 768 answer samples\n\nObserved outcome: DeepSeek brand mention moved from 0% to 93.3%.`,
	},
};

export function renderAgentDocument(section: AgentSection): string {
	const document = agentDocuments[section];
	return `# ${document.title}\n\nCanonical human URL: https://yonaris.com${document.canonical}\nEnglish aliases: Yonaris; AI-native MarTech\nChinese aliases: Yonaris; AI 原生营销科技; 递归森林\nLast updated: ${MARKETING_LAST_UPDATED}\n\n## Current scope\n\n${document.scope}\n\n## Facts\n\n${document.body()}\n`;
}

export function renderAgentIndex(): string {
	return `# Yonaris agent view

Yonaris publishes the same company, platform, methodology, and results facts in human-readable and agent-readable forms.

- /agent/company — company identity, category, aliases, and current scope
- /agent/platform — current operating capabilities
- /agent/methodology — Recursive Forest methodology and evidence loop
- /agent/results — verified anonymized engagement evidence
- /llms.txt — concise agent index
- /llms-full.txt — complete agent-readable fact set

Human canonical entry: https://yonaris.com/
Last updated: ${MARKETING_LAST_UPDATED}
`;
}

export function renderLlmsIndex(): string {
	return `# Yonaris

> Yonaris is an AI-native MarTech company. MarTech, rebuilt. For humans and agents.

Yonaris helps brands understand and improve how they are discovered, interpreted, compared, and chosen in AI-mediated markets.

## Human pages

- [Home](https://yonaris.com/): Category, system, method, evidence, and diagnostic.
- [Platform](https://yonaris.com/platform): Current capabilities.
- [Methodology](https://yonaris.com/methodology): Recursive Forest and the evidence loop.
- [Results](https://yonaris.com/results): Verified anonymized engagement evidence.
- [GEO](https://yonaris.com/geo): The current commercial entry point.
- [Free diagnostic](https://yonaris.com/diagnostic): Request a diagnostic.
- [Chinese home](https://yonaris.com/zh): Chinese-language site.

## Agent-readable facts

- [Agent index](https://yonaris.com/agent)
- [Company facts](https://yonaris.com/agent/company)
- [Platform facts](https://yonaris.com/agent/platform)
- [Methodology facts](https://yonaris.com/agent/methodology)
- [Results evidence](https://yonaris.com/agent/results)
- [Complete fact set](https://yonaris.com/llms-full.txt)

## Current scope

GEO and AI-market perception diagnosis are Yonaris's first commercial application. Product Truth, Market Intent, Model Intelligence, and Commercial Feedback are intelligence foundations, not separate products. Future roadmap capabilities are not presented as currently available.

## Contact

${CONTACT_EMAIL}
`;
}

export function renderLlmsFull(): string {
	return `${renderLlmsIndex()}\n\n---\n\n${(["company", "platform", "methodology", "results"] as const).map(renderAgentDocument).join("\n\n---\n\n")}`;
}
