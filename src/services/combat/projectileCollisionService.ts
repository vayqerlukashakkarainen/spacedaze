export interface CollisionPoint {
	x: number
	y: number
}

export interface SegmentCircleIntersection {
	point: CollisionPoint
	progress: number
}

export function findSegmentCircleIntersection(
	start: CollisionPoint,
	end: CollisionPoint,
	center: CollisionPoint,
	radius: number
): SegmentCircleIntersection | undefined {
	const offsetX = start.x - center.x
	const offsetY = start.y - center.y
	const radiusSquared = radius * radius
	if (offsetX * offsetX + offsetY * offsetY <= radiusSquared) {
		return {
			point: { x: start.x, y: start.y },
			progress: 0,
		}
	}

	const movementX = end.x - start.x
	const movementY = end.y - start.y
	const movementSquared = movementX * movementX + movementY * movementY
	if (movementSquared === 0) return undefined

	const twiceProjection = 2 * (
		offsetX * movementX + offsetY * movementY
	)
	const discriminant = twiceProjection * twiceProjection - 4 * movementSquared * (
		offsetX * offsetX + offsetY * offsetY - radiusSquared
	)
	if (discriminant < 0) return undefined

	const discriminantRoot = Math.sqrt(discriminant)
	const firstProgress = (-twiceProjection - discriminantRoot) /
		(2 * movementSquared)
	const secondProgress = (-twiceProjection + discriminantRoot) /
		(2 * movementSquared)
	const progress = firstProgress >= 0 && firstProgress <= 1
		? firstProgress
		: secondProgress >= 0 && secondProgress <= 1
			? secondProgress
			: undefined
	if (progress === undefined) return undefined

	return {
		point: {
			x: start.x + movementX * progress,
			y: start.y + movementY * progress,
		},
		progress,
	}
}
