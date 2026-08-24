import type { ReactNode } from "react";
import type { GlobalEnglishPageKey } from "@/editions/global-en/edition";
import { GlobalEnglishFooter } from "./global-english-footer";
import { GlobalEnglishHeader } from "./global-english-header";

export function GlobalEnglishShell({ activeKey, children }: { activeKey?: GlobalEnglishPageKey; children: ReactNode }) {
	return (
		<div className="global-en" data-edition="global-en" lang="en">
			<GlobalEnglishHeader activeKey={activeKey} />
			<main id="main-content">{children}</main>
			<GlobalEnglishFooter />
		</div>
	);
}
