import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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
	it("renders the same-origin reviewed package, digest and Windows/macOS Chrome installation flow", () => {
		const markup = renderToStaticMarkup(<BrowserRunnerExtensionInstall metadata={metadata} />);

		expect(markup).toContain('href="/downloads/yonaris-browser-extension.zip"');
		expect(markup).toContain('download="yonaris-browser-extension.zip"');
		expect(markup).toContain(metadata.sha256);
		expect(markup).toContain("Windows or macOS");
		expect(markup).toContain("chrome://extensions");
		expect(markup).toContain("Load unpacked");
		expect(markup).toContain("Create pairing code");
		expect(markup).not.toMatch(/deviceToken|ADMIN_API_KEYS|password/i);
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
