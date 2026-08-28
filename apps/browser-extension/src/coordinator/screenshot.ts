import type { EvidenceViewportRect } from "../adapters/contracts";

const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;
const MAX_SEGMENT_BYTES = 1024 * 1024;
const MAX_COMPOSITE_BYTES = 4 * 1024 * 1024;
const MAX_TASK_EVIDENCE_BYTES = 6 * 1024 * 1024;
const JPEG_QUALITY = 0.82;
const ADAPTIVE_JPEG_QUALITIES = [0.82, 0.68, 0.54, 0.42] as const;

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

type CompositePiece = {
	source: unknown;
	sourceY: number;
	width: number;
	height: number;
	destinationY: number;
};

export type EvidenceSegment = {
	bytes: Uint8Array;
	overlapTopCssPx: number;
	devicePixelRatio: number;
};

export type CompositeScreenshotDependencies = {
	decode(bytes: Uint8Array): Promise<DecodedScreenshot>;
	encode(pieces: CompositePiece[], width: number, height: number, quality: number): Promise<Uint8Array>;
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

export async function captureBoundedCroppedJpeg(
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
		for (const quality of ADAPTIVE_JPEG_QUALITIES) {
			let output: Uint8Array;
			try {
				output = await dependencies.encode(decoded.source, crop, quality);
			} catch {
				throw new ScreenshotCaptureError("Visible tab screenshot could not be cropped");
			}
			assertJpeg(output, "Cropped evidence is not a JPEG image");
			if (output.byteLength <= MAX_SEGMENT_BYTES) return output;
		}
		throw new ScreenshotCaptureError("Cropped evidence segment exceeds the 1 MiB limit");
	} finally {
		decoded.close?.();
	}
}

export async function composeEvidenceJpeg(
	segments: readonly EvidenceSegment[],
	dependencies: CompositeScreenshotDependencies = defaultCompositeDependencies(),
): Promise<Uint8Array> {
	if (segments.length < 1) throw new ScreenshotCaptureError("Visual evidence has no segments to compose");
	const segmentBytes = segments.reduce((total, segment) => total + segment.bytes.byteLength, 0);
	if (segmentBytes > MAX_TASK_EVIDENCE_BYTES) {
		throw new ScreenshotCaptureError("Visual evidence segments exceed the 6 MiB task limit");
	}
	const decoded: DecodedScreenshot[] = [];
	try {
		for (const segment of segments) {
			assertJpeg(segment.bytes, "Visual evidence segment is not a JPEG image");
			if (!Number.isFinite(segment.overlapTopCssPx) || segment.overlapTopCssPx < 0) {
				throw new ScreenshotCaptureError("Visual evidence segment overlap is invalid");
			}
			decoded.push(await dependencies.decode(segment.bytes));
		}
		const width = Math.max(...decoded.map((image) => image.width));
		let destinationY = 0;
		const pieces = decoded.map((image, index) => {
			const segment = segments[index] as EvidenceSegment;
			const sourceY = Math.min(image.height, Math.round(segment.overlapTopCssPx * segment.devicePixelRatio));
			const height = image.height - sourceY;
			if (height <= 0) throw new ScreenshotCaptureError("Visual evidence overlap consumes a segment");
			const piece = { source: image.source, sourceY, width: image.width, height, destinationY };
			destinationY += height;
			return piece;
		});
		const maximumOutputBytes = Math.min(MAX_COMPOSITE_BYTES, MAX_TASK_EVIDENCE_BYTES - segmentBytes);
		if (maximumOutputBytes < 3) {
			throw new ScreenshotCaptureError("Visual evidence leaves no task budget for a composite image");
		}
		for (const quality of ADAPTIVE_JPEG_QUALITIES) {
			const output = await dependencies.encode(pieces, width, destinationY, quality);
			assertJpeg(output, "Composed evidence is not a JPEG image");
			if (output.byteLength <= maximumOutputBytes) return output;
		}
		throw new ScreenshotCaptureError("Composed evidence exceeds the bounded task limit");
	} catch (error) {
		if (error instanceof ScreenshotCaptureError) throw error;
		throw new ScreenshotCaptureError("Visual evidence could not be composed");
	} finally {
		for (const image of decoded) image.close?.();
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

function assertJpeg(output: Uint8Array, message: string): void {
	if (output.byteLength < 3 || output[0] !== 0xff || output[1] !== 0xd8 || output[2] !== 0xff) {
		throw new ScreenshotCaptureError(message);
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

function defaultCompositeDependencies(): CompositeScreenshotDependencies {
	return {
		decode: async (bytes) => {
			const bitmap = await createImageBitmap(new Blob([bytes.slice().buffer], { type: "image/jpeg" }));
			return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
		},
		encode: async (pieces, width, height, quality) => {
			const canvas = new OffscreenCanvas(width, height);
			const context = canvas.getContext("2d");
			if (!context) throw new Error("2D canvas is unavailable");
			for (const piece of pieces) {
				context.drawImage(
					piece.source as CanvasImageSource,
					0,
					piece.sourceY,
					piece.width,
					piece.height,
					0,
					piece.destinationY,
					piece.width,
					piece.height,
				);
			}
			const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
			return new Uint8Array(await blob.arrayBuffer());
		},
	};
}
