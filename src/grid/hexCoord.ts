import { Vec2 } from "kaplay"
import { k } from "../main"

/**
 * Axial coordinate system for hexagonal grids
 * Using "pointy-top" orientation (flat sides on left/right)
 * 
 * Axial coords use q (column) and r (row)
 * The third coordinate s = -q - r (for cube coordinate system)
 */
export interface HexCoord {
	q: number // Column
	r: number // Row
}

/**
 * Direction offsets for pointy-top hexagons
 * Order: E, NE, NW, W, SW, SE
 */
const HEX_DIRECTIONS: HexCoord[] = [
	{ q: 1, r: 0 },   // East
	{ q: 1, r: -1 },  // North-East
	{ q: 0, r: -1 },  // North-West
	{ q: -1, r: 0 },  // West
	{ q: -1, r: 1 },  // South-West
	{ q: 0, r: 1 },   // South-East
]

/**
 * Create a hex coordinate
 */
export function hexCoord(q: number, r: number): HexCoord {
	return { q, r }
}

/**
 * Check if two hex coordinates are equal
 */
export function hexEqual(a: HexCoord, b: HexCoord): boolean {
	return a.q === b.q && a.r === b.r
}

/**
 * Add two hex coordinates
 */
export function hexAdd(a: HexCoord, b: HexCoord): HexCoord {
	return { q: a.q + b.q, r: a.r + b.r }
}

/**
 * Subtract hex coordinates
 */
export function hexSubtract(a: HexCoord, b: HexCoord): HexCoord {
	return { q: a.q - b.q, r: a.r - b.r }
}

/**
 * Get neighbor in a specific direction (0-5)
 */
export function hexNeighbor(hex: HexCoord, direction: number): HexCoord {
	const dir = HEX_DIRECTIONS[direction]
	return hexAdd(hex, dir)
}

/**
 * Get all 6 neighbors of a hex
 */
export function hexNeighbors(hex: HexCoord): HexCoord[] {
	return HEX_DIRECTIONS.map((dir) => hexAdd(hex, dir))
}

/**
 * Calculate distance between two hexes (in hex steps)
 */
export function hexDistance(a: HexCoord, b: HexCoord): number {
	const dq = Math.abs(a.q - b.q)
	const dr = Math.abs(a.r - b.r)
	const ds = Math.abs((-a.q - a.r) - (-b.q - b.r))
	return Math.max(dq, dr, ds)
}

/**
 * Convert hex coordinate to pixel position (center of hex)
 * Using pointy-top orientation
 */
export function hexToPixel(hex: HexCoord, size: number): Vec2 {
	const x = size * (Math.sqrt(3) * hex.q + (Math.sqrt(3) / 2) * hex.r)
	const y = size * ((3 / 2) * hex.r)
	return k.vec2(x, y)
}

/**
 * Convert pixel position to hex coordinate
 * Using pointy-top orientation
 */
export function pixelToHex(pixel: Vec2, size: number): HexCoord {
	const q = ((Math.sqrt(3) / 3) * pixel.x - (1 / 3) * pixel.y) / size
	const r = ((2 / 3) * pixel.y) / size

	// Round to nearest hex using cube coordinates
	return hexRound(q, r)
}

/**
 * Round fractional hex coordinates to nearest hex
 */
function hexRound(q: number, r: number): HexCoord {
	const s = -q - r

	let rq = Math.round(q)
	let rr = Math.round(r)
	let rs = Math.round(s)

	const qDiff = Math.abs(rq - q)
	const rDiff = Math.abs(rr - r)
	const sDiff = Math.abs(rs - s)

	if (qDiff > rDiff && qDiff > sDiff) {
		rq = -rr - rs
	} else if (rDiff > sDiff) {
		rr = -rq - rs
	}

	return { q: rq, r: rr }
}

/**
 * Get all hex coordinates in a ring around center at distance
 */
export function hexRing(center: HexCoord, radius: number): HexCoord[] {
	if (radius === 0) return [center]

	const results: HexCoord[] = []
	let hex = hexAdd(center, { q: 0, r: -radius })

	for (let i = 0; i < 6; i++) {
		for (let j = 0; j < radius; j++) {
			results.push(hex)
			hex = hexNeighbor(hex, i)
		}
	}

	return results
}

/**
 * Get all hex coordinates within radius (filled circle)
 */
export function hexRange(center: HexCoord, radius: number): HexCoord[] {
	const results: HexCoord[] = []

	for (let q = -radius; q <= radius; q++) {
		const r1 = Math.max(-radius, -q - radius)
		const r2 = Math.min(radius, -q + radius)
		for (let r = r1; r <= r2; r++) {
			results.push(hexAdd(center, { q, r }))
		}
	}

	return results
}

/**
 * Get corners of a hex in pixel space
 * Returns 6 points for polygon rendering
 */
export function hexCorners(hex: HexCoord, size: number): Vec2[] {
	const center = hexToPixel(hex, size)
	const corners: Vec2[] = []

	for (let i = 0; i < 6; i++) {
		const angleDeg = 60 * i - 30 // Pointy-top starts at -30 degrees
		const angleRad = (Math.PI / 180) * angleDeg
		corners.push(k.vec2(
			center.x + size * Math.cos(angleRad),
			center.y + size * Math.sin(angleRad)
		))
	}

	return corners
}

/**
 * Convert hex coord to string key for maps/storage
 */
export function hexToString(hex: HexCoord): string {
	return `${hex.q},${hex.r}`
}

/**
 * Parse hex coord from string key
 */
export function stringToHex(str: string): HexCoord {
	const [q, r] = str.split(",").map(Number)
	return { q, r }
}
