import { parseHTML } from "linkedom";

const ALLOWED_TAGS = new Set([
	"a",
	"blockquote",
	"br",
	"code",
	"del",
	"div",
	"em",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"hr",
	"li",
	"ol",
	"p",
	"pre",
	"s",
	"strong",
	"table",
	"tbody",
	"td",
	"th",
	"thead",
	"tr",
	"ul",
]);

const DROP_WITH_CONTENT = new Set(["embed", "form", "iframe", "math", "object", "script", "style", "svg"]);
const VOID_TAGS = new Set(["br", "hr"]);

type DomNode = {
	nodeType: number;
	nodeValue: string | null;
	childNodes: ArrayLike<DomNode>;
	tagName?: string;
	getAttribute?: (name: string) => string | null;
};

export type ResponseSnapshotHtmlInput = {
	answerHtml?: string;
	answerText: string;
	channel: string;
	observedAt: string;
	citations: Array<{ url: string; title: string | null; domain: string; citationIndex: number }>;
};

export function sanitizeAnswerHtml(input: string): string {
	const { document } = parseHTML(`<!doctype html><html><head></head><body>${input}</body></html>`);
	return Array.from(document.body.childNodes)
		.map((node) => serializeNode(node as unknown as DomNode))
		.join("");
}

export function renderResponseSnapshotHtml(input: ResponseSnapshotHtmlInput): string {
	const answer = input.answerHtml ? sanitizeAnswerHtml(input.answerHtml) : renderPlainText(input.answerText);
	const citations = [...input.citations]
		.sort((left, right) => left.citationIndex - right.citationIndex)
		.map((citation) => {
			const safeUrl = safeHttpUrl(citation.url);
			const label = citation.title?.trim() || citation.domain;
			return safeUrl
				? `<li><a href="${escapeAttribute(safeUrl)}" rel="noopener noreferrer nofollow">${escapeHtml(label)}</a><span>${escapeHtml(citation.domain)}</span></li>`
				: `<li><span>${escapeHtml(label)}</span><span>${escapeHtml(citation.domain)}</span></li>`;
		})
		.join("");
	return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<title>Yonaris 回答快照</title>
<style>body{box-sizing:border-box;max-width:920px;margin:0 auto;padding:32px;color:#18212f;background:#fff;font:16px/1.7 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}header{padding-bottom:20px;border-bottom:1px solid #dfe5ec;margin-bottom:24px}header p{margin:4px 0;color:#526173;font-size:13px}.answer{overflow-wrap:anywhere}.answer pre{overflow:auto;padding:16px;background:#f6f8fa;border-radius:8px}.answer table{border-collapse:collapse;width:100%}.answer td,.answer th{border:1px solid #dfe5ec;padding:8px;text-align:left}.citations{margin-top:32px;padding-top:20px;border-top:1px solid #dfe5ec}.citations li{margin:8px 0}.citations li span{display:block;color:#69788a;font-size:12px}a{color:#155eef}</style>
</head>
<body>
<header><h1>回答快照</h1><p>AI 渠道：${escapeHtml(input.channel)}</p><p>采集时间：${escapeHtml(input.observedAt)}</p></header>
<main><section class="answer">${answer}</section>${citations ? `<section class="citations"><h2>引用来源</h2><ol>${citations}</ol></section>` : ""}</main>
</body>
</html>
`;
}

function serializeNode(node: DomNode): string {
	if (node.nodeType === 3) return escapeHtml(node.nodeValue ?? "");
	if (node.nodeType !== 1 || !node.tagName) return "";
	const tag = node.tagName.toLowerCase();
	if (DROP_WITH_CONTENT.has(tag)) return "";
	const children = Array.from(node.childNodes)
		.map((child) => serializeNode(child))
		.join("");
	if (!ALLOWED_TAGS.has(tag)) return children;
	if (VOID_TAGS.has(tag)) return `<${tag}>`;
	if (tag !== "a") return `<${tag}>${children}</${tag}>`;
	const href = safeHttpUrl(node.getAttribute?.("href") ?? "");
	return href ? `<a href="${escapeAttribute(href)}" rel="noopener noreferrer nofollow">${children}</a>` : children;
}

function renderPlainText(text: string): string {
	return text
		.split(/\n{2,}/u)
		.map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/gu, "<br>")}</p>`)
		.join("");
}

function safeHttpUrl(value: string): string | null {
	try {
		const url = new URL(value);
		if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return null;
		return url.href;
	} catch {
		return null;
	}
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/gu, (character) => {
		switch (character) {
			case "&":
				return "&amp;";
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case '"':
				return "&quot;";
			default:
				return "&#39;";
		}
	});
}

function escapeAttribute(value: string): string {
	return escapeHtml(value);
}
