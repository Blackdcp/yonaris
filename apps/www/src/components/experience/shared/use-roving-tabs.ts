import type { ButtonHTMLAttributes, HTMLAttributes, KeyboardEvent } from "react";
import { useId } from "react";

type RovingTabKey = "ArrowLeft" | "ArrowRight" | "Home" | "End";

const ROVING_KEYS = new Set<string>(["ArrowLeft", "ArrowRight", "Home", "End"]);

export function resolveRovingTabIndex(length: number, currentIndex: number, key: RovingTabKey): number {
	if (length <= 0) return -1;
	const normalizedIndex = ((currentIndex % length) + length) % length;
	if (key === "Home") return 0;
	if (key === "End") return length - 1;
	if (key === "ArrowLeft") return (normalizedIndex - 1 + length) % length;
	return (normalizedIndex + 1) % length;
}

export function useRovingTabs<T extends string>(options: {
	items: readonly T[];
	active: T;
	onChange: (next: T) => void;
	idPrefix: string;
}) {
	const { items, active, onChange, idPrefix } = options;
	const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
	const tabId = (item: T) => `${idPrefix}-tab-${instanceId}-${encodeURIComponent(item)}`;
	const panelId = (item: T) => `${idPrefix}-panel-${instanceId}-${encodeURIComponent(item)}`;

	function selectFromKeyboard(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
		if (!ROVING_KEYS.has(event.key)) return;
		event.preventDefault();
		const nextIndex = resolveRovingTabIndex(items.length, currentIndex, event.key as RovingTabKey);
		const next = items[nextIndex];
		if (!next) return;
		onChange(next);
		document.getElementById(tabId(next))?.focus();
	}

	return {
		getTabProps(item: T, index: number): ButtonHTMLAttributes<HTMLButtonElement> {
			return {
				id: tabId(item),
				role: "tab",
				"aria-selected": active === item,
				"aria-controls": panelId(item),
				tabIndex: active === item ? 0 : -1,
				onClick: () => onChange(item),
				onKeyDown: (event) => selectFromKeyboard(event, index),
			};
		},
		getPanelProps(item: T): HTMLAttributes<HTMLElement> {
			return {
				id: panelId(item),
				role: "tabpanel",
				"aria-labelledby": tabId(item),
				hidden: active !== item,
				tabIndex: 0,
			};
		},
	};
}
