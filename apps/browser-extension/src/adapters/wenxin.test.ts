import { describe, expect, test } from "vitest";
import { createAdapterFixture, FixtureDomPort } from "./test-fixture";
import { createWenxinAdapter, wenxinSelectorContract } from "./wenxin";

describe("Wenxin browser-extension adapter", () => {
	test("uses the current Wenxin origin and registered adapter identity", () => {
		expect(wenxinSelectorContract).toMatchObject({
			version: "wenxin-web-20260821-localpc-v1",
			surface: "wenxin.consumer_web",
			launchUrl: "https://wenxin.baidu.com/",
		});
	});

	test("collects one structured answer with direct citations and visual evidence", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://wenxin.baidu.com/",
				conversationUrl: "https://wenxin.baidu.com/chat/wenxin-session",
				newConversationLabels: ["开启新对话"],
				answer: {
					text: "文心回答",
					html: "<article>文心回答</article>",
					citations: [{ url: "https://source.example/wenxin", title: "文心来源" }],
				},
			}),
		);
		const adapter = createWenxinAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({
			answerText: "文心回答",
			webSearchObserved: null,
			webQueries: [],
			citations: [{ url: "https://source.example/wenxin", title: "文心来源" }],
			adapterVersion: "wenxin-web-20260821-localpc-v1",
		});
	});
});
