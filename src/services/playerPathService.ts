import type { Vec2 } from "kaplay"

export const PLAYER_PATH_SAMPLE_DISTANCE = 24
export const PLAYER_MAP_TRAIL_DISTANCE = 720

let playerPath: Vec2[] = []

export function resetPlayerPath(pos: Vec2) {
	playerPath = [pos.clone()]
}

export function recordPlayerPathPosition(pos: Vec2) {
	if (playerPath.length === 0) {
		resetPlayerPath(pos)
		return
	}

	let lastPosition = playerPath[playerPath.length - 1]
	let remaining = pos.sub(lastPosition)
	while (remaining.len() >= PLAYER_PATH_SAMPLE_DISTANCE) {
		const nextPosition = lastPosition.add(
			remaining.unit().scale(PLAYER_PATH_SAMPLE_DISTANCE)
		)
		playerPath.push(nextPosition)
		lastPosition = nextPosition
		remaining = pos.sub(lastPosition)
	}
}

export function getPlayerPathSnapshot() {
	return playerPath.map((position) => position.clone())
}

export function getRecentPlayerPath(
	currentPosition: Vec2,
	maxDistance = PLAYER_MAP_TRAIL_DISTANCE
) {
	const points = getPlayerPathSnapshot()
	const lastPosition = points[points.length - 1]
	if (!lastPosition) return [currentPosition.clone()]
	if (lastPosition.dist(currentPosition) > 0.01) {
		points.push(currentPosition.clone())
	}

	const recentPath = [points[points.length - 1]]
	let accumulatedDistance = 0
	for (let index = points.length - 2; index >= 0; index--) {
		const olderPosition = points[index]
		const newerPosition = points[index + 1]
		const segmentDistance = olderPosition.dist(newerPosition)
		if (accumulatedDistance + segmentDistance <= maxDistance) {
			recentPath.push(olderPosition)
			accumulatedDistance += segmentDistance
			continue
		}

		const remainingDistance = maxDistance - accumulatedDistance
		if (remainingDistance > 0 && segmentDistance > 0) {
			recentPath.push(
				newerPosition.lerp(
					olderPosition,
					remainingDistance / segmentDistance
				)
			)
		}
		break
	}

	return recentPath.reverse()
}
