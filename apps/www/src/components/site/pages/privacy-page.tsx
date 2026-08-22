import { getPrivacyContent } from "@/content/site";
import { SiteShell } from "../site-shell";

const CONTACT_EMAIL = "black.dcp@outlook.com";
type PrivacyLanguageContent = ReturnType<typeof getPrivacyContent>["languages"][number];
type PrivacySection = PrivacyLanguageContent["sections"][number];

function DisclosureParagraph({ section, body }: { section: PrivacySection; body: string }) {
	if (section.id !== "contact") return <p>{body}</p>;

	const [before, after = ""] = body.split(CONTACT_EMAIL);
	return (
		<p>
			{before}
			<span className="privacy-contact-address">
				<a className="privacy-paper-focus" href={`mailto:${CONTACT_EMAIL}`}>
					{CONTACT_EMAIL}
				</a>
				{after}
			</span>
		</p>
	);
}

function LanguageDisclosure({ language, sequence }: { language: PrivacyLanguageContent; sequence: string }) {
	return (
		<section
			id={`privacy-${language.id}`}
			lang={language.lang}
			tabIndex={-1}
			className="privacy-language"
			aria-labelledby={`privacy-${language.id}-title`}
		>
			<div className="privacy-language__introduction">
				<p className="privacy-index">{sequence}</p>
				<h2 id={`privacy-${language.id}-title`}>{language.title}</h2>
				<p>{language.introduction}</p>
			</div>

			<div className="privacy-facts">
				{language.sections.map((section, index) => (
					<section
						key={section.id}
						id={`privacy-${language.id}-${section.id}`}
						className="privacy-fact"
						aria-labelledby={`privacy-${language.id}-${section.id}-title`}
					>
						<p className="privacy-fact__index">{String(index + 1).padStart(2, "0")}</p>
						<h3 id={`privacy-${language.id}-${section.id}-title`}>{section.title}</h3>
						<div className="privacy-fact__body">
							{section.body.map((body) => (
								<DisclosureParagraph key={body} section={section} body={body} />
							))}
						</div>
					</section>
				))}

				<a className="privacy-return privacy-paper-focus" href={language.returnPath}>
					<span>{language.returnLabel}</span>
					<span aria-hidden="true">↗</span>
				</a>
			</div>
		</section>
	);
}

export function PrivacyPage() {
	const content = getPrivacyContent();
	const [english, chinese] = content.languages;

	return (
		<SiteShell locale="en" mainClassName="privacy-page">
			<section className="privacy-hero" aria-labelledby="privacy-title">
				<div className="privacy-hero__inner">
					<p className="privacy-kicker">
						Diagnostic request data / <span lang="zh-CN">诊断申请信息</span>
					</p>
					<h1 id="privacy-title">
						Privacy / <span lang="zh-CN">隐私说明</span>
					</h1>
					<p className="privacy-hero__description">{content.meta.description}</p>
					<nav className="privacy-jump" aria-label="Language selection">
						<a href="#privacy-en">
							<span>01</span>
							English
						</a>
						<a href="#privacy-zh" lang="zh-CN">
							<span>02</span>
							中文
						</a>
					</nav>
				</div>
			</section>

			<div className="privacy-document">
				<LanguageDisclosure language={english} sequence="01 / EN" />
				<LanguageDisclosure language={chinese} sequence="02 / 中文" />
			</div>
		</SiteShell>
	);
}
