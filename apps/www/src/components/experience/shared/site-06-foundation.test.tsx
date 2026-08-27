import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrbitField } from "./orbit-field";
import * as readingLens from "./reading-lens";

const { ReadingLens } = readingLens;
const sharedRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = join(sharedRoot, "../../../../../..");

type HashTarget = {
	location: { hash: string };
	addEventListener(type: "hashchange", listener: () => void): void;
	removeEventListener(type: "hashchange", listener: () => void): void;
};

type BindReadingLensHash = (options: {
	target: HashTarget;
	records: readonly { id: string; stableId: string }[];
	onSelect: (id: string) => void;
	onReveal: (stableId: string) => void;
	schedule?: (callback: () => void) => void;
}) => () => void;

function inspectJpeg(buffer: Buffer) {
	const metadataMarkers: number[] = [];
	let width = 0;
	let height = 0;
	let offset = 2;
	while (offset < buffer.length) {
		if (buffer[offset] !== 0xff) throw new Error(`Invalid JPEG marker at ${offset}`);
		while (buffer[offset] === 0xff) offset += 1;
		const marker = buffer[offset];
		offset += 1;
		if (marker === 0xda) {
			return {
				width,
				height,
				metadataMarkers,
				scanSha256: createHash("sha256").update(buffer.subarray(offset - 2)).digest("hex"),
			};
		}
		if (marker === 0xd9) break;
		if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue;
		const length = buffer.readUInt16BE(offset);
		if ((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe) metadataMarkers.push(marker);
		if ([0xc0, 0xc1, 0xc2].includes(marker)) {
			height = buffer.readUInt16BE(offset + 3);
			width = buffer.readUInt16BE(offset + 5);
		}
		offset += length;
	}
	throw new Error("JPEG has no start-of-scan marker");
}

function fakeHashTarget(hash: string) {
	const listeners = new Set<() => void>();
	return {
		location: { hash },
		addEventListener(_type: "hashchange", listener: () => void) {
			listeners.add(listener);
		},
		removeEventListener(_type: "hashchange", listener: () => void) {
			listeners.delete(listener);
		},
		dispatchHashChange() {
			for (const listener of listeners) listener();
		},
	};
}

describe("Site 06 shared foundation", () => {
	it("tracks the audit-safe review derivative and complete photography set", () => {
		const referenceRoot = join(repositoryRoot, "docs/design/site-06-reference");
		const sourceManifest = JSON.parse(readFileSync(join(referenceRoot, "source-manifest.json"), "utf8")) as {
			immutableBinding: { path: string; sha256: string };
			repositoryDerivative: { path: string; sha256: string; structuralChanges: boolean };
		};
		expect(sourceManifest.immutableBinding).toEqual({
			path: "E:/Yonaris/.superpowers/brainstorm/1950-1787739192/content/site-system-multipage-agent-06.html",
			sha256: "e26b204b528481ddd3274d4a546f1a9acd02a0f7f5e94de80b1070a1d05b46da",
		});
		expect(sourceManifest.repositoryDerivative.path).toBe(
			"docs/design/site-06-reference/site-system-multipage-agent-06.html",
		);
		expect(sourceManifest.repositoryDerivative.structuralChanges).toBe(false);
		const referenceHtml = readFileSync(join(referenceRoot, "site-system-multipage-agent-06.html"));
		expect(createHash("sha256").update(referenceHtml).digest("hex")).toBe(sourceManifest.repositoryDerivative.sha256);
		for (const asset of [
			"photo-office-unsplash-1497366811353.jpg",
			"photo-business-walk-pexels-8526452.jpg",
			"photo-lobby-pexels-18592586.jpg",
			"photo-evidence-unsplash-1450101499163.jpg",
			"photo-glass-meeting-pexels-3760089.jpg",
			"photo-warm-office-pexels-31771712.jpg",
			"photo-working-unsplash-1524758631624.jpg",
		]) {
			expect(existsSync(join(referenceRoot, "assets", asset)), `${asset} must stay in the review derivative`).toBe(true);
		}
		for (const asset of [
			"conference-room.jpg",
			"business-walk.jpg",
			"glass-venue.jpg",
			"evidence-room.jpg",
			"glass-meeting.jpg",
			"warm-office.jpg",
			"working-session.jpg",
		]) {
			expect(
				existsSync(join(repositoryRoot, "apps/www/public/brand/site-06", asset)),
				`${asset} must be available to the marketing app`,
			).toBe(true);
		}

		const referenceWarmOffice = readFileSync(join(referenceRoot, "assets/photo-warm-office-pexels-31771712.jpg"));
		const productionWarmOffice = readFileSync(
			join(repositoryRoot, "apps/www/public/brand/site-06/warm-office.jpg"),
		);
		expect(productionWarmOffice.equals(referenceWarmOffice)).toBe(true);
		expect(createHash("sha256").update(productionWarmOffice).digest("hex")).toBe(
			"f2332ec8c09034426234a5a05f392b27d72a0ab1390e919623e80449509fc259",
		);
		expect(inspectJpeg(productionWarmOffice)).toEqual({
			width: 1800,
			height: 1200,
			metadataMarkers: [],
			scanSha256: "40bb77961d65de4f5699f45ad2ec529390d2be156fd30d3d459d97b1fcf7bbec",
		});

		const referenceBusinessWalk = readFileSync(join(referenceRoot, "assets/photo-business-walk-pexels-8526452.jpg"));
		const productionBusinessWalk = readFileSync(
			join(repositoryRoot, "apps/www/public/brand/site-06/business-walk.jpg"),
		);
		expect(productionBusinessWalk.equals(referenceBusinessWalk)).toBe(true);
		expect(createHash("sha256").update(productionBusinessWalk).digest("hex")).toBe(
			"db995fb32f261fcecdd4d6b60688764bbbdc36ed440b2961fb068a840200e390",
		);
		expect(inspectJpeg(productionBusinessWalk)).toEqual({
			width: 1800,
			height: 2696,
			metadataMarkers: [],
			scanSha256: "9be312203205f9ff5db7bc492b0e7c84c6ac52546dc6882f8abe2533eb5d2c15",
		});
	});

	it("renders one meaningful orbit and an accessible dual reading", () => {
		const lens = renderToStaticMarkup(
			<ReadingLens
				locale="en"
				initialId="scope"
				records={[
					{
						id: "scope",
						prompt: "What is the scope?",
						human: "Human context",
						meaning: "Decision meaning",
						fact: "Canonical fact",
						evidence: "Public company statement",
						boundary: "No outcome guarantee",
						stableId: "yonaris.scope.martech-system",
					},
				]}
			/>,
		);
		const orbit = renderToStaticMarkup(
			<OrbitField label="Shared public fact">
				<p>Fact</p>
			</OrbitField>,
		);
		expect(lens).toContain('role="tablist"');
		expect(lens).toContain("For people");
		expect(lens).toContain("For agents");
		expect(lens).toContain("Fact");
		expect(lens).toContain("Evidence");
		expect(lens).toContain("Boundary");
		expect(lens).toContain("Stable ID");
		expect(orbit.match(/data-orbit-ring=/g) ?? []).toHaveLength(3);
	});

	it("keeps optional orbit tilt a non-semantic visual enhancement", () => {
		const orbit = renderToStaticMarkup(
			<OrbitField label="Shared public fact" interactive>
				<p>Fact</p>
			</OrbitField>,
		);
		expect(orbit).not.toContain("data-orbit-interactive");
		expect(orbit).not.toContain('tabindex="0"');
	});

	it("selects and reveals the matching public fact on initial and later hash navigation", () => {
		const bindReadingLensHash = (readingLens as typeof readingLens & { bindReadingLensHash?: BindReadingLensHash })
			.bindReadingLensHash;
		expect(bindReadingLensHash, "ReadingLens must bind stable record hashes").toBeTypeOf("function");
		if (!bindReadingLensHash) return;

		const target = fakeHashTarget("#yonaris.purpose.decision-system");
		const selected: string[] = [];
		const revealed: string[] = [];
		const cleanup = bindReadingLensHash({
			target,
			records: [
				{ id: "category", stableId: "yonaris.category.ai-native-martech" },
				{ id: "purpose", stableId: "yonaris.purpose.decision-system" },
				{ id: "scope", stableId: "yonaris.scope.martech-system" },
			],
			onSelect: (id) => selected.push(id),
			onReveal: (stableId) => revealed.push(stableId),
			schedule: (callback) => callback(),
		});

		expect(selected).toEqual(["purpose"]);
		expect(revealed).toEqual(["yonaris.purpose.decision-system"]);

		target.location.hash = "#yonaris.scope.martech-system";
		target.dispatchHashChange();
		expect(selected).toEqual(["purpose", "scope"]);
		expect(revealed).toEqual(["yonaris.purpose.decision-system", "yonaris.scope.martech-system"]);

		target.location.hash = "#unrelated-section";
		target.dispatchHashChange();
		expect(selected).toEqual(["purpose", "scope"]);

		cleanup();
		target.location.hash = "#yonaris.category.ai-native-martech";
		target.dispatchHashChange();
		expect(selected).toEqual(["purpose", "scope"]);
	});

	it("keeps the matching fact, evidence and boundary visible at each stable Human target", () => {
		const lens = renderToStaticMarkup(
			<ReadingLens
				locale="en"
				initialId="scope"
				records={[
					{
						id: "scope",
						prompt: "What is the scope?",
						human: "Human context",
						meaning: "Decision meaning",
						fact: "Canonical fact",
						evidence: "Public company statement",
						boundary: "No outcome guarantee",
						stableId: "yonaris.scope.martech-system",
					},
				]}
			/>,
		);
		const target = lens.match(/<article(?=[^>]*id="yonaris\.scope\.martech-system")[^>]*>[\s\S]*?<\/article>/)?.[0];

		expect(target, "stable Human fact target must be a visible semantic article").toBeTruthy();
		expect(target).toContain('tabindex="-1"');
		expect(target).toContain("Canonical fact");
		expect(target).toContain("Public company statement");
		expect(target).toContain("No outcome guarantee");
	});
});
