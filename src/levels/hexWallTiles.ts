const HEX_NEIGHBOR_MASK = 0b111111

export interface HexWallTopology {
	connectionMask: number
	canonicalMask: number
	rotation: number
	connectionCount: number
	exposedCount: number
	typeId: string
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
