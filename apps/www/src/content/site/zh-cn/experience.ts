export type ZhQuestionId = "recommended" | "accurate" | "competitor" | "sources" | "next-test";

export interface ZhAnswerQuestion {
	id: ZhQuestionId;
	label: string;
	question: string;
	answer: string;
	evidence: string;
	judgement: string;
	nextStep: string;
}

export const ZH_ANSWER_QUESTIONS: readonly ZhAnswerQuestion[] = [
	{
		id: "recommended",
		label: "AI 会不会推荐我们？",
		question: "当客户提出一个明确的购买问题时，品牌有没有进入答案和候选名单？",
		answer: "查看品牌是否出现、在什么位置出现，以及答案同时给出了哪些替代选择。",
		evidence: "保留市场、语言、问题、回答界面和观察时间，避免脱离条件谈推荐。",
		judgement: "出现与否只有放在明确的比较范围里，才对业务决策有意义。",
		nextStep: "确认一个信息缺口，在相同条件下进行下一次观察。",
	},
	{
		id: "accurate",
		label: "AI 说得准不准？",
		question: "AI 如何解释品牌、产品和所属品类，是否与可以核验的事实一致？",
		answer: "把观察到的描述与已经确认的产品事实、定位和适用场景逐项对照。",
		evidence: "标注有依据的表述、缺失事实、品类偏移和仍无法判断的部分。",
		judgement: "问题不在文案是否好听，而在关键事实是否清晰、准确、可验证。",
		nextStep: "先补清一个持久的公开事实，再用同一个问题复测。",
	},
	{
		id: "competitor",
		label: "为什么更偏向竞品？",
		question: "答案用什么标准比较品牌，为什么某个替代方案更容易被选择？",
		answer: "检查比较标准、品牌描述和证据状态，而不是只看谁排在前面。",
		evidence: "把问题意图、竞品范围和答案片段放在同一条记录里。",
		judgement: "一次偏好只代表当前问题和候选范围，不能当作普遍排名。",
		nextStep: "围绕一个缺失的比较事实设计下一次同范围测试。",
	},
	{
		id: "sources",
		label: "答案依据了什么？",
		question: "当前界面提供了哪些可见来源、引用或其他可检查的证据信号？",
		answer: "只记录界面真正提供的来源；没有提供时，明确标记为未知。",
		evidence: "区分可见引用、可检查事实和不可获得的证据，不做反向猜测。",
		judgement: "可用证据只能解释答案的一部分；没有证据不等于没有影响。",
		nextStep: "检查一个权威事实是否在批准的公开界面上足够清楚、可访问。",
	},
	{
		id: "next-test",
		label: "下一步先改什么？",
		question: "哪个信息缺口最值得先处理，并在相同条件下再次观察？",
		answer: "把一个观察到的差距连接到一个具体、可负责、可复测的改变。",
		evidence: "答案、判断、负责人、改动和复测条件保持关联。",
		judgement: "好的下一步同时说清证据边界和决策责任，而不是给出一长串建议。",
		nextStep: "批准一个改变、稳定观察范围，再比较下一次结果。",
	},
];

export function getZhQuestion(id: ZhQuestionId): ZhAnswerQuestion {
	const question = ZH_ANSWER_QUESTIONS.find((candidate) => candidate.id === id);
	if (!question) throw new Error(`未知中国区域问题：${id}`);
	return question;
}

export type ZhProductModuleId = "observe" | "explain" | "evidence" | "experiment";

export const ZH_PRODUCT_MODULES = [
	{
		id: "observe" as const,
		label: "答案观察",
		conclusion: "先看见 AI 实际怎么回答。",
		input: "市场、语言、购买问题与观察条件",
		artifact: "可回看的答案记录",
		boundary: "单次回答不代表所有用户或未来回答。",
	},
	{
		id: "explain" as const,
		label: "品牌判断",
		conclusion: "再判断品牌在哪里被说对、说偏或被忽略。",
		input: "批准的品牌事实与比较范围",
		artifact: "描述、比较与缺口标注",
		boundary: "判断只在当前问题和候选范围内成立。",
	},
	{
		id: "evidence" as const,
		label: "依据核验",
		conclusion: "把已知依据和未知状态分开。",
		input: "界面可见来源与可核验事实",
		artifact: "证据记录与未知项",
		boundary: "不可获得的依据保持未知，不做推断。",
	},
	{
		id: "experiment" as const,
		label: "行动复测",
		conclusion: "一次只推动一个可验证的改变。",
		input: "已审核的缺口、负责人和改变",
		artifact: "下一步测试与复测条件",
		boundary: "复测支持比较，不自动证明因果。",
	},
] as const;

export type ZhDeliveryStageId = "diagnose" | "observe" | "judge" | "act" | "remeasure";

export const ZH_DELIVERY_STAGES = [
	{
		id: "diagnose" as const,
		label: "诊断",
		customerInput: "业务问题、目标市场与关键品牌事实",
		yonarisWork: "把模糊焦虑整理成一个可观察的问题",
		output: "范围说明",
		review: "双方确认观察条件后再开始",
	},
	{
		id: "observe" as const,
		label: "观察",
		customerInput: "确认的问题与比较范围",
		yonarisWork: "按已确认条件采集可比较的回答记录",
		output: "答案样本",
		review: "无效或不完整样本不进入有效分母",
	},
	{
		id: "judge" as const,
		label: "判断",
		customerInput: "批准的事实与需要关注的差距",
		yonarisWork: "核验描述、比较、可用来源和未知状态",
		output: "证据判断",
		review: "由人审核判断，不让系统替代决策",
	},
	{
		id: "act" as const,
		label: "行动",
		customerInput: "优先级、负责人和可执行限制",
		yonarisWork: "将一个差距转成边界明确的下一步测试",
		output: "行动说明",
		review: "客户批准改变与责任人",
	},
	{
		id: "remeasure" as const,
		label: "复测",
		customerInput: "已经实施的改变与原观察条件",
		yonarisWork: "在相同规则下再次观察并比较变化",
		output: "复测记录",
		review: "比较变化，不把相关性包装成因果",
	},
] as const;

export const ZH_MARKET_CONTEXTS = [
	{
		id: "china" as const,
		label: "中国市场",
		conclusion: "先用中国客户真实的语言和决策问题观察。",
		dimensions: ["中文问题表达", "本地品类语境", "已确认的回答界面", "中国市场比较范围"],
		boundary: "支持范围在项目开始前确认，不以平台数量制造覆盖错觉。",
	},
	{
		id: "global" as const,
		label: "全球市场",
		conclusion: "中国企业走向全球，需要按目标市场重新定义问题。",
		dimensions: ["目标市场语言", "当地购买语境", "已确认的回答界面", "当地竞争范围"],
		boundary: "全球服务能力按市场配置，不等于所有市场和界面的普遍覆盖。",
	},
] as const;

export const ZH_PAGE_CONTENT = {
	home: {
		eyebrow: "AI 时代的品牌市场证据",
		title: "客户正在先问 AI，再认识你的品牌。",
		lead: "当 AI 开始替客户筛选、比较和推荐产品，品牌是否出现、如何被描述、为什么输给竞争对手，已经成为新的市场问题。Yonaris 帮助企业看清答案、找到依据，并决定下一步应该改变什么。",
	},
	product: {
		eyebrow: "产品能力",
		title: "把 AI 对品牌的回答，变成可以看、可以判断、可以行动的证据。",
		lead: "不是再增加一块仪表盘，而是把问题、回答、依据、判断和下一次测试连接在同一个工作流里。",
	},
	approach: {
		eyebrow: "服务方式",
		title: "先把问题说清楚，再开始观察；先把依据看明白，再决定行动。",
		lead: "每一步都说明客户提供什么、Yonaris 做什么、交付什么，以及哪里必须由人审核。",
	},
	research: {
		eyebrow: "研究依据",
		title: "一个结论是否可信，先看它的范围、分母和证据边界。",
		lead: "Yonaris 把观察条件、有效样本、回答、可用来源、未知状态和审核结果放在同一条记录里。",
	},
	geo: {
		eyebrow: "AI 可见度",
		title: "品牌能否进入 AI 的答案，只是第一步。",
		lead: "还需要看它怎样被描述、与谁比较、依据从哪里来，以及改变后是否在相同条件下发生变化。",
	},
	company: {
		eyebrow: "关于 Yonaris",
		title: "理解中国市场，也按目标市场服务中国企业的全球业务。",
		lead: "Yonaris 用可检查的软件记录、配置化观察和人工审核，帮助企业在不同市场中保持清晰、准确且可验证的品牌表达。",
	},
	diagnostic: {
		eyebrow: "需求沟通",
		title: "先告诉我们怎么联系你，具体问题由人来一起判断。",
		lead: "留下姓名、电话和公司。我们会先了解你的市场问题和目标，再确认是否适合进入观察。",
	},
	privacy: {
		eyebrow: "隐私说明",
		title: "表单只提交三项联系信息，并由服务端完成邮件传递。",
		lead: "中国区域表单提交姓名、电话和公司；这些信息只用于审核需求和与你联系。",
	},
} as const;
