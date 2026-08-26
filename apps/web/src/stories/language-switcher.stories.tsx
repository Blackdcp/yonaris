import type { Meta, StoryObj } from "@storybook/react";
import type { UiLanguage } from "@workspace/config/language";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { LanguageSwitcher } from "@/components/language-switcher";
import { I18nProvider } from "@/i18n/provider";

type SwitcherHarnessProps = {
	initialLocale?: UiLanguage;
	changeLanguage?: (uiLanguage: UiLanguage) => Promise<void>;
};

function SwitcherHarness({ initialLocale = "en", changeLanguage = async () => {} }: SwitcherHarnessProps) {
	const [locale, setLocale] = useState(initialLocale);

	return (
		<I18nProvider locale={locale}>
			<LanguageSwitcher
				onLanguageChange={async (uiLanguage) => {
					await changeLanguage(uiLanguage);
					setLocale(uiLanguage);
				}}
			/>
		</I18nProvider>
	);
}

const meta = {
	title: "Components/LanguageSwitcher",
	component: LanguageSwitcher,
} satisfies Meta<typeof LanguageSwitcher>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ClickInteraction: Story = {
	render: () => <SwitcherHarness />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const chinese = canvas.getByRole("radio", { name: "简体中文" });

		await userEvent.click(chinese);
		await expect(chinese).toBeChecked();
	},
};

export const KeyboardInteraction: Story = {
	render: () => <SwitcherHarness />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const english = canvas.getByRole("radio", { name: "English" });
		const chinese = canvas.getByRole("radio", { name: "简体中文" });

		english.focus();
		await userEvent.keyboard("{ArrowRight}");
		await expect(chinese).toBeChecked();
	},
};

export const Pending: Story = {
	render: () => <SwitcherHarness changeLanguage={() => new Promise(() => {})} />,
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const english = canvas.getByRole("radio", { name: "English" });
		const chinese = canvas.getByRole("radio", { name: "简体中文" });

		await userEvent.click(chinese);
		await expect(english).toBeDisabled();
		await expect(chinese).toBeDisabled();
		await expect(canvas.getByRole("status")).toHaveTextContent("Switching language…");
	},
};

export const LocalizedFailure: Story = {
	render: () => (
		<SwitcherHarness initialLocale="zh-CN" changeLanguage={async () => Promise.reject(new Error("offline"))} />
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const english = canvas.getByRole("radio", { name: "English" });
		const chinese = canvas.getByRole("radio", { name: "简体中文" });

		await userEvent.click(english);
		await expect(canvas.findByRole("alert")).resolves.toHaveTextContent("语言切换失败，请重试。");
		await expect(chinese).toBeChecked();
		await expect(english).toBeEnabled();
	},
};
