import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";

const sharedUi = vi.hoisted(() => ({ tagsInputProps: [] as Array<Record<string, unknown>> }));

vi.mock("@workspace/ui/components/tags-input", () => ({
	TagsInput: ({ emptyText, ...props }: { emptyText?: string } & Record<string, unknown>) => {
		sharedUi.tagsInputProps.push({ emptyText, ...props });
		return <span>{emptyText}</span>;
	},
}));

import { LocalizedTagsInput } from "./localized-tags-input";

describe("localized tag input copy", () => {
	it("passes a Chinese no-results state to the shared tag picker", () => {
		sharedUi.tagsInputProps.length = 0;
		const markup = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<LocalizedTagsInput value={[]} onValueChange={vi.fn()} />
			</I18nProvider>,
		);

		expect(markup).toContain("没有匹配的结果");
		expect(markup).not.toContain("No results");
	});

	it.each([
		["en", "No matching results", "Maximum reached", "Type or paste to add a value", "Add", "Remove seo"],
		["zh-CN", "没有匹配的结果", "已达到上限", "输入或粘贴以添加值", "添加", "移除 seo"],
	] as const)("passes all localized %s copy props to TagsInput", (locale, empty, maximum, hint, add, remove) => {
		sharedUi.tagsInputProps.length = 0;
		renderToStaticMarkup(
			<I18nProvider locale={locale}>
				<LocalizedTagsInput value={[]} onValueChange={vi.fn()} />
			</I18nProvider>,
		);
		const props = sharedUi.tagsInputProps.at(-1);
		expect(props).toBeDefined();
		if (!props) throw new Error("TagsInput props were not captured");

		expect(props).toMatchObject({
			emptyText: empty,
			maximumReachedText: maximum,
			entryHintText: hint,
			addValueText: add,
		});
		expect((props.removeTagLabel as (tag: string) => string)("seo")).toBe(remove);
	});
});
