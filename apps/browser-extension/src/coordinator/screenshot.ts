import type { EvidenceViewportRect } from "../adapters/contracts";

const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;
const JPEG_QUALITY = 0.82;

type PixelRect = { x: number; y: number; width: number; height: number };

type DecodedScreenshot = {
	source: unknown;
	width: number;
	height: number;
	close?: () => void;
};

export type ScreenshotDependencies = {
	decode(dataUrl: string): Promise<DecodedScreenshot>;
	encode(source: unknown, crop: PixelRect, quality: number): Promise<Uint8Array>;
};

export class ScreenshotCaptureError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ScreenshotCaptureError";
	}
}

export async function captureCroppedJpeg(
	dataUrl: string,
	rect: EvidenceViewportRect,
	dependencies: ScreenshotDependencies = defaultScreenshotDependencies(),
): Promise<Uint8Array> {
	assertRect(rect);
	let decoded: DecodedScreenshot;
	try {
		decoded = await dependencies.decode(dataUrl);
	} catch {
		throw new ScreenshotCaptureError("Visible tab screenshot could not be decoded");
	}
	try {
		const crop = scaledClampedRect(rect, decoded.width, decoded.height);
		let output: Uint8Array;
		try {
			output = await dependencies.encode(decoded.source, crop, JPEG_QUALITY);
		} catch {
			throw new ScreenshotCaptureError("Visible tab screenshot could not be cropped");
		}
		if (output.byteLength < 3 || output[0] !== 0xff || output[1] !== 0xd8 || output[2] !== 0xff) {
			throw new ScreenshotCaptureError("Cropped evidence is not a JPEG image");
		}
		if (output.byteLength > MAX_SCREENSHOT_BYTES) {
			throw new ScreenshotCaptureError("Cropped evidence exceeds the 2 MiB limit");
		}
		return output;
	} finally {
		decoded.close?.();
	}
}

function assertRect(rect: EvidenceViewportRect): void {
	if (
		![rect.x, rect.y, rect.width, rect.height, rect.devicePixelRatio].every(Number.isFinite) ||
		rect.width <= 0 ||
		rect.height <= 0 ||
		rect.devicePixelRatio <= 0
	) {
		throw new ScreenshotCaptureError("Evidence rectangle is invalid");
	}
}

function scaledClampedRect(rect: EvidenceViewportRect, imageWidth: number, imageHeight: number): PixelRect {
	if (!Number.isSafeInteger(imageWidth) || !Number.isSafeInteger(imageHeight) || imageWidth <= 0 || imageHeight <= 0) {
		throw new ScreenshotCaptureError("Decoded screenshot dimensions are invalid");
	}
	const left = Math.max(0, Math.floor(rect.x * rect.devicePixelRatio));
	const top = Math.max(0, Math.floor(rect.y * rect.devicePixelRatio));
	const right = Math.min(imageWidth, Math.ceil((rect.x + rect.width) * rect.devicePixelRatio));
	const bottom = Math.min(imageHeight, Math.ceil((rect.y + rect.height) * rect.devicePixelRatio));
	if (right <= left || bottom <= top) throw new ScreenshotCaptureError("Evidence rectangle is outside the visible tab");
	return { x: left, y: top, width: right - left, height: bottom - top };
}

function defaultScreenshotDependencies(): ScreenshotDependencies {
	return {
		decode: async (dataUrl) => {
			const response = await fetch(dataUrl);
			if (!response.ok) throw new Error("Screenshot data URL is unreadable");
			const bitmap = await createImageBitmap(await response.blob());
			return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
		},
		encode: async (source, crop, quality) => {
			const canvas = new OffscreenCanvas(crop.width, crop.height);
			const context = canvas.getContext("2d");
			if (!context) throw new Error("2D canvas is unavailable");
			context.drawImage(
				source as CanvasImageSource,
				crop.x,
				crop.y,
				crop.width,
				crop.height,
				0,
				0,
				crop.width,
				crop.height,
			);
			const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
			return new Uint8Array(await blob.arrayBuffer());
		},
	};
}
