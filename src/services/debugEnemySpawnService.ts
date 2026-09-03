import type { Vec2 } from "kaplay"
import { playerObj } from "../game"
import { ACTIVE_RUN_GRID_KEY } from "../grid/gridKeys"
import { gridRegistry } from "../grid/gridRegistry"
import { k } from "../main"
import { spawnAssasin } from "../spawn/spawnAssasin"
import { spawnMeteorite } from "../spawn/spawnAsteroid"
import { spawnBoss1 } from "../spawn/spawnBoss1"
import { spawnShip1 } from "../spawn/spawnShip1"

export type DebugEnemyType = "ship" | "assassin" | "asteroid" | "boss"

const DEBUG_ENEMY_TYPES: readonly DebugEnemyType[] = [
	"ship",
	"assassin",
	"asteroid",
	"boss",
]

export function getDebugEnemyTypes() {
	return [...DEBUG_ENEMY_TYPES, "random"]
}

export function spawnDebugEnemies(
	count: number,
	type: DebugEnemyType | "random",
	center: Vec2
) {
	for (let index = 0; index < count; index++) {
		const enemyType = type === "random"
			? DEBUG_ENEMY_TYPES[Math.floor(k.rand(DEBUG_ENEMY_TYPES.length))]
			: type
		const pos = findSpawnPosition(center, index)
		spawnDebugEnemy(enemyType, pos)
	}
}

export function isDebugEnemyType(
	value: string
): value is DebugEnemyType | "random" {
	return value === "random" || DEBUG_ENEMY_TYPES.includes(
		value as DebugEnemyType
	)
}

function spawnDebugEnemy(type: DebugEnemyType, pos: Vec2) {
	const towardPlayer = playerObj.pos.sub(pos)
	const direction = towardPlayer.len() > 0
		? towardPlayer.unit()
		: k.vec2(0, 1)
	const persistOptions = { persistOffscreen: true }

	switch (type) {
		case "ship":
			spawnShip1(pos, direction, 2, 5, 1, 65, persistOptions)
			return
		case "assassin":
			spawnAssasin(pos, 3, 4, 1, persistOptions)
			return
		case "asteroid":
			spawnMeteorite({
				pos,
				dir: direction,
				scoreOnKill: 2,
				hp: 4,
				speed: 55,
				splitOnDeath: 0,
				destroyOffscreen: false,
			})
			return
		case "boss":
			spawnBoss1(pos, 10, 60, 1)
	}
}

function findSpawnPosition(center: Vec2, index: number) {
	const grid = gridRegistry.get(ACTIVE_RUN_GRID_KEY)
	const baseAngle = index * 137.5

	for (let attempt = 0; attempt < 18; attempt++) {
		const ring = Math.floor((index + attempt) / 8)
		const radius = 120 + ring * 38
		const angle = baseAngle + attempt * 47
		const candidate = center.add(k.Vec2.fromAngle(angle).scale(radius))
		if (!grid) return candidate
		const coord = grid.screenToHex(candidate)
		if (grid.inBounds(coord) && grid.isWalkable(coord)) {
			return grid.hexToScreen(coord)
		}
	}

	return center.add(k.Vec2.fromAngle(baseAngle).scale(80))
}
