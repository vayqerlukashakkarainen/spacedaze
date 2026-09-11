export interface RamDirection {
	x: number
	y: number
}

export function resolveMiniBossWallRecoilDirection(
	collisionNormal: RamDirection | undefined,
	chargeDirection: RamDirection
): RamDirection {
	const fallback = normalizeDirection({
		x: -chargeDirection.x,
		y: -chargeDirection.y,
	}) ?? { x: 0, y: -1 }
	const candidate = collisionNormal
		? normalizeDirection(collisionNormal) ?? fallback
		: fallback
	const movingIntoNormal =
		candidate.x * chargeDirection.x + candidate.y * chargeDirection.y > 0
	return movingIntoNormal
		? {
			x: candidate.x === 0 ? 0 : -candidate.x,
			y: candidate.y === 0 ? 0 : -candidate.y,
		}
		: candidate
}

function normalizeDirection(direction: RamDirection) {
	const length = Math.hypot(direction.x, direction.y)
	if (length <= 0.001) return undefined
	const x = direction.x / length
	const y = direction.y / length
	return {
		x: Math.abs(x) <= 0.001 ? 0 : x,
		y: Math.abs(y) <= 0.001 ? 0 : y,
	}
}
