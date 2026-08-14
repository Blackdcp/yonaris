export const ANSWER_CONTAINER_HTML_MAX_BYTES = 2 * 1024 * 1024;

export function validateAnswerContainerSnapshot(input: {
	answerText: string;
	containerText: string;
	answerHtml: string;
}): string {
	if (!input.answerHtml.trim()) throw new Error("Answer-container HTML is empty");
	if (Buffer.byteLength(input.answerHtml, "utf8") > ANSWER_CONTAINER_HTML_MAX_BYTES) {
		throw new Error(`Answer-container HTML exceeds ${ANSWER_CONTAINER_HTML_MAX_BYTES} bytes`);
	}
	if (/^\s*(?:<!doctype\s+html\b|<html\b|<body\b)/iu.test(input.answerHtml)) {
		throw new Error("Full-page HTML cannot be used as an answer-container snapshot");
	}
	if (normalizeVisibleText(input.containerText) !== normalizeVisibleText(input.answerText)) {
		throw new Error("Answer-container HTML does not match the accepted answer text");
	}
	return input.answerHtml;
}

export function assertExactlyOneNewAnswer(previousCount: number, currentCount: number): void {
	if (!Number.isSafeInteger(previousCount) || previousCount < 0 || currentCount !== previousCount + 1) {
		throw new Error("A completed submission must produce exactly one new answer container");
	}
}

function normalizeVisibleText(value: string): string {
	return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}
