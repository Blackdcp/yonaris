import { parseHTML } from "linkedom";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { BrowserExtensionReadiness, BrowserExtensionReadinessStatus } from "./contracts";
import {
	type QualificationReadinessPublisher,
	type QualificationReadinessStore,
	type QualificationTabsGateway,
	qualifyActiveDoubaoTab,
	qualifyAndRecordActiveDoubaoTab,
	qualifyAndRecordActiveSurfaceTab,
} from "./surface-qualification-client";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.resetModules();
});

describe("Doubao read-only qualification client", () => {
	test("sends only the read-only inspection command to one active Doubao tab", async () => {
		const commands: unknown[] = [];
		const gateway: QualificationTabsGateway = {
			queryActive: async () => [{ id: 42, url: "https://www.doubao.com/chat/123456" }],
			sendMessage: async (_tabId, command) => {
				commands.push(command);
				return {
					ok: true,
					value: { status: "qualified", answerCount: 3, queryCount: 2, citationCount: 8 },
				};
			},
		};

		await expect(qualifyActiveDoubaoTab(gateway)).resolves.toEqual({
			status: "qualified",
			answerCount: 3,
			queryCount: 2,
			citationCount: 8,
		});
		expect(commands).toEqual([{ kind: "yonaris_adapter", action: "inspect_search_evidence" }]);
	});

	test.each([
		"https://portal.yonaris.com/app",
		"https://www.doubao.com/",
		"http://www.doubao.com/chat/123456",
		"https://user:pass@www.doubao.com/chat/123456",
		"https://www.doubao.com.evil.test/chat/123456",
	] as const)("refuses a non-approved active tab: %s", async (url) => {
		const gateway: QualificationTabsGateway = {
			queryActive: async () => [{ id: 42, url }],
			sendMessage: async () => {
				throw new Error("must not inspect");
			},
		};

		await expect(qualifyActiveDoubaoTab(gateway)).rejects.toThrow(/Doubao conversation tab/i);
	});

	test("rejects a qualified response that did not exercise a citation selector", async () => {
		const gateway: QualificationTabsGateway = {
			queryActive: async () => [{ id: 42, url: "https://www.doubao.com/chat/123456" }],
			sendMessage: async () => ({
				ok: true,
				value: { status: "qualified", answerCount: 1, queryCount: 1, citationCount: 0 },
			}),
		};

		await expect(qualifyActiveDoubaoTab(gateway)).rejects.toThrow(/inconsistent counts/i);
	});

	test("revokes stale readiness before inspection and records exact v8 only after qualification", async () => {
		const writes: BrowserExtensionReadiness[] = [];
		const store = qualificationStore(writes);
		const gateway: QualificationTabsGateway = {
			queryActive: async () => [{ id: 42, url: "https://www.doubao.com/chat/123456" }],
			sendMessage: async () => ({
				ok: true,
				value: { status: "qualified", answerCount: 1, queryCount: 2, citationCount: 8 },
			}),
		};

		await expect(qualifyAndRecordActiveDoubaoTab(store, gateway, confirmedPublisher())).resolves.toMatchObject({
			status: "qualified",
		});
		expect(writes).toEqual([
			{
				"doubao.consumer_web": {
					status: "unavailable",
					adapterVersion: "doubao-web-20260821-localpc-v11",
					activeConcurrency: 0,
				},
				"deepseek.consumer_web": {
					status: "unavailable",
					adapterVersion: "deepseek-web-20260814-uat1",
					activeConcurrency: 0,
				},
			},
			{
				"doubao.consumer_web": {
					status: "ready",
					adapterVersion: "doubao-web-20260821-localpc-v11",
					activeConcurrency: 0,
				},
				"deepseek.consumer_web": {
					status: "unavailable",
					adapterVersion: "deepseek-web-20260814-uat1",
					activeConcurrency: 0,
				},
			},
		]);
	});

	test("leaves Doubao unavailable when the live DOM is inconclusive", async () => {
		const writes: BrowserExtensionReadiness[] = [];
		const gateway: QualificationTabsGateway = {
			queryActive: async () => [{ id: 42, url: "https://www.doubao.com/chat/123456" }],
			sendMessage: async () => ({
				ok: true,
				value: { status: "no_search_evidence", answerCount: 1, queryCount: 0, citationCount: 0 },
			}),
		};

		await expect(
			qualifyAndRecordActiveDoubaoTab(qualificationStore(writes), gateway, confirmedPublisher()),
		).resolves.toMatchObject({
			status: "no_search_evidence",
		});
		expect(writes).toEqual([
			expect.objectContaining({
				"doubao.consumer_web": {
					status: "unavailable",
					adapterVersion: "doubao-web-20260821-localpc-v11",
					activeConcurrency: 0,
				},
			}),
		]);
	});

	test("revokes an existing ready state when a later qualification drifts", async () => {
		const writes: BrowserExtensionReadiness[] = [];
		const gateway: QualificationTabsGateway = {
			queryActive: async () => [{ id: 42, url: "https://www.doubao.com/chat/123456" }],
			sendMessage: async () => ({
				ok: true,
				value: { status: "page_drift", answerCount: 1, queryCount: 0, citationCount: 0 },
			}),
		};

		await expect(
			qualifyAndRecordActiveDoubaoTab(qualificationStore(writes, "ready"), gateway, confirmedPublisher()),
		).resolves.toMatchObject({ status: "page_drift" });
		expect(writes.at(-1)?.["doubao.consumer_web"]).toEqual({
			status: "unavailable",
			adapterVersion: "doubao-web-20260821-localpc-v11",
			activeConcurrency: 0,
		});
	});

	test.each([
		["signed-out wall", '<input type="password">', "signed_out", "Consumer page reported signed_out"],
		[
			"CAPTCHA",
			'<iframe src="https://captcha.example/challenge"></iframe>',
			"captcha",
			"Consumer page reported captcha",
		],
		[
			"rate limit",
			'<div class="rate-limit">Try again later</div>',
			"rate_limited",
			"Consumer page reported rate_limited",
		],
		[
			"account restriction",
			"<div>账号已被封禁</div>",
			"account_restricted",
			"Consumer account is explicitly restricted",
		],
	] as const)(
		"surfaces the safe adapter reason and does not record readiness for a valid old answer behind a visible %s",
		async (_label, blocker, code, expectedMessage) => {
			const harness = await installContentQualificationHarness(blocker);
			const writes: BrowserExtensionReadiness[] = [];

			await expect(
				qualifyAndRecordActiveDoubaoTab(qualificationStore(writes), harness.gateway, confirmedPublisher()),
			).rejects.toThrow(expectedMessage);
			expect(harness.response()).toMatchObject({
				ok: false,
				error: { code, stage: "pre_submit" },
			});
			expect(writes.at(-1)?.["doubao.consumer_web"]).toEqual({
				status: "unavailable",
				adapterVersion: "doubao-web-20260821-localpc-v11",
				activeConcurrency: 0,
			});
			expect(harness.clickCount()).toBe(0);
		},
	);

	test("confirms unavailable with the Portal before inspecting the active DOM", async () => {
		const events: string[] = [];
		const store = qualificationStore([], "ready", (status) => events.push(`local:${status}`));
		const publisher: QualificationReadinessPublisher = {
			confirmReadiness: async (readiness) => {
				events.push(`portal:${readiness["doubao.consumer_web"]?.status}`);
			},
		};
		const gateway: QualificationTabsGateway = {
			queryActive: async () => {
				events.push("dom:query");
				return [{ id: 42, url: "https://www.doubao.com/chat/123456" }];
			},
			sendMessage: async () => ({
				ok: true,
				value: { status: "no_search_evidence", answerCount: 1, queryCount: 0, citationCount: 0 },
			}),
		};

		await qualifyAndRecordActiveDoubaoTab(store, gateway, publisher);

		expect(events).toEqual(["local:unavailable", "portal:unavailable", "dom:query"]);
	});

	test("does not inspect the DOM when paired-device unavailability cannot be confirmed", async () => {
		const writes: BrowserExtensionReadiness[] = [];
		let queryCount = 0;
		const gateway: QualificationTabsGateway = {
			queryActive: async () => {
				queryCount += 1;
				return [{ id: 42, url: "https://www.doubao.com/chat/123456" }];
			},
			sendMessage: async () => {
				throw new Error("must not inspect");
			},
		};
		const publisher: QualificationReadinessPublisher = {
			confirmReadiness: async () => {
				throw new Error("Portal unavailable");
			},
		};

		await expect(
			qualifyAndRecordActiveDoubaoTab(qualificationStore(writes, "ready"), gateway, publisher),
		).rejects.toThrow(/Portal unavailable/i);
		expect(queryCount).toBe(0);
		expect(writes.at(-1)?.["doubao.consumer_web"]?.status).toBe("unavailable");
	});

	test("durably records a qualified page before publishing ready to the Portal", async () => {
		const events: string[] = [];
		const store = qualificationStore([], "unavailable", (status) => events.push(`local:${status}`));
		const publisher: QualificationReadinessPublisher = {
			confirmReadiness: async (readiness) => {
				events.push(`portal:${readiness["doubao.consumer_web"]?.status}`);
			},
		};
		const gateway: QualificationTabsGateway = {
			queryActive: async () => {
				events.push("dom:query");
				return [{ id: 42, url: "https://www.doubao.com/chat/123456" }];
			},
			sendMessage: async () => {
				events.push("dom:inspect");
				return {
					ok: true,
					value: { status: "qualified", answerCount: 1, queryCount: 1, citationCount: 1 },
				};
			},
		};

		await qualifyAndRecordActiveDoubaoTab(store, gateway, publisher);

		expect(events).toEqual([
			"local:unavailable",
			"portal:unavailable",
			"dom:query",
			"dom:inspect",
			"local:ready",
			"portal:ready",
		]);
	});

	test("serializes concurrent checks so a later failure cannot be overwritten by an older success", async () => {
		const writes: BrowserExtensionReadiness[] = [];
		const firstResponse = deferred<unknown>();
		let inspectionCount = 0;
		const gateway: QualificationTabsGateway = {
			queryActive: async () => [{ id: 42, url: "https://www.doubao.com/chat/123456" }],
			sendMessage: async () => {
				inspectionCount += 1;
				if (inspectionCount === 1) return firstResponse.promise;
				return {
					ok: true,
					value: { status: "page_drift", answerCount: 1, queryCount: 0, citationCount: 0 },
				};
			},
		};
		const store = qualificationStore(writes, "ready");

		const older = qualifyAndRecordActiveDoubaoTab(store, gateway, confirmedPublisher());
		await vi.waitFor(() => expect(inspectionCount).toBe(1));
		const newer = qualifyAndRecordActiveDoubaoTab(store, gateway, confirmedPublisher());
		await Promise.resolve();
		expect(inspectionCount).toBe(1);

		firstResponse.resolve({
			ok: true,
			value: { status: "qualified", answerCount: 1, queryCount: 1, citationCount: 1 },
		});
		await expect(older).resolves.toMatchObject({ status: "qualified" });
		await expect(newer).resolves.toMatchObject({ status: "page_drift" });
		expect(writes.at(-1)?.["doubao.consumer_web"]?.status).toBe("unavailable");
	});

	test("keeps local readiness unavailable when the ready heartbeat is not confirmed", async () => {
		const writes: BrowserExtensionReadiness[] = [];
		const publisher: QualificationReadinessPublisher = {
			confirmReadiness: async (readiness) => {
				if (readiness["doubao.consumer_web"]?.status === "ready") throw new Error("Portal unavailable");
			},
		};
		const gateway: QualificationTabsGateway = {
			queryActive: async () => [{ id: 42, url: "https://www.doubao.com/chat/123456" }],
			sendMessage: async () => ({
				ok: true,
				value: { status: "qualified", answerCount: 1, queryCount: 1, citationCount: 1 },
			}),
		};

		await expect(
			qualifyAndRecordActiveDoubaoTab(qualificationStore(writes, "ready"), gateway, publisher),
		).rejects.toThrow(/Portal unavailable/i);
		expect(writes.at(-1)?.["doubao.consumer_web"]?.status).toBe("unavailable");
	});
});

describe("registry-driven surface qualification", () => {
	test("uses read-only preflight and records the detected non-Doubao surface as ready", async () => {
		const writes: BrowserExtensionReadiness[] = [];
		const commands: unknown[] = [];
		const store: QualificationReadinessStore = {
			loadSurfaceReadiness: async () => ({
				"qwen.consumer_web": {
					status: "unavailable",
					adapterVersion: "qwen-web-20260821-localpc-v5",
					activeConcurrency: 0,
				},
			}),
			saveSurfaceReadiness: async (readiness) => {
				writes.push(readiness);
			},
		};
		const gateway: QualificationTabsGateway = {
			queryActive: async () => [{ id: 42, url: "https://qianwen.com/" }],
			sendMessage: async (_tabId, command) => {
				commands.push(command);
				return { ok: true };
			},
		};

		await expect(qualifyAndRecordActiveSurfaceTab(store, gateway, confirmedPublisher())).resolves.toEqual({
			surface: "qwen.consumer_web",
			label: "Qwen",
			status: "ready",
			answerCount: 0,
			queryCount: 0,
			citationCount: 0,
		});
		expect(commands).toEqual([{ kind: "yonaris_adapter", action: "preflight" }]);
		expect(writes.map((value) => value["qwen.consumer_web"]?.status)).toEqual(["unavailable", "ready"]);
	});

	test("rejects an unsupported active tab before changing readiness", async () => {
		const writes: BrowserExtensionReadiness[] = [];
		const store: QualificationReadinessStore = {
			loadSurfaceReadiness: async () => ({}),
			saveSurfaceReadiness: async (readiness) => {
				writes.push(readiness);
			},
		};
		const gateway: QualificationTabsGateway = {
			queryActive: async () => [{ id: 42, url: "https://example.com/" }],
			sendMessage: async () => {
				throw new Error("must not inspect");
			},
		};

		await expect(qualifyAndRecordActiveSurfaceTab(store, gateway, confirmedPublisher())).rejects.toThrow(
			/supported domestic AI page/i,
		);
		expect(writes).toHaveLength(0);
	});
});

function qualificationStore(
	writes: BrowserExtensionReadiness[],
	doubaoStatus: "ready" | "unavailable" = "unavailable",
	onSave?: (status: BrowserExtensionReadinessStatus) => void,
): QualificationReadinessStore {
	return {
		loadSurfaceReadiness: async () => ({
			"doubao.consumer_web": {
				status: doubaoStatus,
				adapterVersion: "doubao-web-20260821-localpc-v11",
				activeConcurrency: 0,
			},
			"deepseek.consumer_web": {
				status: "unavailable",
				adapterVersion: "deepseek-web-20260814-uat1",
				activeConcurrency: 0,
			},
		}),
		saveSurfaceReadiness: async (readiness) => {
			writes.push(readiness);
			const status = readiness["doubao.consumer_web"]?.status;
			if (status) onSave?.(status);
		},
	};
}

function confirmedPublisher(): QualificationReadinessPublisher {
	return { confirmReadiness: async () => undefined };
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

type ContentMessageListener = (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean;

async function installContentQualificationHarness(blocker: string): Promise<{
	gateway: QualificationTabsGateway;
	response(): unknown;
	clickCount(): number;
}> {
	vi.resetModules();
	const { document, window } = parseHTML(`<!doctype html><html><body>
		<div id="flow_chat_sidebar"><button class="nav-link-IkIer0">新对话</button></div>
		<div class="tiptap ProseMirror" contenteditable="true" role="textbox"></div>
		<button id="flow-end-msg-send">Send</button>
		<div data-message-id="old-answer" class="relative grid w-full">
			<div data-plugin-identifier="search_query_result_block">
				搜索 1 个关键词，参考 1 篇资料
				<div class="mb-8 text-sm">“qualification query”</div>
				<a data-thinking-box-tool-call="true" href="https://source.example/report">1. Source</a>
			</div>
		</div>
		<button aria-label="朗读">Read answer</button>
		${blocker}
	</body></html>`);
	let clicks = 0;
	for (const element of document.querySelectorAll("#flow-end-msg-send,.nav-link-IkIer0")) {
		element.addEventListener("click", () => {
			clicks += 1;
		});
	}
	installVisibleDomGlobals(window);
	vi.stubGlobal("document", document);
	vi.stubGlobal("location", { hostname: "www.doubao.com", href: "https://www.doubao.com/chat/123456" });
	let listener: ContentMessageListener | null = null;
	vi.stubGlobal("chrome", {
		runtime: {
			onMessage: {
				addListener: (candidate: ContentMessageListener) => {
					listener = candidate;
				},
			},
		},
	});
	await import("./adapters/content-entry");
	if (!listener) throw new Error("Content listener was not registered");
	let latestResponse: unknown;
	const gateway: QualificationTabsGateway = {
		queryActive: async () => [{ id: 42, url: "https://www.doubao.com/chat/123456" }],
		sendMessage: async (_tabId, command) =>
			new Promise((resolve) => {
				listener?.(command, {}, (response) => {
					latestResponse = response;
					resolve(response);
				});
			}),
	};
	return { gateway, response: () => latestResponse, clickCount: () => clicks };
}

function installVisibleDomGlobals(window: ReturnType<typeof parseHTML>["window"]): void {
	vi.stubGlobal("DOMParser", window.DOMParser);
	vi.stubGlobal("HTMLElement", window.HTMLElement);
	vi.stubGlobal("HTMLAnchorElement", window.HTMLAnchorElement);
	vi.stubGlobal("HTMLInputElement", window.HTMLInputElement);
	vi.stubGlobal("HTMLTextAreaElement", window.HTMLTextAreaElement);
	vi.stubGlobal("SVGElement", window.SVGElement);
	vi.stubGlobal("getComputedStyle", () => ({
		display: "block",
		visibility: "visible",
		opacity: "1",
		position: "static",
		left: "auto",
		right: "auto",
		top: "auto",
		bottom: "auto",
		transform: "none",
		translate: "none",
	}));
	window.HTMLElement.prototype.getBoundingClientRect = () =>
		({ width: 100, height: 20, top: 0, bottom: 20, left: 0, right: 100 }) as DOMRect;
}
