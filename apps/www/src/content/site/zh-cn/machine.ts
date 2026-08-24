import type { FactualClaim } from "@/content/site/types";
import { ZH_MARKET_CONTEXTS, ZH_PAGE_CONTENT, ZH_PRODUCT_MODULES } from "./experience";

export type ZhMachinePageKey = keyof typeof ZH_PAGE_CONTENT;

export interface ZhMachineFacts {
	title: string;
	description: string;
	currentScope: string;
	claims: readonly FactualClaim[];
	limitations: readonly string[];
}

export const ZH_MACHINE_FACTS: Readonly<Record<ZhMachinePageKey, ZhMachineFacts>> = {
	home: {
		title: ZH_PAGE_CONTENT.home.title,
		description: ZH_PAGE_CONTENT.home.lead,
		currentScope: "Yonaris 围绕一个明确的品牌、市场、语言和购买问题，记录并审核配置化 AI 回答证据。",
		claims: [
			{ id: "reviewable-market-evidence", status: "current-software", text: "客户可在工作空间查看配置化回答记录及其证据状态。" },
			{ id: "human-agent-parity", status: "verified-evidence", text: "中国区域人类页面和 Agent 页面公开同一套范围、能力、证据与边界事实。" },
		],
		limitations: ["配置化观察不等于普遍市场覆盖，也不自动证明因果。"],
	},
	product: {
		title: ZH_PAGE_CONTENT.product.title,
		description: ZH_PAGE_CONTENT.product.lead,
		currentScope: "产品工作流连接答案观察、品牌判断、依据核验和行动复测四项能力。",
		claims: [
			{ id: "connected-workbench", status: "current-software", text: "同一工作流保留问题、回答、证据、判断和下一次测试之间的关系。" },
			{ id: "explicit-ownership", status: "managed-delivery", text: "系统记录、Yonaris 审核和客户决策保持不同责任。" },
		],
		limitations: [ZH_PRODUCT_MODULES[0].boundary, ZH_PRODUCT_MODULES[3].boundary],
	},
	approach: {
		title: ZH_PAGE_CONTENT.approach.title,
		description: ZH_PAGE_CONTENT.approach.lead,
		currentScope: "服务从诊断、观察、判断、行动到复测，每一步都保留客户输入、Yonaris 工作、交付产物和人工审核点。",
		claims: [{ id: "five-stage-delivery", status: "managed-delivery", text: "范围在观察前确认，行动由客户批准，复测保持原有比较规则。" }],
		limitations: ["Yonaris 帮助形成可审核判断，但不替客户决定业务优先级。"],
	},
	research: {
		title: ZH_PAGE_CONTENT.research.title,
		description: ZH_PAGE_CONTENT.research.lead,
		currentScope: "证据记录公开观察范围、有效分母、回答、可用来源、未知状态、人工判断和审核边界。",
		claims: [
			{ id: "visible-denominator", status: "verified-evidence", text: "任何比例与它的有效分母、市场范围和观察条件一起定义。" },
			{ id: "unknowns-stay-unknown", status: "verified-evidence", text: "不可获得的依据被记录为未知，而不是推断。" },
		],
		limitations: ["配置化抽样不是普遍覆盖；重复观察本身不能证明因果。"],
	},
	geo: {
		title: ZH_PAGE_CONTENT.geo.title,
		description: ZH_PAGE_CONTENT.geo.lead,
		currentScope: "AI 可见度工作流检查出现、描述、比较、可用依据和相同规则下的变化。",
		claims: [{ id: "configured-market-context", status: "managed-delivery", text: "中国市场与全球目标市场分别配置语言、购买问题、回答界面和竞争范围。" }],
		limitations: [ZH_MARKET_CONTEXTS[1].boundary],
	},
	company: {
		title: ZH_PAGE_CONTENT.company.title,
		description: ZH_PAGE_CONTENT.company.lead,
		currentScope: "当前服务方式结合客户可查看的软件记录、配置化观察、Yonaris 人工审核和客户拥有的业务决策。",
		claims: [{ id: "china-to-global-service", status: "managed-delivery", text: "中国企业的全球市场观察按目标市场重新确认语言、问题、界面、竞争范围和周期。" }],
		limitations: ["未经核验的团队、客户、办公室、认证、覆盖和结果事实不公开。"],
	},
	diagnostic: {
		title: ZH_PAGE_CONTENT.diagnostic.title,
		description: ZH_PAGE_CONTENT.diagnostic.lead,
		currentScope: "中国区域表单仅收集姓名、电话和公司，并通过服务端验证的邮件路径发送给 Yonaris 人工审核。",
		claims: [{ id: "china-contact-contract", status: "verified-evidence", text: "中国区域公开表单的三个可见字段是姓名、电话和公司。" }],
		limitations: ["提交只会开始人工需求沟通，不会立即生成扫描、分数或报告。"],
	},
	privacy: {
		title: ZH_PAGE_CONTENT.privacy.title,
		description: ZH_PAGE_CONTENT.privacy.lead,
		currentScope: "表单值由同源服务端严格验证、限流并交给配置的邮件服务；字段值不进入浏览器分析事件、本地存储或网址。",
		claims: [{ id: "provider-confirmed-success", status: "verified-evidence", text: "页面只在邮件服务确认接收后显示提交成功。" }],
		limitations: ["邮件接收确认不代表需求已经通过范围审核。"],
	},
};
