import type { UiLanguage } from "@workspace/config/language";
import { useRef, useState } from "react";
import { useI18n } from "@/i18n/provider";
import { setUiLanguageFn } from "@/server/ui-language";

export async function switchUiLanguage(uiLanguage: UiLanguage): Promise<void> {
	await setUiLanguageFn({ data: { uiLanguage } });
	window.location.reload();
}

export function LanguageSwitcher({
	className = "",
	onLanguageChange = switchUiLanguage,
}: {
	className?: string;
	onLanguageChange?: (uiLanguage: UiLanguage) => Promise<void>;
}) {
	const { locale, t } = useI18n();
	const [pendingLanguage, setPendingLanguage] = useState<UiLanguage | null>(null);
	const [failure, setFailure] = useState<string | null>(null);
	const englishRadio = useRef<HTMLInputElement>(null);
	const chineseRadio = useRef<HTMLInputElement>(null);

	async function selectLanguage(uiLanguage: UiLanguage) {
		if (uiLanguage === locale || pendingLanguage) return;
		setFailure(null);
		setPendingLanguage(uiLanguage);
		try {
			await onLanguageChange(uiLanguage);
		} catch {
			setFailure(t("language.switcher.failed"));
		} finally {
			setPendingLanguage(null);
		}
	}

	return (
		<div className={`inline-flex flex-col items-start gap-1 ${className}`}>
			<fieldset
				disabled={pendingLanguage !== null}
				className="inline-flex items-center rounded-md border bg-background p-0.5 disabled:opacity-60"
			>
				<legend className="sr-only">{t("language.switcher.label")}</legend>
				{(["en", "zh-CN"] as const).map((uiLanguage) => (
					<label
						key={uiLanguage}
						data-language={uiLanguage}
						className={`relative cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-1 ${
							locale === uiLanguage
								? "bg-secondary text-secondary-foreground shadow-xs"
								: "hover:bg-accent hover:text-accent-foreground"
						}`}
					>
						<input
							ref={uiLanguage === "en" ? englishRadio : chineseRadio}
							type="radio"
							name="ui-language"
							value={uiLanguage}
							checked={locale === uiLanguage}
							onChange={() => void selectLanguage(uiLanguage)}
							onKeyDown={(event) => {
								if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
								event.preventDefault();
								const nextLanguage = uiLanguage === "en" ? "zh-CN" : "en";
								(uiLanguage === "en" ? chineseRadio : englishRadio).current?.focus();
								void selectLanguage(nextLanguage);
							}}
							className="sr-only"
						/>
						{uiLanguage === "en" ? t("language.switcher.english") : t("language.switcher.chinese")}
					</label>
				))}
			</fieldset>
			<p role="status" aria-live="polite" className="sr-only">
				{pendingLanguage ? t("language.switcher.switching") : ""}
			</p>
			{failure && (
				<p role="alert" className="text-xs text-destructive">
					{failure}
				</p>
			)}
		</div>
	);
}
