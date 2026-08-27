import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n/provider";
import { LocalizedRawDetail } from "./localized-raw-detail";

describe("LocalizedRawDetail", () => {
	it.each([
		["en", "Raw error details"],
		["zh-CN", "原始错误详情"],
	] as const)("renders a visible %s label without changing raw evidence", (locale, label) => {
		const detail = 'ERR_PROVIDER\n{"scope":"acme/海外","id":"raw-01"}';
		const markup = renderToStaticMarkup(
			<I18nProvider locale={locale}>
				<LocalizedRawDetail labelId="admin.raw.errorDetails" detail={detail} />
			</I18nProvider>,
		);

		expect(markup).toContain('data-slot="localized-raw-detail-label"');
		expect(markup).toContain(label);
		expect(markup).toContain('data-raw-detail="true"');
		expect(markup).toContain('data-slot="localized-raw-detail-value"');
		expect(markup).toMatch(/<section[^>]*aria-labelledby="([^"]+)"[^>]*>[\s\S]*<p id="\1"/u);
		expect(markup.indexOf(label)).toBeLessThan(markup.indexOf('data-raw-detail="true"'));
		expect(markup).not.toContain("hidden");
		expect(markup).not.toContain("aria-hidden");
		expect(markup).toContain(
			"ERR_PROVIDER\n{&quot;scope&quot;:&quot;acme/海外&quot;,&quot;id&quot;:&quot;raw-01&quot;}",
		);
	});
});
