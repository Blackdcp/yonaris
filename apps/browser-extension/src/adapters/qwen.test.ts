import { describe, expect, test } from "vitest";
import { createQwenAdapter, qwenSelectorContract } from "./qwen";
import { createAdapterFixture, FixtureDomPort } from "./test-fixture";

describe("Qwen browser-extension adapter", () => {
	test("declares the registered Qwen surface and adapter version", () => {
		expect(qwenSelectorContract).toMatchObject({
			version: "qwen-web-20260821-localpc-v4",
			surface: "qwen.consumer_web",
			launchUrl: "https://www.qianwen.com/",
		});
	});

	test("accepts both official Qwen canonical host variants", async () => {
		for (const pageUrl of ["https://qianwen.com/", "https://www.qianwen.com/"]) {
			const port = new FixtureDomPort(
				createAdapterFixture({
					pageUrl,
					conversationUrl: pageUrl,
					newConversationLabels: ["新建对话"],
				}),
			);
			await expect(createQwenAdapter(port).preflight()).resolves.toBeUndefined();
		}
	});

	test("collects a structured answer, direct citation, and bounded screenshot region", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://qianwen.com/",
				conversationUrl: "https://qianwen.com/chat/qwen-session",
				newConversationLabels: ["新建对话"],
				answer: {
					text: "千问回答",
					html: "<article>千问回答</article>",
					citations: [{ url: "https://source.example/qwen", title: "千问来源" }],
				},
			}),
		);
		const adapter = createQwenAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({
			answerText: "千问回答",
			webSearchObserved: null,
			webQueries: [],
			citations: [{ url: "https://source.example/qwen", title: "千问来源" }],
			evidenceViewportRect: { x: 200, y: 100, width: 800, height: 500, devicePixelRatio: 1 },
			adapterVersion: "qwen-web-20260821-localpc-v4",
		});
	});

	test("fails before submission when login, CAPTCHA, or account restriction is visible", async () => {
		for (const [code, override] of [
			["signed_out", { signedOut: true }],
			["captcha", { captcha: true }],
			["account_restricted", { accountRestricted: true }],
		] as const) {
			const port = new FixtureDomPort(
				createAdapterFixture({
					pageUrl: "https://qianwen.com/",
					conversationUrl: "https://qianwen.com/chat/qwen-session",
					newConversationLabels: ["新建对话"],
					...override,
				}),
			);
			await expect(createQwenAdapter(port).preflight()).rejects.toMatchObject({ code, stage: "pre_submit" });
			expect(port.submitCount).toBe(0);
		}
	});
});
