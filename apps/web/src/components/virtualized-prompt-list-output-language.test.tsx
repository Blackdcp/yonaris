import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ chartProps: [] as Array<Record<string, unknown>> }));

vi.mock("@tanstack/react-virtual", () => ({
	useWindowVirtualizer: () => ({
		getVirtualItems: () => [{ index: 0, start: 0 }],
		getTotalSize: () => 380,
		measureElement: vi.fn(),
		measure: vi.fn(),
	}),
}));
vi.mock("./cached-prompt-chart", () => ({
	CachedPromptChart: (props: Record<string, unknown>) => {
		harness.chartProps.push(props);
		return <article>{String(props.promptName)}</article>;
	},
}));

import { VirtualizedPromptList } from "./virtualized-prompt-list";

describe("VirtualizedPromptList output-language boundary", () => {
	it("passes the exact resolved selection and setter to every rendered chart without changing raw prompts", () => {
		const setOutputLanguage = vi.fn();
		const markup = renderToStaticMarkup(
			<VirtualizedPromptList
				prompts={[{ id: "prompt/raw-id", value: "RAW Prompt 原样 #42" }]}
				brandId="brand/raw-id"
				lookback="1m"
				selectedModel="model/raw"
				availableModels={["model/raw"]}
				outputLanguage="zh-CN"
				outputLanguageResolved
				onOutputLanguageChange={setOutputLanguage}
			/>,
		);

		expect(markup).toContain("RAW Prompt 原样 #42");
		expect(harness.chartProps.at(-1)).toMatchObject({
			promptId: "prompt/raw-id",
			promptName: "RAW Prompt 原样 #42",
			brandId: "brand/raw-id",
			outputLanguage: "zh-CN",
			outputLanguageResolved: true,
			onOutputLanguageChange: setOutputLanguage,
		});
	});
});
