import {
	BROWSER_EXTENSION_SURFACES,
	type BrowserExtensionCaptureRoute,
	type BrowserExtensionSurface,
	browserExtensionSurfaceDefinition,
} from "@workspace/lib/browser-extension-surfaces";
import type { ConsumerDomPort, ConsumerWebAdapter, SelectorContract } from "./adapters/contracts";
import { createDeepSeekAdapter, deepSeekSelectorContract } from "./adapters/deepseek";
import { createDoubaoAdapter, doubaoSelectorContract } from "./adapters/doubao";
import { createKimiAdapter, kimiSelectorContract } from "./adapters/kimi";
import { createQwenAdapter, qwenSelectorContract } from "./adapters/qwen";
import { createWenxinAdapter, wenxinSelectorContract } from "./adapters/wenxin";
import { createYuanbaoAdapter, yuanbaoSelectorContract } from "./adapters/yuanbao";
import { createZhipuAdapter, zhipuSelectorContract } from "./adapters/zhipu";

export type ExtensionSurfaceDefinition = {
	surface: BrowserExtensionSurface;
	label: string;
	launchUrl: string;
	captureRoute: BrowserExtensionCaptureRoute;
	adapterVersion: string;
	contentScriptMatches: readonly string[];
	approvedUrl: (url: URL) => boolean;
	contract: SelectorContract;
	createAdapter: (port: ConsumerDomPort) => ConsumerWebAdapter;
};

const LOCAL_SURFACE_CONFIG: Record<
	BrowserExtensionSurface,
	{
		contentScriptMatches: readonly string[];
		approvedHostname: (hostname: string) => boolean;
		contract: SelectorContract;
		createAdapter: (port: ConsumerDomPort) => ConsumerWebAdapter;
	}
> = {
	"doubao.consumer_web": {
		contentScriptMatches: ["https://doubao.com/chat/*", "https://www.doubao.com/chat/*"],
		approvedHostname: (hostname) => hostname === "doubao.com" || hostname.endsWith(".doubao.com"),
		contract: doubaoSelectorContract,
		createAdapter: createDoubaoAdapter,
	},
	"deepseek.consumer_web": {
		contentScriptMatches: ["https://chat.deepseek.com/*"],
		approvedHostname: (hostname) => hostname === "chat.deepseek.com",
		contract: deepSeekSelectorContract,
		createAdapter: createDeepSeekAdapter,
	},
	"qwen.consumer_web": {
		contentScriptMatches: ["https://qianwen.com/*", "https://www.qianwen.com/*"],
		approvedHostname: (hostname) => hostname === "qianwen.com" || hostname === "www.qianwen.com",
		contract: qwenSelectorContract,
		createAdapter: createQwenAdapter,
	},
	"kimi.consumer_web": {
		contentScriptMatches: ["https://www.kimi.com/*"],
		approvedHostname: (hostname) => hostname === "www.kimi.com",
		contract: kimiSelectorContract,
		createAdapter: createKimiAdapter,
	},
	"wenxin.consumer_web": {
		contentScriptMatches: ["https://wenxin.baidu.com/*"],
		approvedHostname: (hostname) => hostname === "wenxin.baidu.com",
		contract: wenxinSelectorContract,
		createAdapter: createWenxinAdapter,
	},
	"yuanbao.consumer_web": {
		contentScriptMatches: ["https://yuanbao.tencent.com/*"],
		approvedHostname: (hostname) => hostname === "yuanbao.tencent.com",
		contract: yuanbaoSelectorContract,
		createAdapter: createYuanbaoAdapter,
	},
	"zhipu.consumer_web": {
		contentScriptMatches: ["https://chatglm.cn/*"],
		approvedHostname: (hostname) => hostname === "chatglm.cn",
		contract: zhipuSelectorContract,
		createAdapter: createZhipuAdapter,
	},
};

export function extensionSurfaceDefinition(surface: BrowserExtensionSurface): ExtensionSurfaceDefinition {
	const shared = browserExtensionSurfaceDefinition(surface);
	const local = LOCAL_SURFACE_CONFIG[surface];
	if (!local) throw new Error(`Browser extension surface ${surface} is not supported`);
	return {
		surface,
		label: shared.label,
		launchUrl: shared.launchUrl,
		captureRoute: shared.captureRoute,
		adapterVersion: shared.adapterVersion,
		contentScriptMatches: local.contentScriptMatches,
		approvedUrl: (url) =>
			url.protocol === "https:" && url.username === "" && url.password === "" && local.approvedHostname(url.hostname),
		contract: local.contract,
		createAdapter: local.createAdapter,
	};
}

export function extensionSurfaceForUrl(url: URL): ExtensionSurfaceDefinition {
	const match = BROWSER_EXTENSION_SURFACES.map(extensionSurfaceDefinition).find((definition) =>
		definition.approvedUrl(url),
	);
	if (!match) throw new Error("Browser adapter is not approved for this URL");
	return match;
}
