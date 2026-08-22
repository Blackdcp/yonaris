import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const FULL_CHANGELOG_RE = /\*\*Full Changelog\*\*:\s*(https:\/\/github\.com\/[^\s]+\/compare\/[^\s]+)/i;

export function extractCompareUrl(body: string | null): {
	cleaned: string;
	compareUrl: string | null;
} {
	if (!body) return { cleaned: "", compareUrl: null };
	const match = body.match(FULL_CHANGELOG_RE);
	if (!match) return { cleaned: body, compareUrl: null };
	const cleaned = body.replace(FULL_CHANGELOG_RE, "").trimEnd();
	return { cleaned, compareUrl: match[1] };
}

const components: Components = {
	h1: ({ children }) => <h3>{children}</h3>,
	h2: ({ children }) => <h3>{children}</h3>,
	h3: ({ children }) => <h4>{children}</h4>,
	p: ({ children }) => <p>{children}</p>,
	a: ({ children, href }) => (
		<a href={href ?? "#"} target="_blank" rel="noopener noreferrer">
			{children}
		</a>
	),
	ul: ({ children }) => <ul>{children}</ul>,
	ol: ({ children }) => <ol>{children}</ol>,
	li: ({ children }) => <li>{children}</li>,
	strong: ({ children }) => <strong>{children}</strong>,
	code: ({ children }) => <code>{children}</code>,
	pre: ({ children }) => <pre>{children}</pre>,
	hr: () => <hr />,
	blockquote: ({ children }) => <blockquote>{children}</blockquote>,
};

export function ReleaseMarkdown({ body }: { body: string }) {
	return (
		<div className="utility-release-markdown">
			<ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
				{body}
			</ReactMarkdown>
		</div>
	);
}
