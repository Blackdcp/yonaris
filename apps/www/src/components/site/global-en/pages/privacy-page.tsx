import { GlobalEnglishShell } from "../global-english-shell";
import { PrivacyFlow } from "../visuals/visuals";
import { PageHero, PageSection } from "./page-primitives";

export function PrivacyPage() {
	return (
		<GlobalEnglishShell activeKey="privacy">
			<PageHero
				id="hero"
				eyebrow="PRIVACY"
				title="Privacy facts must be verified before collection starts."
				lead="The global diagnostic remains disabled until its public notice and operational data handling are reviewed together."
				visual={<PrivacyFlow />}
			/>
			<PageSection
				id="english-disclosure"
				number="01"
				title="We collect nothing until the privacy boundary is ready."
				body="Diagnostic requests and analytics remain off until a reviewed privacy configuration explicitly enables them."
			>
				<div className="global-en__privacy-state" data-graphic="privacy-state">
					<span>NOTICE</span>
					<b>Pending verified configuration</b>
					<span>SUBMISSION</span>
					<b>Disabled</b>
					<span>ANALYTICS</span>
					<b>Disabled</b>
				</div>
			</PageSection>
			<PageSection
				id="regional-boundaries"
				number="02"
				title="Regional experiences are governed independently."
				body="The Chinese-language experience follows its own regional content, operating, and privacy requirements. Translation is not a substitute for regional review."
			>
				<a className="global-en__text-link" href="/zh">
					Visit the Chinese edition →
				</a>
			</PageSection>
		</GlobalEnglishShell>
	);
}
