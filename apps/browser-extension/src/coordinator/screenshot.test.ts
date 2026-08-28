import { describe, expect, it, vi } from "vitest";
import {
	captureBoundedCroppedJpeg,
	captureCroppedJpeg,
	composeEvidenceJpeg,
	ScreenshotCaptureError,
} from "./screenshot";

const jpeg = (bytes = 32) => Uint8Array.from([0xff, 0xd8, 0xff, ...Array.from({ length: bytes - 3 }, () => 0)]);

describe("captureCroppedJpeg", () => {
	it("clamps CSS bounds to the captured viewport and scales them by device pixel ratio", async () => {
		const encode = vi.fn(async () => jpeg());
		const close = vi.fn();

		const result = await captureCroppedJpeg(
			"data:image/jpeg;base64,fixture",
			{ x: -10, y: 10, width: 50, height: 30, devicePixelRatio: 2 },
			{
				decode: async () => ({ source: {}, width: 100, height: 80, close }),
				encode,
			},
		);

		expect(result.slice(0, 3)).toEqual(Uint8Array.from([0xff, 0xd8, 0xff]));
		expect(encode).toHaveBeenCalledWith({}, { x: 0, y: 20, width: 80, height: 60 }, 0.82);
		expect(close).toHaveBeenCalledOnce();
	});

	it.each([
		{ x: 60, y: 0, width: 10, height: 10, devicePixelRatio: 2 },
		{ x: 0, y: 0, width: 0, height: 10, devicePixelRatio: 1 },
	])("rejects an empty or fully outside evidence rectangle", async (rect) => {
		await expect(
			captureCroppedJpeg("data:image/jpeg;base64,fixture", rect, {
				decode: async () => ({ source: {}, width: 100, height: 80 }),
				encode: async () => jpeg(),
			}),
		).rejects.toBeInstanceOf(ScreenshotCaptureError);
	});

	it("rejects invalid JPEG output and screenshots over 2 MiB", async () => {
		for (const output of [Uint8Array.from([1, 2, 3]), jpeg(2 * 1024 * 1024 + 1)]) {
			await expect(
				captureCroppedJpeg(
					"data:image/jpeg;base64,fixture",
					{ x: 0, y: 0, width: 50, height: 40, devicePixelRatio: 2 },
					{
						decode: async () => ({ source: {}, width: 100, height: 80 }),
						encode: async () => output,
					},
				),
			).rejects.toBeInstanceOf(ScreenshotCaptureError);
		}
	});
});

describe("captureBoundedCroppedJpeg", () => {
	it("reduces quality until an answer-only segment fits within 1 MiB", async () => {
		const encode = vi
			.fn()
			.mockResolvedValueOnce(jpeg(1024 * 1024 + 1))
			.mockResolvedValueOnce(jpeg(900_000));

		const output = await captureBoundedCroppedJpeg(
			"data:image/jpeg;base64,fixture",
			{ x: 0, y: 0, width: 50, height: 40, devicePixelRatio: 2 },
			{
				decode: async () => ({ source: {}, width: 100, height: 80 }),
				encode,
			},
		);

		expect(output).toHaveLength(900_000);
		expect(encode.mock.calls.map((call) => call[2])).toEqual([0.82, 0.68]);
	});
});

describe("composeEvidenceJpeg", () => {
	it("removes segment overlaps and adapts the complete image below 4 MiB", async () => {
		const encode = vi
			.fn()
			.mockResolvedValueOnce(jpeg(4 * 1024 * 1024 + 1))
			.mockResolvedValueOnce(jpeg(3_000_000));
		const close = vi.fn();

		const output = await composeEvidenceJpeg(
			[
				{ bytes: jpeg(), overlapTopCssPx: 0, devicePixelRatio: 2 },
				{ bytes: jpeg(), overlapTopCssPx: 64, devicePixelRatio: 2 },
			],
			{
				decode: async () => ({ source: {}, width: 800, height: 500, close }),
				encode,
			},
		);

		expect(output).toHaveLength(3_000_000);
		expect(encode.mock.calls[0]?.[0]).toEqual([
			{ source: {}, sourceY: 0, width: 800, height: 500, destinationY: 0 },
			{ source: {}, sourceY: 128, width: 800, height: 372, destinationY: 500 },
		]);
		expect(encode.mock.calls.map((call) => call[3])).toEqual([0.82, 0.68]);
		expect(close).toHaveBeenCalledTimes(2);
	});

	it("rejects segment collections that exceed the 6 MiB task budget", async () => {
		await expect(
			composeEvidenceJpeg(
				[
					{ bytes: jpeg(3 * 1024 * 1024 + 1), overlapTopCssPx: 0, devicePixelRatio: 1 },
					{ bytes: jpeg(3 * 1024 * 1024), overlapTopCssPx: 64, devicePixelRatio: 1 },
				],
				{
					decode: async () => ({ source: {}, width: 800, height: 500 }),
					encode: async () => jpeg(),
				},
			),
		).rejects.toThrow(/6 MiB/i);
	});
});
