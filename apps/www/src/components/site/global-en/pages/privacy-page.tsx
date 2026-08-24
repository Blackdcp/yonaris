import { GlobalEnglishShell } from "../global-english-shell";
import { PrivacyFlow } from "../visuals/visuals";
import { PageHero, PageSection } from "./page-primitives";

export function PrivacyPage() {
	return (
		<GlobalEnglishShell activeKey="privacy">
			<PageHero
				id="hero"
				eyebrow="PRIVACY"
				title="Know what the request form sends—and why."
				lead="The website sends only the regional contact fields you submit, a locale marker, and a hidden abuse-control field that must remain empty."
				visual={<PrivacyFlow />}
			/>
			<PageSection
				id="english-disclosure"
				number="01"
				title="The request route is live and deliberately narrow."
				body="Global requests include name, work email, and company. China requests include name, phone, and company. We use them to review the request and contact you."
			>
				<div className="global-en__privacy-state" data-graphic="privacy-state">
					<span>NOTICE</span>
					<b>Published on this page</b>
					<span>SUBMISSION</span>
					<b>Server-validated email delivery</b>
					<span>ANALYTICS</span>
					<b>Form values excluded</b>
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
