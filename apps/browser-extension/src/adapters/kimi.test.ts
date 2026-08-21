import { describe, expect, test } from "vitest";
import { createKimiAdapter, kimiSelectorContract } from "./kimi";
import { createAdapterFixture, FixtureDomPort } from "./test-fixture";

describe("Kimi browser-extension adapter", () => {
	test("declares the registered Kimi surface and adapter version", () => {
		expect(kimiSelectorContract).toMatchObject({
			version: "kimi-web-20260821-localpc-v7",
			surface: "kimi.consumer_web",
			launchUrl: "https://www.kimi.com/",
		});
	});

	test("waits for the enabled send action until after the prompt is filled", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://www.kimi.com/",
				conversationUrl: "https://www.kimi.com/chat/kimi-session",
				newConversationLabels: ["新建会话"],
				sendMatchesBeforeFill: 0,
				sendMatches: 1,
			}),
		);

		await expect(port.completeOneTask(createKimiAdapter(port), "Prompt A")).resolves.toBeUndefined();
		expect(port.submitCount).toBe(1);
	});

	test("collects a structured answer, direct citation, and bounded screenshot region", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://www.kimi.com/",
				conversationUrl: "https://www.kimi.com/chat/kimi-session",
				newConversationLabels: ["新建会话"],
				answer: {
					text: "Kimi 回答",
					html: "<article>Kimi 回答</article>",
					citations: [{ url: "https://source.example/kimi", title: "Kimi 来源" }],
				},
			}),
		);
		const adapter = createKimiAdapter(port);
		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({
			answerText: "Kimi 回答",
			webSearchObserved: null,
			webQueries: [],
			citations: [{ url: "https://source.example/kimi", title: "Kimi 来源" }],
			evidenceViewportRect: { x: 200, y: 100, width: 800, height: 500, devicePixelRatio: 1 },
			adapterVersion: "kimi-web-20260821-localpc-v7",
		});
	});

	test("accepts Kimi's exact new-chat query parameter", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://www.kimi.com/?chat_enter_method=new_chat",
				conversationUrl: "https://www.kimi.com/chat/kimi-session",
				newConversationLabels: ["新建会话"],
			}),
		);

		await expect(createKimiAdapter(port).preflight()).resolves.toBeUndefined();
	});

	test("keeps the confirmed conversation when Kimi removes its transient new-chat query", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://www.kimi.com/?chat_enter_method=new_chat",
				conversationUrl: "https://www.kimi.com/chat/kimi-session",
				conversationUrlTimeline: [
					"https://www.kimi.com/chat/kimi-session?chat_enter_method=new_chat",
					"https://www.kimi.com/chat/kimi-session",
				],
				newConversationLabels: ["新建会话"],
			}),
		);
		const adapter = createKimiAdapter(port);

		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({ answerText: "Current answer" });
	});

	test("waits for Kimi to leave the launch route before confirming the durable conversation", async () => {
		const port = new FixtureDomPort(
			createAdapterFixture({
				pageUrl: "https://www.kimi.com/?chat_enter_method=new_chat",
				conversationUrl: "https://www.kimi.com/chat/kimi-session?chat_enter_method=new_chat",
				conversationUrlDelayMs: 2_000,
				newConversationLabels: ["新建会话"],
			}),
		);
		const adapter = createKimiAdapter(port);

		await port.completeOneTask(adapter, "Prompt A");

		await expect(adapter.collectCurrentAnswer()).resolves.toMatchObject({ answerText: "Current answer" });
	});

	test("fails before submission when login, CAPTCHA, or account restriction is visible", async () => {
		for (const [code, override] of [
			["signed_out", { signedOut: true }],
			["captcha", { captcha: true }],
			["account_restricted", { accountRestricted: true }],
		] as const) {
			const port = new FixtureDomPort(
				createAdapterFixture({
					pageUrl: "https://www.kimi.com/",
					conversationUrl: "https://www.kimi.com/chat/kimi-session",
					newConversationLabels: ["新建会话"],
					...override,
				}),
			);
			await expect(createKimiAdapter(port).preflight()).rejects.toMatchObject({ code, stage: "pre_submit" });
			expect(port.submitCount).toBe(0);
		}
	});
});
