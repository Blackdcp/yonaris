export const BROWSER_EXTENSION_SURFACE_DEFINITIONS = [
	{
		key: "doubao.consumer_web",
		label: "Doubao",
		captureRoute: "browser_extension.doubao",
		launchUrl: "https://www.doubao.com/chat/",
		adapterVersion: "doubao-web-20260821-localpc-v13",
	},
	{
		key: "deepseek.consumer_web",
		label: "DeepSeek",
		captureRoute: "browser_extension.deepseek",
		launchUrl: "https://chat.deepseek.com/",
		adapterVersion: "deepseek-web-20260822-localpc-v9",
	},
	{
		key: "qwen.consumer_web",
		label: "Qwen",
		captureRoute: "browser_extension.qwen",
		launchUrl: "https://www.qianwen.com/",
		adapterVersion: "qwen-web-20260822-localpc-v10",
	},
	{
		key: "kimi.consumer_web",
		label: "Kimi",
		captureRoute: "browser_extension.kimi",
		launchUrl: "https://www.kimi.com/",
		adapterVersion: "kimi-web-20260823-localpc-v15",
	},
	{
		key: "wenxin.consumer_web",
		label: "Wenxin",
		captureRoute: "browser_extension.wenxin",
		launchUrl: "https://wenxin.baidu.com/",
		adapterVersion: "wenxin-web-20260822-localpc-v12",
	},
	{
		key: "yuanbao.consumer_web",
		label: "Yuanbao",
		captureRoute: "browser_extension.yuanbao",
		launchUrl: "https://yuanbao.tencent.com/",
		adapterVersion: "yuanbao-web-20260824-localpc-v12",
	},
	{
		key: "zhipu.consumer_web",
		label: "Zhipu",
		captureRoute: "browser_extension.zhipu",
		launchUrl: "https://chatglm.cn/",
		adapterVersion: "zhipu-web-20260822-localpc-v5",
	},
] as const;

export type BrowserExtensionSurface = (typeof BROWSER_EXTENSION_SURFACE_DEFINITIONS)[number]["key"];
export type BrowserExtensionCaptureRoute = (typeof BROWSER_EXTENSION_SURFACE_DEFINITIONS)[number]["captureRoute"];
export type BrowserExtensionSurfaceDefinition = (typeof BROWSER_EXTENSION_SURFACE_DEFINITIONS)[number];

export const BROWSER_EXTENSION_SURFACES = [
	BROWSER_EXTENSION_SURFACE_DEFINITIONS[0].key,
	BROWSER_EXTENSION_SURFACE_DEFINITIONS[1].key,
	BROWSER_EXTENSION_SURFACE_DEFINITIONS[2].key,
	BROWSER_EXTENSION_SURFACE_DEFINITIONS[3].key,
	BROWSER_EXTENSION_SURFACE_DEFINITIONS[4].key,
	BROWSER_EXTENSION_SURFACE_DEFINITIONS[5].key,
	BROWSER_EXTENSION_SURFACE_DEFINITIONS[6].key,
] as const;

export function browserExtensionSurfaceDefinition(surface: BrowserExtensionSurface): BrowserExtensionSurfaceDefinition {
	const definition = BROWSER_EXTENSION_SURFACE_DEFINITIONS.find(({ key }) => key === surface);
	if (!definition) throw new Error(`Browser extension surface ${surface} is not supported`);
	return definition;
}

export function browserExtensionCaptureRoute(surface: BrowserExtensionSurface): BrowserExtensionCaptureRoute {
	return browserExtensionSurfaceDefinition(surface).captureRoute;
}

export function mapBrowserExtensionSurfaces<Value>(
	mapValue: (surface: BrowserExtensionSurface) => Value,
): Record<BrowserExtensionSurface, Value> {
	return Object.fromEntries(BROWSER_EXTENSION_SURFACES.map((surface) => [surface, mapValue(surface)])) as Record<
		BrowserExtensionSurface,
		Value
	>;
}
