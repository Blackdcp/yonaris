import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { LocalizedRawDetail } from "@/components/localized-raw-detail";
import { I18nProvider } from "@/i18n/provider";

const RAW_SENTINEL = 'ERR <provider>  & scope\n{"id":  "raw-01"}';

const meta = {
	title: "Components/LocalizedRawDetail",
	component: LocalizedRawDetail,
} satisfies Meta<typeof LocalizedRawDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BilingualVisibleContract: Story = {
	render: () => (
		<div className="space-y-4">
			<section data-testid="english-detail">
				<I18nProvider locale="en">
					<LocalizedRawDetail labelId="admin.raw.errorDetails" detail={RAW_SENTINEL} />
				</I18nProvider>
			</section>
			<section data-testid="chinese-detail">
				<I18nProvider locale="zh-CN">
					<LocalizedRawDetail labelId="admin.raw.errorDetails" detail={RAW_SENTINEL} variant="destructive" />
				</I18nProvider>
			</section>
			<section data-testid="execution-detail">
				<I18nProvider locale="en">
					<LocalizedRawDetail labelId="admin.raw.executionDetails" detail={RAW_SENTINEL} variant="log" />
				</I18nProvider>
			</section>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		for (const [testId, label] of [
			["english-detail", "Raw error details"],
			["chinese-detail", "原始错误详情"],
			["execution-detail", "Raw execution details"],
		] as const) {
			const sectionElement = canvas.getByTestId(testId);
			const section = within(sectionElement);
			const labelElement = section.getByText(label);
			const wrapper = sectionElement.querySelector('[data-slot="localized-raw-detail"]');
			const value = sectionElement.querySelector('[data-slot="localized-raw-detail-value"]');

			await expect(labelElement).toBeVisible();
			expect(wrapper).not.toBeNull();
			expect(value).not.toBeNull();
			if (!wrapper || !value) throw new Error("LocalizedRawDetail contract is missing");
			await expect(value).toBeVisible();
			expect(value.textContent).toBe(RAW_SENTINEL);
			expect(wrapper.getAttribute("aria-labelledby")).toBe(labelElement.id);
		}
	},
};
