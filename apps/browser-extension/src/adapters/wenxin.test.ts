import { describe, expect, test } from "vitest";
import { createAdapterFixture, FixtureDomPort } from "./test-fixture";
import { createWenxinAdapter, wenxinSelectorContract } from "./wenxin";

describe("Wenxin browser-extension adapter", () => {
	test("uses the current Wenxin origin and registered adapter identity", () => {
		expect(wenxinSelectorContract).toMatchObject({
			version: "wenxin-web-20260821-localpc-v5",
			surface: "wenxin.consumer_web",
			launchUrl: "https://wenxin.baidu.com/",
		});
	});

	test("collects one structured answer with direct citations and visual evidence", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://wenxin.baidu.com/",
				conversationUrl: "https://wenxin.baidu.com/search/7745716473774230402?enter_type=chat_url",
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
			adapterVersion: "wenxin-web-20260821-localpc-v5",
		});
	});

	test("accepts Wenxin's durable search conversation URL", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://wenxin.baidu.com/search/7745716473774230402?enter_type=chat_url",
				conversationUrl: "https://wenxin.baidu.com/search/7745716473774230402?enter_type=chat_url",
				newConversationLabels: ["开启新对话"],
			}),
		);
		const adapter = createWenxinAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({ answerText: "Current answer" });
	});

	test("waits through Wenxin's transient post-submit query until the durable URL is strict", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://wenxin.baidu.com/",
				conversationUrlTimeline: [
					"https://wenxin.baidu.com/search/8276808249583400391?enter_type=chat_url&from=send",
					"https://wenxin.baidu.com/search/8276808249583400391?enter_type=chat_url",
				],
				conversationUrl: "https://wenxin.baidu.com/search/8276808249583400391?enter_type=chat_url",
				newConversationLabels: ["开启新对话"],
			}),
		);
		const adapter = createWenxinAdapter(port);

		await expect(port.completeOneTask(adapter, "Prompt A")).resolves.toBeUndefined();
		expect(port.elapsedMs).toBeGreaterThanOrEqual(1_000);
	});

	test("rejects a Wenxin search conversation URL without the required entry query", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://wenxin.baidu.com/search/7745716473774230402",
				conversationUrl: "https://wenxin.baidu.com/search/7745716473774230402",
				newConversationLabels: ["开启新对话"],
			}),
		);
		const adapter = createWenxinAdapter(port);

		await expect(port.completeOneTask(adapter, "Prompt A")).rejects.toMatchObject({ code: "page_drift" });
	});
});
