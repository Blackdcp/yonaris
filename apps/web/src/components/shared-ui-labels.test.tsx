import { Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbList } from "@workspace/ui/components/breadcrumb";
import { SidebarProvider, SidebarRail, SidebarTrigger } from "@workspace/ui/components/sidebar";
import { TagsInput } from "@workspace/ui/components/tags-input";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";
import { LocalizedTagsInput } from "./localized-tags-input";

function Shell({ children }: { children: ReactNode }) {
	return <SidebarProvider>{children}</SidebarProvider>;
}

describe("shared UI caller-controlled labels", () => {
	it("uses caller labels for breadcrumbs and sidebar controls", () => {
		const markup = renderToStaticMarkup(
			<Shell>
				<Breadcrumb label="导航路径" moreLabel="更多">
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbEllipsis />
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				<SidebarTrigger label="切换侧边栏" />
				<SidebarRail label="切换侧边栏" />
			</Shell>,
		);

		expect(markup).toContain('aria-label="导航路径"');
		expect(markup).toContain("更多");
		expect(markup).toContain('aria-label="切换侧边栏"');
		expect(markup).toContain('title="切换侧边栏"');
		expect(markup).not.toContain("Toggle Sidebar");
	});

	it("uses a caller label for tag removal while retaining the English default", () => {
		const localized = renderToStaticMarkup(
			<TagsInput value={["seo"]} onValueChange={vi.fn()} removeTagLabel={(tag) => `移除 ${tag}`} />,
		);
		const fallback = renderToStaticMarkup(<TagsInput value={["seo"]} onValueChange={vi.fn()} />);

		expect(localized).toContain('aria-label="移除 seo"');
		expect(fallback).toContain('aria-label="Remove seo"');
	});

	it("passes the web locale's shared labels to tag inputs", () => {
		const markup = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<LocalizedTagsInput value={["seo"]} onValueChange={vi.fn()} />
			</I18nProvider>,
		);

		expect(markup).toContain('aria-label="移除 seo"');
	});
});
