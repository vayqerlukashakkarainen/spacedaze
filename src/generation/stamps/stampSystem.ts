import { GenerationMap, CaveGenConfig } from "../generationTypes";
import { HexCoord, hexDistance, rotateHexCoord } from "../hexUtils";
import { SeededRNG } from "../seededRng";

/**
 * Hex stamp definition - relative coordinates with overrides
 */
export interface HexStamp {
	name: string;
	cells: StampCell[];
	width: number; // Bounding box for placement calculations
	height: number;
}

export interface StampCell {
	coord: HexCoord; // Relative to stamp origin
	solid?: boolean; // Override solid state
	hardness?: number;
	density?: number;
	tags?: string[];
	lock?: boolean; // Lock cell from further modification
}

/**
 * Pass 5: Apply stamps to generation map
 */
export function applyStamps(
	map: GenerationMap,
	rng: SeededRNG,
	config: CaveGenConfig
): void {
	if (!config.stamps.enabled) return;

	const placedStamps: HexCoord[] = [];

	for (let i = 0; i < config.stamps.count; i++) {
		// Pick random stamp
		const stamp = rng.choice(STAMP_LIBRARY);

		// Find valid placement location
		const placement = findStampPlacement(
			map,
			stamp,
			placedStamps,
			config.stamps.minSpacing,
			rng
		);
		if (!placement) continue;

		// Apply stamp with random rotation
		const rotation = rng.nextInt(0, 6);
		applyStamp(map, placement, stamp, rotation);
		placedStamps.push(placement);
	}
}

/**
 * Find valid placement for stamp (in empty region, min spacing from others)
 */
function findStampPlacement(
	map: GenerationMap,
	stamp: HexStamp,
	existing: HexCoord[],
	minSpacing: number,
	rng: SeededRNG
): HexCoord | undefined {
	const maxAttempts = 50;

	for (let i = 0; i < maxAttempts; i++) {
		const q = rng.nextInt(stamp.width, map.width - stamp.width);
		const r = rng.nextInt(stamp.height, map.height - stamp.height);
		const coord = { q, r };

		// Check minimum spacing from other stamps
		const tooClose = existing.some(
			(other) => hexDistance(coord, other) < minSpacing
		);
		if (tooClose) continue;

		// Check if center is in empty space
		const centerCell = map.getCell(coord);
		if (centerCell && !centerCell.solid) {
			return coord;
		}
	}

	return undefined;
}

/**
 * Apply stamp at position with rotation
 */
function applyStamp(
	map: GenerationMap,
	center: HexCoord,
	stamp: HexStamp,
	rotation: number
): void {
	for (const stampCell of stamp.cells) {
		// Apply rotation to relative coordinate
		const rotated = rotateHexCoord(stampCell.coord, rotation);

		// Calculate absolute position
		const absoluteCoord = {
			q: center.q + rotated.q,
			r: center.r + rotated.r,
		};

		if (!map.inBounds(absoluteCoord)) continue;

		const cell = map.getCell(absoluteCoord);
		if (!cell || cell.locked) continue;

		// Apply overrides
		if (stampCell.solid !== undefined) cell.solid = stampCell.solid;
		if (stampCell.hardness !== undefined) cell.hardness = stampCell.hardness;
		if (stampCell.density !== undefined) cell.density = stampCell.density;
		if (stampCell.lock) cell.locked = true;

		if (stampCell.tags) {
			for (const tag of stampCell.tags) {
				cell.tags.add(tag);
			}
		}
	}
}

/**
 * Stamp library - predefined structures
 */
export const STAMP_LIBRARY: HexStamp[] = [
	// Large circular chamber
	{
		name: "chamber",
		width: 5,
		height: 5,
		cells: [
			{ coord: { q: 0, r: 0 }, solid: false, tags: ["chamber"] },
			{ coord: { q: 1, r: 0 }, solid: false },
			{ coord: { q: 1, r: -1 }, solid: false },
			{ coord: { q: 0, r: -1 }, solid: false },
			{ coord: { q: -1, r: 0 }, solid: false },
			{ coord: { q: -1, r: 1 }, solid: false },
			{ coord: { q: 0, r: 1 }, solid: false },
			{ coord: { q: 2, r: 0 }, solid: false },
			{ coord: { q: 2, r: -1 }, solid: false },
			{ coord: { q: 1, r: -2 }, solid: false },
			{ coord: { q: 0, r: -2 }, solid: false },
			{ coord: { q: -1, r: -1 }, solid: false },
			{ coord: { q: -2, r: 0 }, solid: false },
			{ coord: { q: -2, r: 1 }, solid: false },
			{ coord: { q: -1, r: 2 }, solid: false },
			{ coord: { q: 0, r: 2 }, solid: false },
			{ coord: { q: 1, r: 1 }, solid: false },
			{ coord: { q: 2, r: -2 }, solid: false },
		],
	},

	// Ancient structure (hard walls, locked)
	{
		name: "structure",
		width: 4,
		height: 4,
		cells: [
			{ coord: { q: 0, r: 0 }, solid: false, tags: ["structure"] },
			{ coord: { q: 1, r: 0 }, solid: true, hardness: 5.0, lock: true },
			{ coord: { q: 0, r: 1 }, solid: true, hardness: 5.0, lock: true },
			{ coord: { q: -1, r: 0 }, solid: true, hardness: 5.0, lock: true },
			{ coord: { q: 0, r: -1 }, solid: true, hardness: 5.0, lock: true },
			{ coord: { q: 2, r: 0 }, solid: false },
			{ coord: { q: 0, r: 2 }, solid: false },
			{ coord: { q: -2, r: 0 }, solid: false },
			{ coord: { q: 0, r: -2 }, solid: false },
		],
	},

	// Small alcove
	{
		name: "alcove",
		width: 3,
		height: 3,
		cells: [
			{ coord: { q: 0, r: 0 }, solid: false, tags: ["alcove"] },
			{ coord: { q: 1, r: 0 }, solid: false },
			{ coord: { q: 1, r: -1 }, solid: false },
			{ coord: { q: 0, r: -1 }, solid: false },
		],
	},

	// Resource node cluster
	{
		name: "resource_cluster",
		width: 3,
		height: 3,
		cells: [
			{ coord: { q: 0, r: 0 }, solid: false, tags: ["resource_cluster"] },
			{ coord: { q: 1, r: 0 }, solid: true, density: 2.5, tags: ["rich_ore"] },
			{ coord: { q: 0, r: 1 }, solid: true, density: 2.5, tags: ["rich_ore"] },
			{ coord: { q: -1, r: 0 }, solid: true, density: 2.5, tags: ["rich_ore"] },
		],
	},
];
