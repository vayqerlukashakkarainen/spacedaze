const HEX_NEIGHBOR_MASK = 0b111111

export interface HexWallTopology {
	connectionMask: number
	canonicalMask: number
	rotation: number
	connectionCount: number
	exposedCount: number
	typeId: string
}

export type HexWallEnvironmentKind = "rock" | "ruin" | "machinery"

export interface HexWallEdgeProfilePoint {
	along: number
	inset: number
}

export function getConnectedHexWallEdgeProfile(
	kind: HexWallEnvironmentKind,
	hash: number
): HexWallEdgeProfilePoint[] {
	if (kind === "ruin") {
		return [
			{ along: 0, inset: 0 },
			{ along: 0.16, inset: 0.018 },
			{ along: 0.16, inset: 0.1 },
			{ along: 0.42, inset: 0.1 },
			{ along: 0.42, inset: 0.045 },
			{ along: 0.68, inset: 0.045 },
			{ along: 0.68, inset: 0.085 },
			{ along: 0.86, inset: 0.085 },
			{ along: 1, inset: 0 },
		]
	}

	if (kind === "machinery") {
		return [
			{ along: 0, inset: 0 },
			{ along: 0.18, inset: 0.03 },
			{ along: 0.3, inset: 0.095 },
			{ along: 0.46, inset: 0.055 },
			{ along: 0.58, inset: 0.11 },
			{ along: 0.76, inset: 0.045 },
			{ along: 0.88, inset: 0.075 },
			{ along: 1, inset: 0 },
		]
	}

	return [
		{ along: 0, inset: 0 },
		{ along: 0.17, inset: 0.045 + (Math.abs(hash) % 3) * 0.012 },
		{ along: 0.36, inset: 0.095 },
		{ along: 0.53, inset: 0.038 },
		{ along: 0.7, inset: 0.082 },
		{ along: 0.86, inset: 0.052 },
		{ along: 1, inset: 0 },
	]
}

export function rotateHexMask(mask: number, steps: number): number {
	const normalizedMask = mask & HEX_NEIGHBOR_MASK
	const normalizedSteps = ((steps % 6) + 6) % 6
	let rotatedMask = 0

	for (let direction = 0; direction < 6; direction++) {
		if ((normalizedMask & (1 << direction)) === 0) continue
		rotatedMask |= 1 << ((direction + normalizedSteps) % 6)
	}

	return rotatedMask
}

export function countHexMaskBits(mask: number): number {
	let remaining = mask & HEX_NEIGHBOR_MASK
	let count = 0
	while (remaining > 0) {
		count += remaining & 1
		remaining >>= 1
	}
	return count
}

export function getHexWallTopology(connectionMask: number): HexWallTopology {
	const normalizedMask = connectionMask & HEX_NEIGHBOR_MASK
	let canonicalMask = normalizedMask
	let rotationToCanonical = 0

	for (let rotation = 1; rotation < 6; rotation++) {
		const candidate = rotateHexMask(normalizedMask, rotation)
		if (candidate >= canonicalMask) continue
		canonicalMask = candidate
		rotationToCanonical = rotation
	}

	const connectionCount = countHexMaskBits(normalizedMask)
	return {
		connectionMask: normalizedMask,
		canonicalMask,
		rotation: (6 - rotationToCanonical) % 6,
		connectionCount,
		exposedCount: 6 - connectionCount,
		typeId: `rock-${canonicalMask.toString(2).padStart(6, "0")}`,
	}
}
