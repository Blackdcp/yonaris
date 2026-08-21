import { describe, expect, test } from "vitest";
import { createAdapterFixture, FixtureDomPort } from "./test-fixture";
import { createZhipuAdapter, zhipuSelectorContract } from "./zhipu";

describe("Zhipu browser-extension adapter", () => {
	test("uses the qualified ChatGLM origin and adapter identity", () => {
		expect(zhipuSelectorContract).toMatchObject({
			version: "zhipu-web-20260821-localpc-v1",
			surface: "zhipu.consumer_web",
			launchUrl: "https://chatglm.cn/",
		});
	});

	test("collects one structured answer with direct citations and visual evidence", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://chatglm.cn/main/alltoolsdetail?lang=zh",
				conversationUrl: "https://chatglm.cn/main/alltoolsdetail?lang=zh&cid=6a886af324c8dfed1eba5c18",
				newConversationLabels: ["新对话"],
				answer: {
					text: "智谱回答",
					html: "<article>智谱回答</article>",
					citations: [{ url: "https://source.example/zhipu", title: "智谱来源" }],
				},
			}),
		);
		const adapter = createZhipuAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({
			answerText: "智谱回答",
			webSearchObserved: null,
			webQueries: [],
			citations: [{ url: "https://source.example/zhipu", title: "智谱来源" }],
			adapterVersion: "zhipu-web-20260821-localpc-v1",
		});
	});

	test("rejects a conversation URL without the exact durable cid query", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://chatglm.cn/main/alltoolsdetail?lang=zh",
				conversationUrl: "https://chatglm.cn/main/alltoolsdetail?lang=zh",
				newConversationLabels: ["新对话"],
			}),
		);

		await expect(port.completeOneTask(createZhipuAdapter(port), "Prompt A")).rejects.toMatchObject({
			code: "post_submit_unknown",
		});
	});
});
