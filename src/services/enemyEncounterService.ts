import type { Vec2 } from "kaplay"
import { playerObj } from "../game"
import { k } from "../main"
import { spawnAssasin } from "../spawn/spawnAssasin"
import { spawnMineLayer } from "../spawn/spawnMineLayer"
import { spawnRammer } from "../spawn/spawnRammer"
import { spawnShieldDrone } from "../spawn/spawnShieldDrone"
import { spawnShip1 } from "../spawn/spawnShip1"
import { spawnSniper } from "../spawn/spawnSniper"
import { spawnSwarmGroup } from "../spawn/spawnSwarm"
import { tags } from "../tags"
import {
	getThreatSnapshot,
	scaleThreatSpawnCount,
	type EnemySpawnOptions,
} from "./threatService"

type EncounterId =
	| "patrol"
	| "hunters"
	| "rammers"
	| "mixed"
	| "sniper_nest"
	| "swarm"
	| "mine_layer"
	| "elite_hunt"
	| "shielded_patrol"

interface EncounterDefinition {
	id: EncounterId
	minThreat: number
	weight: number
}

const ENCOUNTERS: readonly EncounterDefinition[] = [
	{ id: "patrol", minThreat: 1, weight: 5 },
	{ id: "hunters", minThreat: 1, weight: 4 },
	{ id: "rammers", minThreat: 1, weight: 3 },
	{ id: "mixed", minThreat: 2, weight: 4 },
	{ id: "sniper_nest", minThreat: 2, weight: 3 },
	{ id: "swarm", minThreat: 3, weight: 3 },
	{ id: "mine_layer", minThreat: 3, weight: 2 },
	{ id: "elite_hunt", minThreat: 4, weight: 2 },
	{ id: "shielded_patrol", minThreat: 4, weight: 2 },
]

export function spawnThreatEncounter(center: Vec2, spacing: number) {
	const tier = getThreatSnapshot().tier
	const definition = selectEncounter(tier)
	const normalOptions: EnemySpawnOptions = {
		persistOffscreen: true,
		tags: [tags.runMap, tags.threatEnemy],
	}
	const eliteOptions: EnemySpawnOptions = {
		...normalOptions,
		elite: true,
	}

		switch (definition.id) {
		case "patrol": {
			const count = scaleThreatSpawnCount(3)
			for (let index = 0; index < count; index++) {
				const pos = formationPosition(center, spacing, index, count)
				spawnShip1(
					pos,
					playerObj.pos.sub(pos).unit(),
					2,
					5,
					1,
					k.rand(50, 75),
					normalOptions
				)
			}
			return definition.id
		}
		case "hunters": {
			const count = scaleThreatSpawnCount(2)
			for (let index = 0; index < count; index++) {
				spawnAssasin(
					formationPosition(center, spacing, index, count),
					3,
					4,
					1,
					normalOptions
				)
			}
			return definition.id
		}
		case "rammers": {
			const count = scaleThreatSpawnCount(2)
			for (let index = 0; index < count; index++) {
				spawnRammer(
					formationPosition(center, spacing, index, count),
					4,
					normalOptions
				)
			}
			return definition.id
		}
		case "mixed": {
			const count = scaleThreatSpawnCount(3)
			for (let index = 0; index < count; index++) {
				const pos = formationPosition(center, spacing, index, count)
				if (index % 3 === 0) {
					spawnAssasin(pos, 3, 5, 1, normalOptions)
				} else {
					spawnShip1(
						pos,
						playerObj.pos.sub(pos).unit(),
						2,
						6,
						1,
						k.rand(55, 80),
						normalOptions
					)
				}
			}
			return definition.id
		}
		case "swarm": {
			const count = Math.max(5, scaleThreatSpawnCount(6))
			spawnSwarmGroup(center, count, normalOptions)
			return definition.id
		}
		case "sniper_nest": {
			const sniperPos = center.add(0, -spacing * 0.35)
			spawnSniper(sniperPos, 4, normalOptions)
			const escorts = scaleThreatSpawnCount(2)
			for (let index = 0; index < escorts; index++) {
				spawnRammer(
					formationPosition(center.add(0, spacing * 0.3), spacing, index, escorts),
					3,
					normalOptions
				)
			}
			return definition.id
		}
		case "mine_layer": {
			spawnMineLayer(center, 5, normalOptions)
			const escorts = scaleThreatSpawnCount(2)
			for (let index = 0; index < escorts; index++) {
				const pos = formationPosition(center, spacing, index, escorts)
				spawnAssasin(pos, 2, 3, 0.9, normalOptions)
			}
			return definition.id
		}
		case "elite_hunt": {
			const elitePos = center.add(-spacing * 0.5, 0)
			spawnAssasin(elitePos, 6, 7, 1, eliteOptions)
			const escorts = scaleThreatSpawnCount(2)
			for (let index = 0; index < escorts; index++) {
				const pos = formationPosition(
					center.add(spacing * 0.5, 0),
					spacing * 0.65,
					index,
					escorts
				)
				spawnShip1(
					pos,
					playerObj.pos.sub(pos).unit(),
					2,
					6,
					1,
					k.rand(60, 85),
					normalOptions
				)
			}
			return definition.id
		}
		case "shielded_patrol": {
			const targetPos = center.add(0, spacing * 0.2)
			const protectedTarget = spawnSniper(targetPos, 6, eliteOptions)
			spawnShieldDrone(
				targetPos.add(spacing * 0.55, 0),
				protectedTarget,
				normalOptions
			)
			const escorts = scaleThreatSpawnCount(2)
			for (let index = 0; index < escorts; index++) {
				spawnRammer(
					formationPosition(center, spacing, index, escorts),
					4,
					normalOptions
				)
			}
			return definition.id
		}
	}
}

function selectEncounter(tier: number) {
	const candidates = ENCOUNTERS.filter(
		(definition) => definition.minThreat <= tier
	)
	const totalWeight = candidates.reduce(
		(total, definition) => total + definition.weight,
		0
	)
	let roll = k.rand(totalWeight)
	for (const definition of candidates) {
		roll -= definition.weight
		if (roll <= 0) return definition
	}
	return candidates[candidates.length - 1]
}

function formationPosition(
	center: Vec2,
	spacing: number,
	index: number,
	count: number
) {
	const angle = -90 + (360 / Math.max(1, count)) * index
	return center.add(k.Vec2.fromAngle(angle).scale(spacing * 0.45))
}
