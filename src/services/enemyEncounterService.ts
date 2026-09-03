import type { Vec2 } from "kaplay"
import { playerObj } from "../game"
import { k } from "../main"
import { spawnAssasin } from "../spawn/spawnAssasin"
import { spawnShip1 } from "../spawn/spawnShip1"
import { tags } from "../tags"
import {
	getThreatSnapshot,
	scaleThreatSpawnCount,
	type EnemySpawnOptions,
} from "./threatService"

type EncounterId = "patrol" | "hunters" | "mixed" | "swarm" | "elite_hunt"

interface EncounterDefinition {
	id: EncounterId
	minThreat: number
	weight: number
}

const ENCOUNTERS: readonly EncounterDefinition[] = [
	{ id: "patrol", minThreat: 1, weight: 5 },
	{ id: "hunters", minThreat: 1, weight: 4 },
	{ id: "mixed", minThreat: 2, weight: 4 },
	{ id: "swarm", minThreat: 3, weight: 3 },
	{ id: "elite_hunt", minThreat: 4, weight: 2 },
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
			const count = scaleThreatSpawnCount(4)
			for (let index = 0; index < count; index++) {
				spawnAssasin(
					formationPosition(center, spacing, index, count),
					2,
					3,
					0.9,
					normalOptions
				)
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
