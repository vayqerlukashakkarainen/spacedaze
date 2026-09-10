import type { Vec2 } from "kaplay"
import type { HexGrid } from "../../grid/hexGrid"
import { k } from "../../main"

export interface MovingTerrainBody {
	pos: Vec2
	vel: Vec2
	hb: number
}

export function bounceMovingTerrainOffGrid(
	body: MovingTerrainBody,
	moveVelocity: Vec2,
	grid?: HexGrid
) {
	if (!grid || moveVelocity.len() <= 0) return false

	const movement = moveVelocity.scale(k.dt())
	const direction = movement.unit()
	const probePos = body.pos
		.add(movement)
		.add(direction.scale(body.hb))
	const blockedCoord = grid.screenToHex(probePos)
	if (grid.inBounds(blockedCoord) && grid.isWalkable(blockedCoord)) {
		return false
	}

	const blockedCenter = grid.hexToScreen(blockedCoord)
	const awayFromCell = body.pos.sub(blockedCenter)
	const normal = awayFromCell.len() > 0
		? awayFromCell.unit()
		: direction.scale(-1)
	const reflected = body.vel.sub(
		normal.scale(2 * body.vel.dot(normal))
	)
	body.vel = reflected.len() > 0
		? reflected.unit()
		: direction.scale(-1)
	return true
}
