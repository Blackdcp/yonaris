import { useState } from "react";
import type { CompanyContent, CompanyReaderId } from "@/content/site/company";
import type { DeepReadonly, Locale } from "@/content/site/types";

interface CompanyReaderFieldProps {
	locale: Locale;
	content: DeepReadonly<CompanyContent["marketShift"]>;
}

interface CompanySemanticTextProps {
	locale: Locale;
	text: string;
	phrase: string;
}

export function CompanySemanticText({ locale, text, phrase }: CompanySemanticTextProps): React.ReactNode {
	if (locale !== "zh") return text;
	const phraseIndex = text.indexOf(phrase);
	if (phraseIndex < 0) return text;

	return (
		<>
			{text.slice(0, phraseIndex)}
			<span className="company-semantic-unit">{phrase}</span>
			{text.slice(phraseIndex + phrase.length)}
		</>
	);
}

export function CompanyReaderField({ locale, content }: CompanyReaderFieldProps): React.ReactNode {
	const [activeId, setActiveId] = useState<CompanyReaderId>("human");
	const activeReader = content.readers.find(({ id }) => id === activeId) ?? content.readers[0];

	return (
		<section className="company-reader-field" aria-labelledby="company-reader-title" data-locale={locale}>
			<div className="company-reader-field__inner">
				<header className="company-reader-field__heading">
					<p className="company-kicker">{content.eyebrow}</p>
					<h2 id="company-reader-title">{content.title}</h2>
					<p className="company-reader-field__summary">{content.summary}</p>
				</header>

				<fieldset className="company-reader-field__controls" aria-label={content.groupLabel}>
					{content.readers.map((reader, index) => (
						<button
							key={reader.id}
							type="button"
							className="company-reader-field__control company-ink-focus"
							aria-pressed={reader.id === activeId}
							onClick={(event) => {
								setActiveId(reader.id);
								event.currentTarget.focus();
							}}
						>
							<span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
							{reader.label}
						</button>
					))}
				</fieldset>

				<div className="company-reader-field__hinge-track" aria-hidden="true">
					<span data-company-hinge data-reader={activeId} />
				</div>

				<div className="company-reader-field__descriptions">
					{content.readers.map((reader, index) => (
						<section key={reader.id} className="company-reader-field__description" data-reader-description={reader.id}>
							<p>{String(index + 1).padStart(2, "0")}</p>
							<h3>{reader.label}</h3>
							<p>{reader.summary}</p>
						</section>
					))}
				</div>

				<div className="company-reader-field__annotation" aria-live="polite" aria-atomic="true">
					<p className="company-reader-field__annotation-label">{content.annotationLabel}</p>
					<p data-company-reader-annotation>
						<CompanySemanticText locale={locale} text={activeReader.annotation} phrase="测试" />
					</p>
				</div>
			</div>
		</section>
	);
}
