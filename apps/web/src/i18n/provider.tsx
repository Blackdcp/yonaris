import type { PropsWithChildren } from "react";
import { createContext, useContext, useMemo } from "react";
import type { UiLanguage } from "@workspace/config/language";
import {
	formatDate,
	formatList,
	formatNumber,
	translate,
	type MessageId,
	type MessageValues,
} from "./catalog";

type I18nContextValue = {
	locale: UiLanguage;
	t: (id: MessageId, values?: MessageValues) => string;
	formatDate: (value: Date | number, options?: Intl.DateTimeFormatOptions) => string;
	formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
	formatList: (values: readonly string[], options?: Intl.ListFormatOptions) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ locale, children }: PropsWithChildren<{ locale: UiLanguage }>) {
	const value = useMemo<I18nContextValue>(
		() => ({
			locale,
			t: (id, values) => translate(locale, id, values),
			formatDate: (date, options) => formatDate(locale, date, options),
			formatNumber: (number, options) => formatNumber(locale, number, options),
			formatList: (items, options) => formatList(locale, items, options),
		}),
		[locale],
	);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
	const context = useContext(I18nContext);
	if (context === undefined) throw new Error("useI18n must be used within an I18nProvider");
	return context;
}
