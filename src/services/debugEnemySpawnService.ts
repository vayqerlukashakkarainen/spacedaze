import type { Vec2 } from "kaplay"
import { playerObj } from "../game"
import { ACTIVE_RUN_GRID_KEY } from "../grid/gridKeys"
import { gridRegistry } from "../grid/gridRegistry"
import { k } from "../main"
import { spawnAssasin } from "../spawn/spawnAssasin"
import { spawnMeteorite } from "../spawn/spawnAsteroid"
import { spawnBoss1 } from "../spawn/spawnBoss1"
import { spawnMineLayer } from "../spawn/spawnMineLayer"
import { spawnGravityWarden } from "../spawn/spawnGravityWarden"
import { spawnOrbitLancer } from "../spawn/spawnOrbitLancer"
import { spawnRammer } from "../spawn/spawnRammer"
import { spawnRepairSkiff } from "../spawn/spawnRepairSkiff"
import { spawnSiegeBarge } from "../spawn/spawnSiegeBarge"
import { spawnShieldDrone } from "../spawn/spawnShieldDrone"
import { spawnShip1 } from "../spawn/spawnShip1"
import { spawnSniper } from "../spawn/spawnSniper"
import { spawnSplitter } from "../spawn/spawnSplitter"
import { spawnHiveMind, spawnSwarmEnemy } from "../spawn/spawnSwarm"
import { spawnTetherDrone } from "../spawn/spawnTetherDrone"
import { spawnPhaseSkirmisher } from "../spawn/spawnPhaseSkirmisher"
import { spawnSalvageScavenger } from "../spawn/spawnSalvageScavenger"
import { spawnSuppressor } from "../spawn/spawnSuppressor"
import { spawnBreachCrawler } from "../spawn/spawnBreachCrawler"

export type DebugEnemyType =
	| "ship"
	| "assassin"
	| "rammer"
	| "sniper"
	| "mine-layer"
	| "orbit-lancer"
	| "siege-barge"
	| "tether-drone"
	| "repair-skiff"
	| "splitter"
	| "gravity-warden"
	| "phase-skirmisher"
	| "salvage-scavenger"
	| "suppressor"
	| "breach-crawler"
	| "shield"
	| "swarm"
	| "hivemind"
	| "asteroid"
	| "boss"

const DEBUG_ENEMY_TYPES: readonly DebugEnemyType[] = [
	"ship",
	"assassin",
	"rammer",
	"sniper",
	"mine-layer",
	"orbit-lancer",
	"siege-barge",
	"tether-drone",
	"repair-skiff",
	"splitter",
	"gravity-warden",
	"phase-skirmisher",
	"salvage-scavenger",
	"suppressor",
	"breach-crawler",
	"shield",
	"swarm",
	"hivemind",
	"asteroid",
	"boss",
]

export function getDebugEnemyTypes() {
	return [...DEBUG_ENEMY_TYPES, "random"]
}

export function spawnDebugEnemies(
	count: number,
	type: DebugEnemyType | "random",
	center: Vec2,
	indexOffset: number = 0
) {
	for (let index = 0; index < count; index++) {
		const enemyType = type === "random"
			? DEBUG_ENEMY_TYPES[Math.floor(k.rand(DEBUG_ENEMY_TYPES.length))]
			: type
		const pos = findSpawnPosition(center, index + indexOffset)
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
		case "rammer":
			spawnRammer(pos, 4, persistOptions)
			return
		case "sniper":
			spawnSniper(pos, 4, persistOptions)
			return
		case "mine-layer":
			spawnMineLayer(pos, 5, persistOptions)
			return
		case "orbit-lancer":
			spawnOrbitLancer(pos, 3, persistOptions)
			return
		case "siege-barge":
			spawnSiegeBarge(pos, 10, persistOptions)
			return
		case "tether-drone":
			spawnTetherDrone(pos, 4, persistOptions)
			return
		case "repair-skiff": {
			spawnShip1(pos, direction, 4, 4, 1, 48, persistOptions)
			spawnRepairSkiff(pos.add(42, 0), 3, persistOptions)
			return
		}
		case "splitter":
			spawnSplitter(pos, 7, persistOptions)
			return
		case "gravity-warden":
			spawnGravityWarden(pos, 6, persistOptions)
			return
		case "phase-skirmisher":
			spawnPhaseSkirmisher(pos, 5, persistOptions)
			return
		case "salvage-scavenger":
			spawnSalvageScavenger(pos, 4, persistOptions)
			return
		case "suppressor":
			spawnSuppressor(pos, 6, persistOptions)
			return
		case "breach-crawler":
			spawnBreachCrawler(pos, 8, persistOptions)
			return
		case "shield": {
			const protectedTarget = spawnShip1(
				pos,
				direction,
				2,
				6,
				1,
				55,
				persistOptions
			)
			spawnShieldDrone(pos.add(36, 0), protectedTarget, persistOptions)
			return
		}
		case "swarm":
			spawnSwarmEnemy(pos, 2, persistOptions)
			return
		case "hivemind":
			spawnHiveMind(pos, persistOptions)
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
