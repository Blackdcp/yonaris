import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	ZhAnswerMap,
	ZhAnswerScene,
	ZhDeliveryPath,
	ZhEvidenceRecord,
	ZhMarketContext,
	ZhProductWorkbench,
} from "./zh-interactions";

describe("中文区域图形交互", () => {
	it("五问现场把问题、答案、判断、依据和行动分成可见层", () => {
		const markup = renderToStaticMarkup(<ZhAnswerScene initialQuestion="recommended" />);
		expect(markup).toContain('data-protagonist="anxiety-command"');
		for (const layer of ["question", "answer", "judgement", "evidence", "action"]) {
			expect(markup).toContain(`data-layer="${layer}"`);
		}
	});

	it("核心中文交互各自呈现业务主视觉", () => {
		expect(renderToStaticMarkup(<ZhProductWorkbench />)).toContain('data-protagonist="service-system"');
		expect(renderToStaticMarkup(<ZhDeliveryPath />)).toContain('data-protagonist="delivery-roadmap"');
		expect(renderToStaticMarkup(<ZhEvidenceRecord />)).toContain('data-protagonist="evidence-cabinet"');
		expect(renderToStaticMarkup(<ZhAnswerMap />)).toContain('data-protagonist="market-answer-map"');
		expect(renderToStaticMarkup(<ZhMarketContext />)).toContain('data-protagonist="global-service-field"');
	});
});
