import {
	ZH_ANSWER_QUESTIONS,
	ZH_DELIVERY_STAGES,
	ZH_PAGE_CONTENT,
	ZH_PRODUCT_MODULES,
} from "@/content/site/zh-cn/experience";
import { DiagnosticForm } from "../../pages/diagnostic-form";
import {
	ZhAnswerMap,
	ZhAnswerScene,
	ZhDeliveryPath,
	ZhEvidenceRecord,
	ZhMarketContext,
	ZhProductWorkbench,
} from "../zh-interactions";
import { ZhClose, ZhGraphic, ZhHero, ZhSection } from "../zh-page-primitives";
import { ZhShell } from "../zh-shell";

const homeNav = [
	{ href: "#market-change", label: "市场变化" },
	{ href: "#core-questions", label: "核心问题" },
	{ href: "#product-capability", label: "产品能力" },
	{ href: "#service-process", label: "服务流程" },
	{ href: "#global-capability", label: "全球能力" },
	{ href: "#diagnostic-close", label: "需求沟通" },
] as const;

function ResponsibilityGraphic() {
	return (
		<div className="zh-site__responsibility" data-graphic="zh-responsibility">
			<div>
				<small>系统保留</small>
				<strong>配置与回答记录</strong>
			</div>
			<i>→</i>
			<div>
				<small>Yonaris 审核</small>
				<strong>采集质量与证据判断</strong>
			</div>
			<i>→</i>
			<div>
				<small>客户决定</small>
				<strong>优先级、行动与责任人</strong>
			</div>
		</div>
	);
}

function OperatingLoop() {
	return (
		<ol className="zh-site__loop" data-graphic="zh-operating-loop">
			{[
				["看见", "回答与上下文"],
				["判断", "依据与边界"],
				["行动", "一个可负责的改变"],
				["验证", "相同规则下复测"],
			].map(([label, copy], index) => (
				<li key={label}>
					<em>{String(index + 1).padStart(2, "0")}</em>
					<strong>{label}</strong>
					<span>{copy}</span>
				</li>
			))}
		</ol>
	);
}

export function ZhHomePage() {
	const content = ZH_PAGE_CONTENT.home;
	return (
		<ZhShell activeKey="home" sectionNav={homeNav}>
			<ZhHero eyebrow={content.eyebrow} title={content.title} lead={content.lead} visual={<ZhAnswerScene />} />
			<ZhSection
				id="market-change"
				number="01"
				label="市场已经改变"
				title="品牌面对的，不再只是搜索结果里的位置。"
				body="客户会让 AI 先解释品类、筛选选择、比较差异，再决定了解谁。品牌能否进入答案、怎样被理解，正在影响新的购买起点。"
			>
				<div className="zh-site__market-shift" data-graphic="zh-market-shift">
					<div>
						<small>过去</small>
						<strong>客户先搜索，再逐个了解品牌</strong>
					</div>
					<i>→</i>
					<div>
						<small>现在</small>
						<strong>客户先问 AI，由答案形成初步判断</strong>
					</div>
					<i>→</i>
					<div className="is-risk">
						<small>新的业务问题</small>
						<strong>你的品牌是否进入了这次判断？</strong>
					</div>
				</div>
			</ZhSection>
			<ZhSection
				id="core-questions"
				number="02"
				label="先回答最担心的五件事"
				title="不要先问你是什么职能，先看你对 AI 的哪件事最没有把握。"
				body="无论负责品牌、市场、产品还是业务增长，真正需要回答的是同一组市场问题。"
			>
				<ol className="zh-site__question-wall" data-graphic="zh-question-wall">
					{ZH_ANSWER_QUESTIONS.map((item, index) => (
						<li key={item.id}>
							<em>{String(index + 1).padStart(2, "0")}</em>
							<strong>{item.label}</strong>
							<span>{item.question}</span>
						</li>
					))}
				</ol>
			</ZhSection>
			<ZhSection
				id="product-capability"
				number="03"
				label="把焦虑变成工作流"
				title="Yonaris 连接答案、依据、判断和下一步行动。"
				body="不是给出一个无法解释的总分，而是让每一个结论都能回到问题、记录和证据边界。"
				dark
			>
				<OperatingLoop />
			</ZhSection>
			<ZhSection
				id="service-process"
				number="04"
				label="交付不是黑箱"
				title="从诊断到复测，每一步都说清谁提供什么、谁做什么、交付什么。"
				body="客户始终拥有业务判断；Yonaris 负责把观察和证据整理成可以审核的下一步。"
			>
				<div className="zh-site__stage-strip" data-graphic="zh-service-strip">
					{ZH_DELIVERY_STAGES.map((item, index) => (
						<div key={item.id}>
							<em>{String(index + 1).padStart(2, "0")}</em>
							<strong>{item.label}</strong>
							<span>{item.output}</span>
						</div>
					))}
				</div>
				<a className="zh-site__text-link" href="/zh/approach">
					查看完整服务过程 →
				</a>
			</ZhSection>
			<ZhSection
				id="global-capability"
				number="05"
				label="服务中国企业的全球业务"
				title="中国市场和全球市场，不应该使用同一套问题直接套用。"
				body="中国企业面对的已经不只是国内回答环境。Yonaris 按目标市场配置语言、购买语境、比较范围和观察条件。"
			>
				<ZhMarketContext />
			</ZhSection>
			<ZhSection
				id="human-agent"
				number="06"
				label="人和 Agent 看的是同一套事实"
				title="给人看清决策，也让 Agent 可以准确读取。"
				body="人类页面解释问题和行动；Agent 页面用稳定结构公开范围、事实与边界。两种阅读方式不维护两套真相。"
			>
				<div className="zh-site__parity" data-graphic="zh-human-agent">
					<div>
						<small>人类阅读</small>
						<strong>结论、解释、图形、行动</strong>
					</div>
					<i>↔</i>
					<div>
						<small>共享事实</small>
						<strong>范围、能力、证据、边界</strong>
					</div>
					<i>↔</i>
					<div>
						<small>Agent 阅读</small>
						<strong>稳定路径、结构化事实、关联页面</strong>
					</div>
				</div>
				<a className="zh-site__text-link" href="/zh/agent">
					打开 Agent 阅读版 →
				</a>
			</ZhSection>
			<ZhClose title="先从一个你最想看清的 AI 市场问题开始。" />
		</ZhShell>
	);
}

export function ZhProductPage() {
	const content = ZH_PAGE_CONTENT.product;
	return (
		<ZhShell activeKey="product">
			<ZhHero
				eyebrow={content.eyebrow}
				title={content.title}
				lead={content.lead}
				visual={
					<ZhGraphic type="zh-product-architecture" label="四项产品能力" protagonist="service-system">
						<div className="zh-site__architecture">
							{ZH_PRODUCT_MODULES.map((item, index) => (
								<div key={item.id}>
									<em>{String(index + 1).padStart(2, "0")}</em>
									<strong>{item.label}</strong>
								</div>
							))}
						</div>
					</ZhGraphic>
				}
				dark
			/>
			<ZhSection
				id="product-workbench"
				number="01"
				label="一个连接起来的工作台"
				title="切换能力，不会丢掉原来的问题和证据。"
				body="四项能力在同一条记录上工作，输入、可查看产物和边界始终相连。"
				dark
			>
				<ZhProductWorkbench />
			</ZhSection>
			<ZhSection
				id="module-flow"
				number="02"
				label="不是功能清单"
				title="每一项能力，都把一个明确产物交给下一步。"
				body="先观察，再解释；先核验依据，再设计行动。"
			>
				<div className="zh-site__module-flow" data-graphic="zh-module-flow">
					{ZH_PRODUCT_MODULES.map((item, index) => (
						<article key={item.id}>
							<em>{String(index + 1).padStart(2, "0")}</em>
							<h3>{item.label}</h3>
							<p>{item.artifact}</p>
							<small>{item.boundary}</small>
						</article>
					))}
				</div>
			</ZhSection>
			<ZhSection
				id="responsibility"
				number="03"
				label="责任边界"
				title="系统记录、Yonaris 审核、客户决策，三者不能混在一起。"
				body="产品不会把一个系统输出包装成自动执行的商业结论。"
			>
				<ResponsibilityGraphic />
			</ZhSection>
			<ZhClose title="先定义要解决的问题，再选择需要的产品能力。" />
		</ZhShell>
	);
}

export function ZhApproachPage() {
	const content = ZH_PAGE_CONTENT.approach;
	return (
		<ZhShell activeKey="approach">
			<ZhHero
				eyebrow={content.eyebrow}
				title={content.title}
				lead={content.lead}
				visual={
					<ZhGraphic type="zh-delivery-summary" label="五步服务概览" protagonist="delivery-roadmap">
						<div className="zh-site__delivery-summary">
							{ZH_DELIVERY_STAGES.map((item, index) => (
								<span key={item.id}>
									<em>{String(index + 1).padStart(2, "0")}</em>
									{item.label}
								</span>
							))}
						</div>
					</ZhGraphic>
				}
			/>
			<ZhSection
				id="delivery-path"
				number="01"
				label="完整服务过程"
				title="点击每一步，看清客户投入、Yonaris 工作、交付产物和审核点。"
				body="范围在观察前确认，行动在客户批准后推进，复测不跨越原有比较条件。"
			>
				<ZhDeliveryPath />
			</ZhSection>
			<ZhSection
				id="delivery-artifacts"
				number="02"
				label="每一步都留下可审核产物"
				title="服务不是一组口头建议，而是一条可以回看的证据链。"
				body="从范围说明到复测记录，每个产物都对应一个需要回答的审核问题。"
			>
				<div className="zh-site__artifact-row" data-graphic="zh-delivery-artifacts">
					{ZH_DELIVERY_STAGES.map((item, index) => (
						<article key={item.id}>
							<em>{String(index + 1).padStart(2, "0")}</em>
							<strong>{item.output}</strong>
							<p>{item.review}</p>
						</article>
					))}
				</div>
			</ZhSection>
			<ZhSection
				id="review-boundary"
				number="03"
				label="人的责任不会消失"
				title="Yonaris 帮助看见和判断，但不替客户决定业务优先级。"
				body="哪里需要人工审核、谁批准改变、谁承担结果，都在流程里明确。"
				dark
			>
				<ResponsibilityGraphic />
			</ZhSection>
			<ZhClose title="带着一个真实的业务问题，开始范围诊断。" />
		</ZhShell>
	);
}

export function ZhResearchPage() {
	const content = ZH_PAGE_CONTENT.research;
	return (
		<ZhShell activeKey="research">
			<ZhHero eyebrow={content.eyebrow} title={content.title} lead={content.lead} visual={<ZhEvidenceRecord />} dark />
			<ZhSection
				id="evidence-record"
				number="01"
				label="一条结论需要保留什么"
				title="点击字段，看它如何限制结论的含义。"
				body="空白和不可获得的字段会被明确标记，不会为了让画面完整而填入想象数据。"
			>
				<ZhEvidenceRecord />
			</ZhSection>
			<ZhSection
				id="measurement-definitions"
				number="02"
				label="分母也是结论的一部分"
				title="改变有效样本范围，就改变了指标含义。"
				body="任何比例都必须和它的有效分母、市场范围与观察条件一起出现。"
			>
				<div className="zh-site__definition" data-graphic="zh-measurement-definition">
					<span>范围内提到目标品牌的有效回答</span>
					<i>÷</i>
					<span>范围内全部有效回答</span>
					<strong>品牌提及率</strong>
				</div>
			</ZhSection>
			<ZhSection
				id="unknown-boundary"
				number="03"
				label="未知不是失败"
				title="没有依据时，最可信的做法是明确说不知道。"
				body="配置化抽样不是普遍覆盖；重复观察也不自动证明某个改变造成了结果。"
			>
				<div className="zh-site__boundary-grid" data-graphic="zh-unknown-boundary">
					<div>
						<small>已知</small>
						<strong>问题、回答、观察条件、可见依据</strong>
					</div>
					<div>
						<small>未知</small>
						<strong>界面没有提供的来源与影响路径</strong>
					</div>
					<div>
						<small>人工判断</small>
						<strong>只在已知范围内形成结论</strong>
					</div>
				</div>
			</ZhSection>
			<ZhClose title="先确认一条结论需要什么证据。" />
		</ZhShell>
	);
}

export function ZhGeoPage() {
	const content = ZH_PAGE_CONTENT.geo;
	return (
		<ZhShell activeKey="geo">
			<ZhHero eyebrow={content.eyebrow} title={content.title} lead={content.lead} visual={<ZhAnswerMap />} />
			<ZhSection
				id="answer-map"
				number="01"
				label="从出现到变化"
				title="点击关系节点，看每一步对应什么业务问题和证据产物。"
				body="AI 可见度不是单一排名，而是品牌事实、答案、比较、依据和复测之间的关系。"
			>
				<ZhAnswerMap />
			</ZhSection>
			<ZhSection
				id="market-context"
				number="02"
				label="市场语境决定问题"
				title="中国市场和全球市场，需要分别定义语言、品类和竞争范围。"
				body="全球服务能力来自按市场配置，而不是把一个市场的结论直接复制到另一个市场。"
			>
				<ZhMarketContext />
			</ZhSection>
			<ZhSection
				id="applied-process"
				number="03"
				label="落到可执行过程"
				title="AI 可见度最终要连接到一个可审核的下一步。"
				body="看见 → 判断 → 行动 → 验证，让每一次改变都能回到原问题。"
			>
				<OperatingLoop />
			</ZhSection>
			<ZhClose title="先定义目标市场，再观察品牌如何进入答案。" />
		</ZhShell>
	);
}

export function ZhCompanyPage() {
	const content = ZH_PAGE_CONTENT.company;
	return (
		<ZhShell activeKey="company">
			<ZhHero
				eyebrow={content.eyebrow}
				title={content.title}
				lead={content.lead}
				visual={<ZhMarketContext initialContext="global" />}
			/>
			<ZhSection
				id="purpose"
				number="01"
				label="为什么做 Yonaris"
				title="当 AI 开始参与市场判断，企业需要的不只是更多内容，而是可检查的市场证据。"
				body="Yonaris 希望把品牌在 AI 回答中的出现、描述、比较和依据，变成团队能够共同审核的工作对象。"
			>
				<OperatingLoop />
			</ZhSection>
			<ZhSection
				id="global-service"
				number="02"
				label="中国理解，全球配置"
				title="服务中国企业走向不同市场，不把中文经验简单翻译出去。"
				body="每个目标市场重新确认语言、购买问题、回答界面、竞争范围和观察周期。"
			>
				<ZhMarketContext initialContext="global" />
			</ZhSection>
			<ZhSection
				id="responsibility"
				number="03"
				label="当前服务方式"
				title="客户查看软件记录，Yonaris 负责配置化观察和人工审核。"
				body="产品与服务共同工作，但业务决策和行动批准始终由客户负责。"
			>
				<ResponsibilityGraphic />
			</ZhSection>
			<ZhSection
				id="verified-boundary"
				number="04"
				label="信任来自核验"
				title="没有批准的事实，就不放客户墙、规模数字和结果承诺。"
				body="团队、客户、办公室、认证、覆盖范围和交付结果，只在有可核验依据时公开。"
			>
				<div className="zh-site__trust-boundary" data-graphic="zh-verified-boundary">
					<span>公开</span>
					<strong>产品能力 · 方法 · 证据边界 · 需求入口</strong>
					<span>暂不公开</span>
					<strong>未经核验的规模与证明</strong>
				</div>
			</ZhSection>
			<ZhClose title="先说清你正在面对的市场问题。" />
		</ZhShell>
	);
}

export function ZhDiagnosticPage() {
	const content = ZH_PAGE_CONTENT.diagnostic;
	return (
		<ZhShell activeKey="diagnostic">
			<ZhHero
				eyebrow={content.eyebrow}
				title={content.title}
				lead={content.lead}
				visual={
					<ZhGraphic type="zh-diagnostic-preview" label="需求沟通流程" protagonist="contact-brief">
						<div className="zh-site__diagnostic-preview">
							<span>01 · 提交联系方式</span>
							<span>02 · 人工了解问题</span>
							<span>03 · 确认可执行范围</span>
							<span>04 · 再决定是否观察</span>
						</div>
					</ZhGraphic>
				}
			/>
			<ZhSection
				id="what-happens"
				number="01"
				label="提交之后发生什么"
				title="先由人沟通，不会立即生成扫描、分数或报告。"
				body="我们先理解你关心的市场、品牌问题和目标，再确认是否有合适的观察范围。"
			>
				<div className="zh-site__contact-flow" data-graphic="zh-contact-flow">
					<span>留下三项信息</span>
					<i>→</i>
					<span>Yonaris 人工联系</span>
					<i>→</i>
					<span>共同界定问题</span>
					<i>→</i>
					<strong>确认下一步</strong>
				</div>
			</ZhSection>
			<ZhSection
				id="lead-form"
				number="02"
				label="简单留资"
				title="姓名、电话、公司，三项就够。"
				body="不要求你先填写一整份项目说明；具体问题留到沟通时一起判断。"
			>
				<DiagnosticForm locale="zh" />
			</ZhSection>
			<ZhSection
				id="delivery-privacy"
				number="03"
				label="真实提交状态"
				title="只有邮件服务确认接收后，页面才会显示成功。"
				body="表单值不会写入网址、浏览器本地存储或分析事件；失败时保留当前页面输入，便于直接重试。"
			>
				<div className="zh-site__contact-flow" data-graphic="zh-delivery-privacy">
					<span>本页提交</span>
					<i>→</i>
					<span>服务端验证</span>
					<i>→</i>
					<span>邮件服务确认</span>
					<i>→</i>
					<strong>人工处理</strong>
				</div>
			</ZhSection>
		</ZhShell>
	);
}

export function ZhPrivacyPage() {
	const content = ZH_PAGE_CONTENT.privacy;
	return (
		<ZhShell activeKey="privacy">
			<ZhHero
				eyebrow={content.eyebrow}
				title={content.title}
				lead={content.lead}
				secondaryHref="/zh/diagnostic"
				secondaryLabel="返回需求沟通"
				visual={
					<ZhGraphic type="zh-privacy-flow" label="表单信息处理路径" protagonist="privacy-guardrail">
						<div className="zh-site__diagnostic-preview">
							<span>01 · 姓名、电话、公司</span>
							<span>02 · 服务端严格验证</span>
							<span>03 · 邮件服务确认接收</span>
							<span>04 · Yonaris 人工处理</span>
						</div>
					</ZhGraphic>
				}
			/>
			<ZhSection
				id="submitted-data"
				number="01"
				label="提交的信息"
				title="只提交姓名、电话和公司。"
				body="另有一个对用户不可见的空白防滥用字段；如果被自动程序填写，请求会被拒绝。"
			>
				<div className="zh-site__boundary-grid" data-graphic="zh-submitted-data">
					<div>
						<small>姓名</small>
						<strong>用于确认联系人</strong>
					</div>
					<div>
						<small>电话</small>
						<strong>用于本次需求沟通</strong>
					</div>
					<div>
						<small>公司</small>
						<strong>用于理解企业上下文</strong>
					</div>
				</div>
			</ZhSection>
			<ZhSection
				id="delivery"
				number="02"
				label="处理与传递"
				title="浏览器不直接发送邮件，也不会把信息放进网址。"
				body="请求由同源服务端验证、限流并提交给配置的邮件服务；只有邮件服务确认接收后才显示成功。"
			>
				<div className="zh-site__contact-flow" data-graphic="zh-privacy-delivery">
					<span>同源请求</span>
					<i>→</i>
					<span>字段与滥用检查</span>
					<i>→</i>
					<span>邮件服务</span>
					<i>→</i>
					<strong>人工审核</strong>
				</div>
			</ZhSection>
			<ZhSection
				id="purpose"
				number="03"
				label="使用目的"
				title="这些信息只用于审核需求和与你联系。"
				body="表单字段不会加入客户端分析事件，也不会写入 localStorage 或 Cookie。"
			>
				<a className="zh-site__button" href="/zh/diagnostic">
					返回需求沟通
				</a>
			</ZhSection>
		</ZhShell>
	);
}

export const ZH_PAGES = {
	home: ZhHomePage,
	product: ZhProductPage,
	approach: ZhApproachPage,
	research: ZhResearchPage,
	geo: ZhGeoPage,
	company: ZhCompanyPage,
	diagnostic: ZhDiagnosticPage,
	privacy: ZhPrivacyPage,
} as const;
