import { PAGE_FACTS, ZH_READING_RECORDS } from "./canonical-public-facts";
import type { HumanPageCopy } from "./types";

interface ChinaPageCopy extends HumanPageCopy {
	readonly primaryAction: { readonly label: string; readonly href: string };
	readonly closingTitle: string;
	readonly closingBody: string;
}

export const CHINA_ANXIETIES = [
	{
		id: "shortlist",
		label: "没进备选",
		diagnosis: "先看品牌有没有进入比较。",
		answer: "答案采用了一个更窄的品类说法，客户没有把品牌放进下一步了解。",
		impact: "对生意的影响：先解决如何进入比较，不是先追求更多提及。",
	},
	{
		id: "positioning",
		label: "核心优势被说偏",
		diagnosis: "先把品牌事实与答案里的主张放在一起。",
		answer: "品牌被提到，但真正影响购买的能力被写成了次要特点。",
		impact: "对生意的影响：客户记住了错误理由，销售还要重新解释一次。",
	},
	{
		id: "competitor",
		label: "竞品先被推荐",
		diagnosis: "先拆清答案采用了什么比较标准。",
		answer: "竞品的能力和公开依据连在一起，你的优势只有一句概括。",
		impact: "对生意的影响：不是少了一次曝光，而是少了一个继续被评估的理由。",
	},
	{
		id: "budget",
		label: "预算不知道该投哪里",
		diagnosis: "先找到客户判断与公开证据之间的断点。",
		answer: "官网、内容和投放都在说话，但没有共同回答客户真正关心的选择条件。",
		impact: "对生意的影响：团队可能继续加内容，却没有修复影响选择的那一处。",
	},
	{
		id: "change",
		label: "模型变化后结论失效",
		diagnosis: "保留问题、证据与观察条件，再谈变化。",
		answer: "一次答案只能说明当时看到了什么，不能代替后续复核。",
		impact: "对生意的影响：没有可比较的记录，变化就无法转成下一次决定。",
	},
] as const;

export const CHINA_SYSTEM_NODES = [
	{
		id: "question",
		label: "市场问题",
		question: "客户到底在做什么选择？",
		connected: "它把后面的事实、内容、观测和行为拉回同一道业务问题。",
		disconnected: "断开后，团队会监测很多答案，却不知道哪一个值得花钱处理。",
	},
	{
		id: "fact",
		label: "品牌事实",
		question: "我们究竟能证明什么？",
		connected: "它把产品能力写成有条件、有范围、能核对的公开事实。",
		disconnected: "断开后，内部口号会流进外部内容，客户仍找不到可信的选择依据。",
	},
	{
		id: "content",
		label: "内容与渠道",
		question: "事实在哪里被客户和 AI 找到？",
		connected: "官网、内容与公开触点用客户会使用的语言承接同一事实。",
		disconnected: "断开后，内容预算越分散，越难知道哪一处真正支持了判断。",
	},
	{
		id: "observation",
		label: "AI 与市场观测",
		question: "品牌正在怎样被理解和比较？",
		connected: "把特定时间、市场、语言和问题下看到的答案保留为可复核信号。",
		disconnected: "断开后，团队只有零散截图，模型变化时无法判断什么真的变了。",
	},
	{
		id: "behaviour",
		label: "客户行为",
		question: "答案里的判断有没有进入真实选择？",
		connected: "把公开认知与可观察的询盘、比较和决策反馈放在一起看。",
		disconnected: "断开后，团队容易把被提到误当成被选择，继续投入错误指标。",
	},
	{
		id: "review",
		label: "行动与复核",
		question: "下一笔预算先解决什么？",
		connected: "让团队基于同一问题选择动作，并在可比较条件下复核。",
		disconnected: "断开后，每次改动都像重新开始，预算无法沉淀成下一次判断。",
	},
] as const;

export const CHINA_BREAKDOWN_QUESTION = "为什么竞品进入了推荐，而我们的优势没有变成选择理由？";

export const CHINA_BREAKDOWN_STATES = [
	{
		id: "baseline",
		label: "基线",
		answer: "示例答案列出了几类可选方案，品牌只被简短提到。",
		evidence: "公开页面有能力描述，但没有把能力连接到这道问题采用的选择条件。",
		judgment: "品牌出现了，却没有得到继续比较所需的理由。",
		action: "保留当时的问题、答案、来源和观察条件。",
	},
	{
		id: "break",
		label: "断点",
		answer: "答案把可核对的交付条件作为比较依据，品牌页面只给出宽泛主张。",
		evidence: "缺少能说明适用条件、范围和依据的公开事实。",
		judgment: "真正的断点不是提及次数，而是选择理由没有证据承接。",
		action: "只选最影响这道问题的一项事实先处理。",
	},
	{
		id: "action",
		label: "行动",
		answer: "示例动作是在原页面补充适用条件、范围与可核对来源。",
		evidence: "新内容沿用同一道问题的语言，不另造一套宣传口号。",
		judgment: "这一步只改变公开证据，不预先声称答案或客户行为会改善。",
		action: "按原问题和可比较条件安排复核。",
	},
	{
		id: "review",
		label: "复核",
		answer: "复核记录分别标注答案里已变化与未变化的部分。",
		evidence: "已变化：能力与选择条件建立了连接。未变化：推荐顺序没有变化。",
		judgment: "无法归因：单次复核不能证明变化由某一项动作造成。",
		action: "记录已变化、未变化、无法归因，再决定是否继续投入。",
	},
] as const;

export const CHINA_READING_RECORDS = ZH_READING_RECORDS;

export const CHINA_COPY = {
	home: {
		navLabel: "为什么现在",
		metaTitle: "Yonaris｜看清 AI 如何认识、比较和理解你的品牌",
		metaDescription: "从业务焦虑出发，把客户问题、品牌事实、公开证据与可观察行为接成可复核的判断。",
		eyebrow: "面向人与 Agent 的 AI 原生营销科技基础设施",
		title: "AI 正在替客户认识你、比较你，也可能误解你。",
		lead: "客户可能在第一次联系你之前，就已经从 AI 答案里形成了备选和判断。Yonaris 把客户问题、品牌事实、公开证据、市场观测与行动复核接在一起，让团队知道哪里值得先投入。",
		primaryAction: { label: "带一道真实问题来聊", href: "/zh/diagnostic" },
		closingTitle: "先拿一道最怕被答错的问题来。",
		closingBody: "我们从这道问题影响的选择、现有证据和观察条件开始，不需要先准备一整套材料。",
	},
	product: {
		navLabel: "系统怎么运转",
		metaTitle: "系统怎么运转｜Yonaris",
		metaDescription: "连接市场问题、品牌事实、内容与渠道、AI 与市场观测、客户行为、行动与复核。",
		eyebrow: "让一次判断变成可以持续运营的能力",
		title: "不是再做一层内容，而是重建品牌被理解的基础设施。",
		lead: PAGE_FACTS.zh.product.value,
		primaryAction: { label: "带一道问题看系统", href: "/zh/diagnostic" },
		closingTitle: "先把一个断开的节点接回来。",
		closingBody: "不需要同时重做所有内容。先找到影响当前选择的断点，再决定下一笔预算。",
	},
	approach: {
		navLabel: "看一次拆解",
		metaTitle: "看一次拆解｜Yonaris",
		metaDescription: "用去标识示例重放基线、断点、行动与复核，不预先承诺结果。",
		eyebrow: "公开方法演示 · 示例场景，不代表客户结果。",
		title: "从一句 AI 答案，追到真正影响选择的那个断点。",
		lead: PAGE_FACTS.zh.approach.value,
		primaryAction: { label: "用你的问题开始", href: "/zh/diagnostic" },
		closingTitle: "把问题带进来，先找一个断点。",
		closingBody: "我们会先判断这道问题是否足够具体，能不能在可比较条件下留下记录。",
	},
	geo: {
		navLabel: "跨市场",
		metaTitle: "跨市场判断｜Yonaris",
		metaDescription: "同一套系统随市场、语言、当地品类表述、替代选择与证据条件改变。",
		eyebrow: "同一套系统，不同的市场条件",
		title: "换一个市场，先换判断条件，不是只换语言。",
		lead: PAGE_FACTS.zh.geo.value,
		primaryAction: { label: "讨论一个市场问题", href: "/zh/diagnostic" },
		closingTitle: "先定义条件，再比较答案。",
		closingBody: "告诉我们客户在哪里做什么选择、用什么语言，以及会比较哪些替代方案。",
	},
	company: {
		navLabel: "人类与 Agent",
		metaTitle: "人类与 Agent 如何读同一事实｜Yonaris",
		metaDescription: "用同一条公开事实服务人的判断与 Agent 的检索，并明确证据和适用范围。",
		eyebrow: "同一家公司，两种阅读需求",
		title: "同一家公司，应该让人和 Agent 都读得清楚。",
		lead: "人需要知道事实对决定意味着什么；Agent 需要明确的事实、证据、适用范围与稳定标识。两种阅读来自同一份公开记录。",
		primaryAction: { label: "查看对应 Agent 记录", href: "/zh/agent/company" },
		closingTitle: "清楚，是一种公开纪律。",
		closingBody: "结构化记录帮助事实被检索和核对，但不保证排名、收录、检索或引用。",
	},
	diagnostic: {
		navLabel: "预约沟通",
		metaTitle: "预约沟通｜Yonaris",
		metaDescription: "留下姓名、电话和公司，从一道最不想让 AI 答错的问题开始。",
		eyebrow: "先从业务问题开始",
		title: "带一道你最不想让 AI 答错的问题来。",
		lead: "用一次简短沟通说清楚客户在做什么选择、问题发生在哪个市场。我们先判断它是否值得继续查。",
		primaryAction: { label: "填写联系方式", href: "#contact-form" },
		closingTitle: "姓名、电话、公司。",
		closingBody: "只需要三项联系方式。我们会围绕你带来的问题继续沟通。",
	},
	privacy: {
		navLabel: "隐私说明",
		metaTitle: "隐私说明｜Yonaris",
		metaDescription: "说明中文咨询表单收集姓名、电话和公司的用途。",
		eyebrow: "咨询信息说明",
		title: "姓名、电话、公司，只用于回复这次咨询。",
		lead: "中文咨询表单只要求这三项可见信息。只有投递服务接受申请后，页面才显示已送出；未确认时会保留已填内容。",
		primaryAction: { label: "返回预约沟通", href: "/zh/diagnostic" },
		closingTitle: "咨询内容不会显示在公开页面。",
		closingBody: "这些信息用于回复本次咨询、了解基本需求和安排后续沟通。",
	},
} as const satisfies Record<string, ChinaPageCopy>;
