import type { ReactNode } from "react";
import type { HumanPageKey } from "@/content/experience/types";
import { Site06Shell } from "../shared/site-06-shell";

export function ChinaShell({
	pageKey,
	children,
	tone = "dark",
}: {
	pageKey: HumanPageKey;
	scene?: string;
	children: ReactNode;
	tone?: "dark" | "paper";
}) {
	return (
		<Site06Shell locale="zh" pageKey={pageKey} tone={tone}>
			{children}
		</Site06Shell>
	);
}
