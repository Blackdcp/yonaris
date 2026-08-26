import type { UiLanguage } from "@workspace/config/language";
import { Button } from "@workspace/ui/components/button";
import { useState } from "react";
import { useI18n } from "@/i18n/provider";
import { setUiLanguageFn } from "@/server/ui-language";

export async function switchUiLanguage(uiLanguage: UiLanguage): Promise<void> {
	await setUiLanguageFn({ data: { uiLanguage } });
	window.location.reload();
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
	const { locale, t } = useI18n();
	const [pendingLanguage, setPendingLanguage] = useState<UiLanguage | null>(null);

	async function selectLanguage(uiLanguage: UiLanguage) {
		if (uiLanguage === locale || pendingLanguage) return;
		setPendingLanguage(uiLanguage);
		try {
			await switchUiLanguage(uiLanguage);
		} finally {
			setPendingLanguage(null);
		}
	}

	return (
		<div
			role="radiogroup"
			aria-label={t("language.switcher.label")}
			className={`inline-flex items-center rounded-md border bg-background p-0.5 ${className}`}
		>
			<Button
				type="button"
				variant={locale === "en" ? "secondary" : "ghost"}
				size="sm"
				data-language="en"
				aria-checked={locale === "en"}
				role="radio"
				disabled={pendingLanguage !== null}
				onClick={() => void selectLanguage("en")}
			>
				{t("language.switcher.english")}
			</Button>
			<Button
				type="button"
				variant={locale === "zh-CN" ? "secondary" : "ghost"}
				size="sm"
				data-language="zh-CN"
				aria-checked={locale === "zh-CN"}
				role="radio"
				disabled={pendingLanguage !== null}
				onClick={() => void selectLanguage("zh-CN")}
			>
				{t("language.switcher.chinese")}
			</Button>
		</div>
	);
}
