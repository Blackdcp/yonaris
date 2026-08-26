import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n/provider";
import {
	BrowserRunnerExtensionInstall,
	parseBrowserExtensionPackageMetadata,
} from "./browser-runner-extension-install";

const metadata = {
	fileName: "yonaris-browser-extension.zip",
	sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
	version: "0.1.0",
} as const;

describe("BrowserRunnerExtensionInstall", () => {
	it("keeps download disabled until matching package metadata is available", () => {
		const markup = renderToStaticMarkup(
			<I18nProvider locale="en">
				<BrowserRunnerExtensionInstall />
			</I18nProvider>,
		);

		expect(markup).not.toContain('href="/downloads/yonaris-browser-extension.zip"');
		expect(markup).toContain("disabled");
		expect(markup).toContain("Loading package digest");
	});

	it("renders the same-origin reviewed package, digest and Windows/macOS Chrome installation flow", () => {
		const markup = renderToStaticMarkup(
			<I18nProvider locale="en">
				<BrowserRunnerExtensionInstall metadata={metadata} />
			</I18nProvider>,
		);

		expect(markup).toContain(`href="/downloads/yonaris-browser-extension.zip?sha256=${metadata.sha256}"`);
		expect(markup).toContain('download="yonaris-browser-extension.zip"');
		expect(markup).toContain(metadata.sha256);
		expect(markup).toContain("Windows or macOS");
		expect(markup).toContain("chrome://extensions");
		expect(markup).toContain("Load unpacked");
		expect(markup).toContain("Create pairing code");
		expect(markup).not.toMatch(/deviceToken|ADMIN_API_KEYS|password/i);
	});

	it("localizes install, loading, and integrity copy while preserving package metadata byte-for-byte", () => {
		const pendingMarkup = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<BrowserRunnerExtensionInstall />
			</I18nProvider>,
		);
		const readyMarkup = renderToStaticMarkup(
			<I18nProvider locale="zh-CN">
				<BrowserRunnerExtensionInstall metadata={metadata} />
			</I18nProvider>,
		);

		expect(pendingMarkup).toContain("正在加载扩展包摘要…");
		expect(readyMarkup).toContain("安装已审核的 Chrome 扩展");
		expect(readyMarkup).toContain("下载扩展 ZIP");
		expect(readyMarkup).toContain("Windows 或 macOS");
		expect(readyMarkup).toContain("chrome://extensions");
		expect(readyMarkup).toContain("加载已解压的扩展程序");
		expect(readyMarkup).not.toContain("Load unpacked");
		expect(readyMarkup).toContain(metadata.fileName);
		expect(readyMarkup).toContain(metadata.version);
		expect(readyMarkup).toContain(metadata.sha256);
		expect(readyMarkup).toContain(`href="/downloads/${metadata.fileName}?sha256=${metadata.sha256}"`);
		expect(readyMarkup).not.toContain("Install the reviewed Chrome extension");
	});

	it("fails closed on malformed package metadata", () => {
		expect(() => parseBrowserExtensionPackageMetadata({ ...metadata, sha256: "short" })).toThrow(
			/extension package metadata/i,
		);
		expect(() => parseBrowserExtensionPackageMetadata({ ...metadata, fileName: "other.zip" })).toThrow(
			/extension package metadata/i,
		);
	});
});
