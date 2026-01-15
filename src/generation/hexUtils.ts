/**
 * Standalone hex coordinate utilities for generation
 * Does not depend on kaplay or any browser APIs
 */

export interface HexCoord {
	q: number;
	r: number;
}

export function hexCoord(q: number, r: number): HexCoord {
	return { q, r };
}

export function hexNeighbors(hex: HexCoord): HexCoord[] {
	const directions = [
		{ q: 1, r: 0 },
		{ q: 1, r: -1 },
		{ q: 0, r: -1 },
		{ q: -1, r: 0 },
		{ q: -1, r: 1 },
		{ q: 0, r: 1 },
	];
	return directions.map((d) => ({ q: hex.q + d.q, r: hex.r + d.r }));
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
	const q = Math.abs(a.q - b.q);
	const r = Math.abs(a.r - b.r);
	const s = Math.abs(-a.q - a.r - (-b.q - b.r));
	return Math.max(q, r, s);
}

export function rotateHexCoord(coord: HexCoord, steps: number): HexCoord {
	steps = ((steps % 6) + 6) % 6;

	let q = coord.q;
	let r = coord.r;
	let s = -q - r;

	for (let i = 0; i < steps; i++) {
		const newQ = -s;
		const newR = -q;
		s = -r;
		q = newQ;
		r = newR;
	}

	return { q, r };
}

export function hexToPixel(
	hex: HexCoord,
	size: number
): { x: number; y: number } {
	const x = size * (Math.sqrt(3) * hex.q + (Math.sqrt(3) / 2) * hex.r);
	const y = size * ((3 / 2) * hex.r);
	return { x, y };
}

export function hexKey(coord: HexCoord, layer: number = 0): string {
	return `${coord.q},${coord.r}_L${layer}`;
}
