import type { ReactNode } from "react";
import type { GlobalEnglishPageKey } from "@/editions/global-en/edition";
import { GlobalEnglishFooter } from "./global-english-footer";
import { GlobalEnglishHeader } from "./global-english-header";

export function GlobalEnglishShell({ activeKey, children }: { activeKey?: GlobalEnglishPageKey; children: ReactNode }) {
	return (
		<div className="global-en" data-edition="global-en" data-visual-system="global-cinematic" lang="en">
			<GlobalEnglishHeader activeKey={activeKey} />
			<main id="main-content">{children}</main>
			<GlobalEnglishFooter activeKey={activeKey} />
		</div>
	);
}
