import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

vi.mock("@workspace/ui/components/dialog", () => ({
	Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DialogContent: ({ children }: { children: ReactNode }) => <section>{children}</section>,
	DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
	DialogFooter: ({ children }: { children: ReactNode }) => <footer>{children}</footer>,
	DialogHeader: ({ children }: { children: ReactNode }) => <header>{children}</header>,
	DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
	DialogTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@workspace/ui/components/select", () => ({
	Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SelectItem: ({ children, value }: { children: ReactNode; value: string }) => <div data-value={value}>{children}</div>,
	SelectTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	SelectValue: () => null,
}));

import { MeasurementScopeProvisionDialog } from "./measurement-scope-provision-dialog";

describe("MeasurementScopeProvisionDialog localization", () => {
	it("renders all Program fields and choices in Chinese without changing scope identity examples", () => {
		const markup = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<MeasurementScopeProvisionDialog
					brandId="brand-raw-id"
					sources={[{ id: "scope-source-raw", name: "StepFun CN 原项目", enabledPromptCount: 38 }]}
					onProvision={vi.fn()}
				/>
			</I18nProvider>,
		);

		expect(markup).toContain("配置范围");
		expect(markup).toContain("创建抽样范围");
		expect(markup).toContain("键");
		expect(markup).toContain("名称");
		expect(markup).toContain("市场");
		expect(markup).toContain("语言区域");
		expect(markup).toContain("评估池");
		expect(markup).toContain("时区");
		expect(markup).toContain("从以下项目复制已启用的提示词");
		expect(markup).toContain("评分 — 计入评估");
		expect(markup).toContain("观察 — 仅监测");
		expect(markup).toContain("StepFun CN 原项目 - 38 个已启用");
		expect(markup).toContain('data-value="scope-source-raw"');
		expect(markup).toContain('placeholder="CN"');
		expect(markup).toContain('placeholder="zh-CN"');
		expect(markup).toContain('placeholder="Asia/Shanghai"');
		expect(markup).not.toContain("Provision sampling scope");
	});
});
