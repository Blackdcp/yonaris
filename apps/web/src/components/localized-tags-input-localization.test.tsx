import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

vi.mock("@workspace/ui/components/tags-input", () => ({
	TagsInput: ({ emptyText }: { emptyText?: string }) => <span>{emptyText}</span>,
}));

import { LocalizedTagsInput } from "./localized-tags-input";

describe("localized tag input copy", () => {
	it("passes a Chinese no-results state to the shared tag picker", () => {
		const markup = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<LocalizedTagsInput value={[]} onValueChange={vi.fn()} />
			</I18nProvider>,
		);

		expect(markup).toContain("没有匹配的结果");
		expect(markup).not.toContain("No results");
	});
});
