export const YONARIS_VI = {
	ink: "#0B1220",
	paper: "#F6F4F1",
	slate: "#1E2A39",
	stone: "#8A95A3",
	mist: "#DDE2E8",
	signal: "#FF6A00",
	blueGray: "#2F3E50",
} as const;

export type YonarisViColor = keyof typeof YONARIS_VI;

export const YONARIS_VI_SWATCHES = [
	{ key: "ink", label: "Ink", value: YONARIS_VI.ink },
	{ key: "paper", label: "Paper", value: YONARIS_VI.paper },
	{ key: "slate", label: "Slate", value: YONARIS_VI.slate },
	{ key: "stone", label: "Stone", value: YONARIS_VI.stone },
	{ key: "mist", label: "Mist", value: YONARIS_VI.mist },
	{ key: "signal", label: "Signal Orange", value: YONARIS_VI.signal },
	{ key: "blueGray", label: "Secondary Blue Gray", value: YONARIS_VI.blueGray },
] as const;

export function parseHexRgb(value: string): readonly [number, number, number] {
	const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value);
	if (!match) throw new Error(`Expected a six-digit hex color; received ${JSON.stringify(value)}`);
	return [Number.parseInt(match[1], 16), Number.parseInt(match[2], 16), Number.parseInt(match[3], 16)];
}

export function recolorRgbaAlphaMask(data: Uint8Array, color: string): void {
	if (data.length % 4 !== 0) throw new Error("RGBA data length must be divisible by four");
	const [red, green, blue] = parseHexRgb(color);
	for (let offset = 0; offset < data.length; offset += 4) {
		if (data[offset + 3] === 0) continue;
		data[offset] = red;
		data[offset + 1] = green;
		data[offset + 2] = blue;
	}
}
