/**
 * Stories for the brand Overview page (/app/$brand). Renders the real
 * DashboardPage with mocked brand + dashboard/share-of-voice data so the page
 * can be viewed without auth or a database.
 */
import type { Meta, StoryObj } from "@storybook/react";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import type { ComponentType, ReactNode } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { I18nProvider } from "@/i18n/provider";
import { Route } from "@/routes/_authed/app/$brand/index";

// The route file exports only `Route` (route files must, for code-splitting).
// Render its component via the route options — the mock exposes `options`.
const DashboardPage = (Route as unknown as { options: { component: ComponentType } }).options.component;

import { setMockShareOfVoice } from "./_mocks/server-analysis";
import { setMockDashboardSummary } from "./_mocks/server-dashboard";
import {
	getMockOnboardingSaveRequests,
	resetMockOnboardingCalls,
	setMockOnboardingDelay,
	setMockOnboardingError,
	setMockOnboardingSuggestion,
} from "./_mocks/server-onboarding";
import { setMockRouteContext } from "./_mocks/tanstack-router";
import { setMockBrand } from "./_mocks/use-brands";
import { mockDashboardSummary, mockShareOfVoice } from "./analytics-fixtures";

const onboardedBrand = {
	id: "brand-1",
	name: "Acme",
	website: "https://acme.com",
	onboarded: true,
	enabled: true,
	prompts: [{ id: "p1", value: "best crm", enabled: true }],
	effectiveModels: ["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-pro"],
	earliestDataDate: "2026-05-05",
	delayOverrideHours: 24,
};

const onboardingBrand = {
	...onboardedBrand,
	id: "brand-raw-id",
	name: "StepFun 原名",
	website: "https://evidence.example.cn/path?q=CN",
	onboarded: false,
	prompts: [],
};

const onboardingSuggestion = {
	brandName: "StepFun 建议名",
	website: "https://suggested.example.cn",
	additionalDomains: ["docs.example.cn"],
	aliases: ["Step 原始别名"],
	competitors: [{ name: "DeepSeek 原名", domains: ["deepseek.example.cn"], aliases: ["DS-R1"] }],
	suggestedPrompts: [{ prompt: "Which AI IDE works in 中国?", tags: ["Buyer-Journey"] }],
};

function Shell({ children }: { children: ReactNode }) {
	return (
		<TooltipProvider>
			<div className="bg-background text-foreground antialiased flex min-h-svh flex-col">
				<div className="flex flex-1 flex-col">
					<div className="@container/main flex flex-1 flex-col gap-2">
						<div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">{children}</div>
					</div>
				</div>
			</div>
		</TooltipProvider>
	);
}

const meta = {
	title: "Pages/Overview",
	component: DashboardPage,
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => {
			setMockBrand(onboardedBrand);
			setMockRouteContext({ clientConfig: { defaultDelayHours: 24 } });
			setMockDashboardSummary(mockDashboardSummary);
			setMockShareOfVoice(mockShareOfVoice);
			return (
				<I18nProvider locale="en">
					<Shell>
						<Story />
					</Shell>
				</I18nProvider>
			);
		},
	],
} satisfies Meta<typeof DashboardPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

function ChineseOnboardingRoute({ delayMs = 0, error = null }: { delayMs?: number; error?: string | null }) {
	setMockBrand(onboardingBrand);
	setMockRouteContext({
		clientConfig: {
			mode: "local",
			defaultDelayHours: 24,
			branding: { name: "Evidence Portal" },
		},
	});
	setMockDashboardSummary(mockDashboardSummary);
	setMockShareOfVoice(mockShareOfVoice);
	resetMockOnboardingCalls();
	setMockOnboardingSuggestion(onboardingSuggestion);
	setMockOnboardingDelay(delayMs);
	setMockOnboardingError(error);

	return (
		<I18nProvider locale="zh-CN">
			<DashboardPage />
		</I18nProvider>
	);
}

export const ChineseOnboardingInitial: Story = {
	render: () => <ChineseOnboardingRoute />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		expect(await canvas.findByRole("heading", { name: "研究品牌数据" })).toBeVisible();
		expect(canvas.getByText(/分析网站并找出最适合追踪的生成式 AI 提示词/)).toBeVisible();
		expect(canvas.getByText(/https:\/\/evidence\.example\.cn\/path\?q=CN/)).toBeVisible();
		expect(canvas.getByRole("button", { name: "分析品牌" })).toBeVisible();
		expect(canvasElement).not.toHaveTextContent("Research Brand Data");
	},
};

export const ChineseOnboardingPending: Story = {
	render: () => <ChineseOnboardingRoute delayMs={60_000} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(await canvas.findByRole("button", { name: /Analyze brand|分析品牌/ }));

		expect(await canvas.findByRole("button", { name: /正在分析品牌/ })).toBeDisabled();
		expect(canvas.getByRole("button", { name: "取消" })).toBeVisible();
		expect(canvasElement).not.toHaveTextContent("Analyzing brand");
	},
};

export const ChineseOnboardingFailure: Story = {
	render: () => <ChineseOnboardingRoute error="worker SQL host and stack detail must stay hidden" />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(await canvas.findByRole("button", { name: /Analyze brand|分析品牌/ }));
		const alert = await canvas.findByRole("alert");

		expect(alert).toHaveTextContent("出现了问题，请重试。");
		expect(alert).not.toHaveTextContent("worker SQL host");
		expect(alert).not.toHaveTextContent("Brand analysis failed");
	},
};

export const ChineseOnboardingReviewAndSave: Story = {
	render: () => <ChineseOnboardingRoute />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(await canvas.findByRole("button", { name: /Analyze brand|分析品牌/ }));
		await canvas.findByText("DeepSeek 原名");

		expect.soft(canvas.getByRole("heading", { name: "品牌详情" })).toBeVisible();
		expect.soft(canvas.getByText("确认用于追踪的品牌标识、其他域名和别名。")).toBeVisible();
		const textboxes = canvas.getAllByRole("textbox");
		expect.soft(textboxes[0]).toHaveAccessibleName("品牌名称");
		expect.soft(textboxes[0]).toHaveValue("StepFun 原名");
		expect.soft(textboxes[1]).toHaveAccessibleName("网站网址");
		expect.soft(textboxes[1]).toHaveValue("https://evidence.example.cn/path?q=CN");
		expect.soft(canvas.getByText("docs.example.cn")).toBeVisible();
		expect.soft(canvas.getByText("Step 原始别名")).toBeVisible();
		expect.soft(canvas.getByText("Which AI IDE works in 中国?")).toBeVisible();

		let saveButton = canvas.getByRole("button", { name: /Start tracking|开始追踪/ });
		expect.soft(saveButton).toHaveTextContent("开始追踪（1 个新提示词）");

		await userEvent.click(canvas.getAllByRole("switch", { name: "停用提示词" })[0]);
		await waitFor(() => {
			saveButton = canvas.getByRole("button", { name: /Start tracking|开始追踪/ });
			expect(saveButton).toHaveTextContent("0");
		});
		await userEvent.click(saveButton);
		const validationAlert = await canvas.findByRole("alert");
		expect.soft(validationAlert).toHaveTextContent("请至少选择或添加一个已启用的提示词，再开始追踪。");

		await userEvent.click(canvas.getAllByRole("switch", { name: "启用提示词" })[0]);
		setMockOnboardingDelay(500);
		saveButton = canvas.getByRole("button", { name: /Start tracking|开始追踪/ });
		await userEvent.click(saveButton);
		expect(await canvas.findByRole("button", { name: /正在保存/ })).toBeDisabled();

		await waitFor(() => expect(getMockOnboardingSaveRequests()).toHaveLength(1));
		expect(getMockOnboardingSaveRequests()[0]).toEqual({
			data: {
				brandId: "brand-raw-id",
				brandName: "StepFun 原名",
				website: "https://evidence.example.cn/path?q=CN",
				additionalDomains: ["docs.example.cn"],
				aliases: ["Step 原始别名"],
				competitors: [{ name: "DeepSeek 原名", domains: ["deepseek.example.cn"], aliases: ["DS-R1"] }],
				prompts: [{ value: "Which AI IDE works in 中国?", tags: ["Buyer-Journey"], enabled: true }],
			},
		});
		await waitFor(() => expect(canvas.getByRole("button", { name: /Start tracking|开始追踪/ })).toBeEnabled());
	},
};
