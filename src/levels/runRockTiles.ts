export const RUN_ROCK_TILE_SPRITE = "run_rock_high"
export const RUN_ROCK_TILE_SOURCE_RADIUS = 32
export const RUN_ROCK_TILE_ANCHOR_Y = 32
export const RUN_ROCK_PROJECTION_Y_SCALE = 11 / 24

const TILE_FRAME_BY_PIXEL_MASK = new Map<number, number>([
	[0, 0],
	[1, 1],
	[2, 2],
	[4, 3],
	[8, 4],
	[16, 5],
	[32, 6],
	[3, 7],
	[6, 8],
	[12, 9],
	[24, 10],
	[48, 11],
	[33, 12],
	[7, 13],
	[14, 14],
	[28, 15],
	[56, 16],
	[49, 17],
	[35, 18],
	[15, 19],
	[30, 20],
	[60, 21],
	[57, 22],
	[51, 23],
	[39, 24],
	[31, 25],
	[62, 26],
	[61, 27],
	[59, 28],
	[55, 29],
	[47, 30],
])

export function getRunRockTileFrame(exposedMask: number, hash: number) {
	const pixelMask = reverseHexEdgeMask(exposedMask & 0b111111)
	const directFrame = TILE_FRAME_BY_PIXEL_MASK.get(pixelMask)
	if (directFrame !== undefined) return directFrame

	const compatibleMasks = [...TILE_FRAME_BY_PIXEL_MASK.keys()]
		.filter((candidate) => (candidate & pixelMask) === candidate)
		.sort((a, b) => countBits(b) - countBits(a))
	const strongestMatch = countBits(compatibleMasks[0] ?? 0)
	const matches = compatibleMasks.filter(
		(candidate) => countBits(candidate) === strongestMatch
	)
	const selectedMask = matches[Math.abs(hash) % matches.length] ?? 0
	return TILE_FRAME_BY_PIXEL_MASK.get(selectedMask) ?? 0
}

function reverseHexEdgeMask(mask: number) {
	let reversed = 0
	for (let bit = 0; bit < 6; bit++) {
		if (mask & (1 << bit)) reversed |= 1 << (5 - bit)
	}
	return reversed
}

function countBits(value: number) {
	let count = 0
	for (let remaining = value; remaining > 0; remaining >>= 1) {
		count += remaining & 1
	}
	return count
}
