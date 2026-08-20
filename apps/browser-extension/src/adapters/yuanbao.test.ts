import { describe, expect, test } from "vitest";
import { createAdapterFixture, FixtureDomPort } from "./test-fixture";
import { createYuanbaoAdapter, yuanbaoSelectorContract } from "./yuanbao";

describe("Yuanbao browser-extension adapter", () => {
	test("keeps Yuanbao as the measured surface even when Yuanbao offers a DeepSeek model", () => {
		const adapter = createYuanbaoAdapter(
			new FixtureDomPort(
				createAdapterFixture({
					pageUrl: "https://yuanbao.tencent.com/chat/new-session",
					conversationUrl: "https://yuanbao.tencent.com/chat/new-session",
					newConversationLabels: ["新建对话"],
				}),
			),
		);
		expect(yuanbaoSelectorContract.version).toBe("yuanbao-web-20260821-localpc-v1");
		expect(adapter.surface).toBe("yuanbao.consumer_web");
	});

	test("collects one structured answer with direct citations and visual evidence", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://yuanbao.tencent.com/chat/new-session",
				conversationUrl: "https://yuanbao.tencent.com/chat/yuanbao-session",
				newConversationLabels: ["新建对话"],
				answer: {
					text: "元宝回答",
					html: "<article>元宝回答</article>",
					citations: [{ url: "https://source.example/yuanbao", title: "元宝来源" }],
				},
			}),
		);
		const adapter = createYuanbaoAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({
			answerText: "元宝回答",
			webSearchObserved: null,
			webQueries: [],
			citations: [{ url: "https://source.example/yuanbao", title: "元宝来源" }],
			adapterVersion: "yuanbao-web-20260821-localpc-v1",
		});
	});
});
