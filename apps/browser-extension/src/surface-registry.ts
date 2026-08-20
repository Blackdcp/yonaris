import {
	type BrowserExtensionCaptureRoute,
	type BrowserExtensionSurface,
	browserExtensionSurfaceDefinition,
} from "@workspace/lib/browser-extension-surfaces";

export type ExtensionSurfaceDefinition = {
	surface: BrowserExtensionSurface;
	label: string;
	launchUrl: string;
	captureRoute: BrowserExtensionCaptureRoute;
	adapterVersion: string;
	contentScriptMatches: readonly string[];
	approvedUrl: (url: URL) => boolean;
};

const LOCAL_SURFACE_CONFIG: Record<
	BrowserExtensionSurface,
	{ contentScriptMatches: readonly string[]; approvedHostname: (hostname: string) => boolean }
> = {
	"doubao.consumer_web": {
		contentScriptMatches: ["https://doubao.com/chat/*", "https://www.doubao.com/chat/*"],
		approvedHostname: (hostname) => hostname === "doubao.com" || hostname.endsWith(".doubao.com"),
	},
	"deepseek.consumer_web": {
		contentScriptMatches: ["https://chat.deepseek.com/*"],
		approvedHostname: (hostname) => hostname === "chat.deepseek.com",
	},
	"qwen.consumer_web": {
		contentScriptMatches: ["https://www.qianwen.com/*"],
		approvedHostname: (hostname) => hostname === "www.qianwen.com",
	},
	"kimi.consumer_web": {
		contentScriptMatches: ["https://www.kimi.com/*"],
		approvedHostname: (hostname) => hostname === "www.kimi.com",
	},
	"wenxin.consumer_web": {
		contentScriptMatches: ["https://yiyan.baidu.com/*"],
		approvedHostname: (hostname) => hostname === "yiyan.baidu.com",
	},
	"yuanbao.consumer_web": {
		contentScriptMatches: ["https://yuanbao.tencent.com/*"],
		approvedHostname: (hostname) => hostname === "yuanbao.tencent.com",
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
	};
}
