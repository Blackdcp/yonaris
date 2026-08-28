import {
	type CanonicalPageFact,
	type CanonicalReadingFact,
	EN_READING_RECORDS,
	PAGE_FACTS,
	ZH_READING_RECORDS,
} from "./canonical-public-facts";
import { CHINA_COPY } from "./china-copy";
import { GLOBAL_COPY } from "./global-copy";
import {
	type AgentFact,
	type AgentQuestion,
	type AgentTopic,
	type ExperienceLocale,
	HUMAN_PAGE_KEYS,
	type HumanPageKey,
} from "./types";

type RegionalAgentFacts = Readonly<Record<HumanPageKey, AgentTopic>>;

const LAST_REVIEWED = "2026-08-27";

const EN_LIMITATIONS = [
	"Observations are bounded by the selected question, market, language, review time and AI surface.",
	"A public source supports only the fact and conditions it states.",
	"No record promises ranking, inclusion, retrieval, citation or a commercial outcome.",
] as const;

const ZH_LIMITATIONS = [
	"观察结果只覆盖选定的问题、市场、语言、核对时间和 AI 界面。",
	"一项公开来源只能支持它明确写出的事实与适用条件。",
	"任何记录都不承诺排名、收录、检索、引用或商业结果。",
] as const;

function humanPath(locale: ExperienceLocale, key: HumanPageKey): string {
	if (locale === "en") return key === "home" ? "/" : `/${key}`;
	return key === "home" ? "/zh" : `/zh/${key}`;
}

function agentPath(locale: ExperienceLocale, key: HumanPageKey): string {
	const prefix = locale === "zh" ? "/zh" : "";
	return key === "home" ? `${prefix}/agent` : `${prefix}/agent/${key}`;
}

function markdownPath(locale: ExperienceLocale, key: HumanPageKey): string {
	const prefix = locale === "zh" ? "/zh" : "";
	return key === "home" ? `${prefix}/agent/index.md` : `${prefix}/agent/${key}.md`;
}

function fromReadingFact(record: CanonicalReadingFact, path: string): AgentFact {
	return {
		id: record.stableId,
		value: record.fact,
		evidenceUrl: `${path}#${record.stableId}`,
		source: record.evidence,
		boundary: record.boundary,
	};
}

function fromPageFact(record: CanonicalPageFact, path: string): AgentFact {
	return {
		id: record.id,
		value: record.value,
		evidenceUrl: `${path}#${record.id}`,
		source: record.source,
		boundary: record.boundary,
	};
}

function factsFor(locale: ExperienceLocale, key: HumanPageKey): readonly AgentFact[] {
	const path = humanPath(locale, key);
	if (key === "home" || key === "company") {
		const records = locale === "en" ? EN_READING_RECORDS : ZH_READING_RECORDS;
		return records.map((record) => fromReadingFact(record, path));
	}
	const pageFacts = locale === "en" ? PAGE_FACTS.en : PAGE_FACTS.zh;
	const fact = pageFacts[key as keyof typeof pageFacts];
	return fact ? [fromPageFact(fact, path)] : [];
}

const groupTitles = {
	en: {
		home: "Category, purpose and scope",
		product: "Platform scope",
		approach: "Evidence discipline",
		geo: "Market context",
		company: "Category, purpose and scope",
		diagnostic: "Contact fields",
		privacy: "Contact request",
	},
	zh: {
		home: "品类、目的与范围",
		product: "系统范围",
		approach: "证据纪律",
		geo: "市场语境",
		company: "品类、目的与范围",
		diagnostic: "联系信息",
		privacy: "咨询信息",
	},
} as const;

const topicScope = {
	en: {
		home: "Public category, purpose and scope statements for Yonaris.",
		product: "The public platform statement and the boundary attached to it.",
		approach: "The public evidence record and the conditions required for a meaningful retest.",
		geo: "The market, language, category, alternatives and evidence conditions around one decision.",
		company: "The same public category, purpose and scope records available on the Human page.",
		diagnostic: "The three visible English contact fields and the purpose of the request.",
		privacy: "The public purpose and boundary of contact-request data.",
	},
	zh: {
		home: "本主题提供 Yonaris 的公开品类、目的与系统范围说明。",
		product: "本主题说明中文系统覆盖的业务连接，以及当前公开能力边界。",
		approach: "本主题说明公开证据记录，以及一次复核成立所需的可比较条件。",
		geo: "同一道决定旁边保留的市场、语言、品类、替代选择与证据条件。",
		company: "本主题提供与中文官网一致的品类、目的与系统范围记录。",
		diagnostic: "本主题说明中文联系表单的三项可见字段，以及这次咨询的用途。",
		privacy: "本主题说明联系申请信息的公开用途、可见范围与适用边界。",
	},
} as const;

const primaryQuestions = {
	en: {
		home: "What is Yonaris?",
		product: "What does the platform make inspectable?",
		approach: "What remains in a reviewable record?",
		geo: "What changes across markets?",
		company: "How does one company remain clear to both readers?",
		diagnostic: "What does the contact form request?",
		privacy: "How is contact-request data used?",
	},
	zh: {
		home: "Yonaris 是什么？",
		product: "系统把哪些环节接在一起？",
		approach: "一次可复核拆解保留什么？",
		geo: "跨市场判断要保留哪些条件？",
		company: "同一事实怎样同时给人和 Agent 阅读？",
		diagnostic: "预约需要填写什么？",
		privacy: "咨询信息如何使用？",
	},
} as const;

function questionsFor(
	locale: ExperienceLocale,
	key: HumanPageKey,
	facts: readonly AgentFact[],
): readonly AgentQuestion[] {
	const primary: AgentQuestion = {
		id: `${key}.overview`,
		title: primaryQuestions[locale][key],
		factIds: facts.map((fact) => fact.id),
	};
	if (key !== "home" && key !== "company") return [primary];
	return [
		primary,
		{
			id: `${key}.purpose`,
			title: locale === "en" ? "What does Yonaris connect?" : "Yonaris 把哪些业务要素接在一起？",
			factIds: ["yonaris.purpose.decision-system"],
		},
		{
			id: `${key}.scope`,
			title: locale === "en" ? "What conditions bound an observation?" : "一次观测受哪些条件约束？",
			factIds: ["yonaris.scope.martech-system"],
		},
	];
}

function buildRegion(locale: ExperienceLocale): RegionalAgentFacts {
	const copy = locale === "en" ? GLOBAL_COPY : CHINA_COPY;
	const limitations = locale === "en" ? EN_LIMITATIONS : ZH_LIMITATIONS;
	return Object.fromEntries(
		HUMAN_PAGE_KEYS.map((key) => {
			const path = humanPath(locale, key);
			const facts = factsFor(locale, key);
			return [
				key,
				{
					id: `${locale}.${key}`,
					locale,
					language: locale === "en" ? "en" : "zh-CN",
					title: copy[key].title,
					summary: copy[key].lead,
					humanPath: path,
					agentPath: agentPath(locale, key),
					markdownPath: markdownPath(locale, key),
					lastReviewed: LAST_REVIEWED,
					reviewedBy: "Yonaris",
					scope: topicScope[locale][key],
					limitations,
					questions: questionsFor(locale, key, facts),
					groups: [
						{
							id: `yonaris.${key}.facts`,
							title: groupTitles[locale][key],
							facts,
						},
					],
				} satisfies AgentTopic,
			] as const;
		}),
	) as unknown as RegionalAgentFacts;
}

export const AGENT_FACTS = {
	global: buildRegion("en"),
	zh: buildRegion("zh"),
} as const satisfies Readonly<Record<"global" | "zh", RegionalAgentFacts>>;
