import type { BrokerEvidenceStoreContract, BrokerSessionFactory } from "./broker-server.js";
import type { EvidenceCapture, SurfaceResponse, SurfaceSession } from "./contracts.js";

export class FakeSessionFactory implements BrokerSessionFactory {
	readonly session = new FakeSession();
	async create(): Promise<SurfaceSession> {
		return this.session;
	}
	async resume(): Promise<SurfaceSession> {
		return this.session;
	}
}

class FakeSession implements SurfaceSession {
	readonly id = "session-1";
	async open(): Promise<void> {}
	async prepare(): Promise<void> {}
	async submit(): Promise<void> {}
	async confirmSubmission(): Promise<void> {}
	async collectResponse(): Promise<SurfaceResponse> {
		return {
			answerText: "answer",
			pageUrl: "https://www.doubao.com/chat/1",
			observedAt: "2026-08-13T00:00:00.000Z",
			citations: [],
			webQueries: [],
			webSearchObserved: null,
		};
	}
	async captureEvidence(): Promise<EvidenceCapture> {
		return { domSnapshot: "<html></html>", screenshotPng: Buffer.from("png") };
	}
	async handoffMetadata() {
		return {
			sessionId: this.id,
			profileDirectory: "/private/profile",
			lastPageUrl: "https://www.doubao.com/chat/1",
			fixture: false as const,
		};
	}
	async close(): Promise<void> {}
}

export class FakeEvidenceStore implements BrokerEvidenceStoreContract {
	async capture(): Promise<never> {
		throw new Error("capture not expected");
	}
	async release(): Promise<void> {}
}
