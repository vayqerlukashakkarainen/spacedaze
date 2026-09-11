import type { GameObj, Vec2 } from "kaplay"
import { playerObj } from "../../game"
import { k } from "../../main"
import { spawnAssasin } from "../../spawn/spawnAssasin"
import { spawnMineLayer } from "../../spawn/spawnMineLayer"
import { spawnGravityWarden } from "../../spawn/spawnGravityWarden"
import { spawnOrbitLancer } from "../../spawn/spawnOrbitLancer"
import { spawnRammer } from "../../spawn/spawnRammer"
import { spawnRepairSkiff } from "../../spawn/spawnRepairSkiff"
import { spawnSiegeBarge } from "../../spawn/spawnSiegeBarge"
import { spawnShieldDrone } from "../../spawn/spawnShieldDrone"
import { spawnShip1 } from "../../spawn/spawnShip1"
import { spawnSniper } from "../../spawn/spawnSniper"
import { spawnSplitter } from "../../spawn/spawnSplitter"
import { spawnHiveMind, spawnSwarmEnemy, spawnSwarmGroup } from "../../spawn/spawnSwarm"
import { spawnTetherDrone } from "../../spawn/spawnTetherDrone"
import { spawnPhaseSkirmisher } from "../../spawn/spawnPhaseSkirmisher"
import { spawnSalvageScavenger } from "../../spawn/spawnSalvageScavenger"
import { spawnSuppressor } from "../../spawn/spawnSuppressor"
import { spawnBreachCrawler } from "../../spawn/spawnBreachCrawler"
import { spawnScrapNipper } from "../../spawn/wake/spawnScrapNipper"
import { spawnRivetGunner } from "../../spawn/wake/spawnRivetGunner"
import { spawnTowhookRig } from "../../spawn/wake/spawnTowhookRig"
import { spawnPatchTender } from "../../spawn/wake/spawnPatchTender"
import { spawnScrapRaiser } from "../../spawn/wake/spawnScrapRaiser"
import { spawnBoilerHulk } from "../../spawn/wake/spawnBoilerHulk"
import { spawnClampback } from "../../spawn/wake/spawnClampback"
import { spawnFuseRat } from "../../spawn/wake/spawnFuseRat"
import { spawnShredderSkiff } from "../../spawn/wake/spawnShredderSkiff"
import { spawnMagnetMaw } from "../../spawn/wake/spawnMagnetMaw"
import { spawnRailbreakerRig } from "../../spawn/wake/spawnRailbreakerRig"
import { spawnScrappersHut } from "../../spawn/wake/spawnScrappersHut"
import {
	getFloorPositionForDepth,
	getFloorThemeIdForDepth,
} from "../../levels/floorThemes/floorThemeDirectory"
import { tags } from "../../tags"
import {
	getThreatSnapshot,
	scaleThreatSpawnCount,
	type EnemySpawnOptions,
} from "./threatService"
import {
	createBudgetEncounterPlan,
	type BudgetEnemyId,
} from "./enemyEncounterBudgetService"
import {
	isEnemyProgressionUnlocked,
	type ProgressionEnemyId,
} from "./enemyProgressionService"
import { getHubLevel } from "../hub/hubProgressService"
import {
	selectEncounterDefinition,
	type EncounterId,
} from "./enemyEncounterCatalogService"
import { createWakeEncounterEnemies } from "./wakeEncounterService"

export function spawnPlannedEnemy(
	id: ProgressionEnemyId,
	pos: Vec2,
	options: EnemySpawnOptions = {}
): GameObj | undefined {
	switch (id) {
		case "swarm-drone": return spawnSwarmEnemy(pos, 2, options)
		case "fighter": return spawnShip1(
			pos,
			playerObj.pos.sub(pos).unit(),
			2,
			5,
			1,
			65,
			options
		)
		case "assassin": return spawnAssasin(pos, 3, 5, 1, options)
		case "rammer": return spawnRammer(pos, 4, options)
		case "sniper": return spawnSniper(pos, 4, options)
		case "hivemind": return spawnHiveMind(pos, options)
		case "mine-layer": return spawnMineLayer(pos, 5, options)
		case "shield-drone": {
			const target = k.get(tags.enemy).find((enemy) => enemy.exists())
			if (target) return spawnShieldDrone(pos, target, options)
			return spawnShip1(pos, playerObj.pos.sub(pos).unit(), 2, 5, 1, 65, options)
		}
		case "orbit-lancer": return spawnOrbitLancer(pos, 3, options)
		case "splitter": return spawnSplitter(pos, 7, options)
		case "siege-barge": return spawnSiegeBarge(pos, 10, options)
		case "tether-drone": return spawnTetherDrone(pos, 4, options)
		case "repair-skiff": return spawnRepairSkiff(pos, 3, options)
		case "gravity-warden": return spawnGravityWarden(pos, 6, options)
		case "phase-skirmisher": return spawnPhaseSkirmisher(pos, 5, options)
		case "salvage-scavenger": return spawnSalvageScavenger(pos, 4, options)
		case "suppressor": return spawnSuppressor(pos, 6, options)
		case "breach-crawler": return spawnBreachCrawler(pos, 8, options)
		case "wake-scrap-nipper": return spawnScrapNipper(pos, 4, options)
		case "wake-scrappers-hut": return spawnScrappersHut(pos, 18, options)
		case "wake-rivet-gunner": return spawnRivetGunner(pos, 10, options)
		case "wake-towhook-rig": return spawnTowhookRig(pos, 12, options)
		case "wake-patch-tender": return spawnPatchTender(pos, 8, options)
		case "wake-scrap-raiser": return spawnScrapRaiser(pos, 10, options)
		case "wake-clampback": return spawnClampback(pos, 14, options)
		case "wake-fuse-rat": return spawnFuseRat(pos, 8, options)
		case "wake-shredder-skiff": return spawnShredderSkiff(pos, 16, options)
		case "wake-boiler-hulk": return spawnBoilerHulk(pos, 40, options)
		case "wake-magnet-maw": return spawnMagnetMaw(pos, 48, options)
		case "wake-railbreaker-rig": return spawnRailbreakerRig(pos, 48, options)
	}
}

export function spawnThreatEncounter(
	center: Vec2,
	spacing: number,
	options: {
		allowTerrainEnemies?: boolean
		matchFloorTheme?: boolean
		tags?: string[]
		threatTier?: number
	} = {}
) {
	const threat = getThreatSnapshot()
	const tier = Math.min(5, Math.max(
		1,
		Math.floor(options.threatTier ?? threat.tier)
	))
	const progressionContext = {
		runDepth: threat.depth,
		hubLevel: getHubLevel(),
	}
	const isEnemyAvailable = (id: ProgressionEnemyId) =>
		isEnemyProgressionUnlocked(id, progressionContext)
	const normalOptions: EnemySpawnOptions = {
		persistOffscreen: true,
		tags: [...new Set([tags.runMap, tags.threatEnemy, ...(options.tags ?? [])])],
	}
	if (
		options.matchFloorTheme === true &&
		getFloorThemeIdForDepth(threat.depth) === "wake-scrap-district"
	) {
		const enemies = createWakeEncounterEnemies(
			tier,
			() => k.rand(),
			getFloorPositionForDepth(threat.depth).subfloor
		)
		for (let index = 0; index < enemies.length; index++) {
			spawnPlannedEnemy(
				enemies[index],
				formationPosition(center, spacing, index, enemies.length),
				normalOptions
			)
		}
		return `wake_floor_tier_${tier}`
	}
	const definition = selectEncounterDefinition(
		tier,
		() => k.rand(),
		options.allowTerrainEnemies === true,
		isEnemyAvailable
	)
	if (!definition) return undefined
	const eliteOptions: EnemySpawnOptions = {
		...normalOptions,
		elite: true,
	}

	switch (definition.id) {
		case "minor_swarm": {
			const count = Math.floor(k.rand(4, 11))
			for (let index = 0; index < count; index++) {
				const ring = Math.floor(index / 8)
				const ringStart = ring * 8
				const ringCount = Math.min(8, count - ringStart)
				const ringIndex = index - ringStart
				const angle = -90 + ring * 22.5 + (360 / ringCount) * ringIndex
				const pos = center.add(
					k.Vec2.fromAngle(angle).scale(spacing * (0.45 + ring * 0.35))
				)
				spawnSwarmEnemy(pos, 2, normalOptions)
			}
			return definition.id
		}
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
		case "hivemind_swarm": {
			const count = Math.max(12, scaleThreatSpawnCount(12))
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
		case "orbit_screen": {
			const count = scaleThreatSpawnCount(3)
			for (let index = 0; index < count; index++) {
				spawnOrbitLancer(
					formationPosition(center, spacing, index, count),
					3,
					normalOptions
				)
			}
			return definition.id
		}
		case "splitter_pack": {
			const count = Math.max(2, scaleThreatSpawnCount(2))
			for (let index = 0; index < count; index++) {
				spawnSplitter(
					formationPosition(center, spacing, index, count),
					7,
					normalOptions
				)
			}
			return definition.id
		}
		case "siege_line": {
			spawnSiegeBarge(center.add(0, -spacing * 0.35), 10, normalOptions)
			const escorts = scaleThreatSpawnCount(2)
			for (let index = 0; index < escorts; index++) {
				spawnOrbitLancer(
					formationPosition(center.add(0, spacing * 0.3), spacing, index, escorts),
					3,
					normalOptions
				)
			}
			return definition.id
		}
		case "tether_hunt": {
			spawnTetherDrone(center, 4, normalOptions)
			const rammers = scaleThreatSpawnCount(2)
			for (let index = 0; index < rammers; index++) {
				spawnRammer(
					formationPosition(center, spacing, index, rammers),
					4,
					normalOptions
				)
			}
			return definition.id
		}
		case "repair_column": {
			const target = spawnSiegeBarge(center, 9, normalOptions)
			spawnRepairSkiff(target.pos.add(spacing * 0.45, 0), 3, normalOptions)
			const escorts = scaleThreatSpawnCount(2)
			for (let index = 0; index < escorts; index++) {
				spawnShip1(
					formationPosition(center, spacing, index, escorts),
					playerObj.pos.sub(center).unit(),
					2,
					5,
					1,
					60,
					normalOptions
				)
			}
			return definition.id
		}
		case "gravity_lock": {
			spawnGravityWarden(center, 6, eliteOptions)
			const splitters = scaleThreatSpawnCount(2)
			for (let index = 0; index < splitters; index++) {
				spawnSplitter(
					formationPosition(center, spacing, index, splitters),
					7,
					normalOptions
				)
			}
			return definition.id
		}
		case "budgeted_response": {
			const plan = createBudgetEncounterPlan(
				tier,
				() => k.rand(),
				options.allowTerrainEnemies === true,
				isEnemyAvailable
			)
			for (let index = 0; index < plan.length; index++) {
				spawnBudgetEnemy(
					plan[index].id,
					formationPosition(center, spacing, index, plan.length),
					normalOptions
				)
			}
			return definition.id
		}
	}
}

function spawnBudgetEnemy(id: BudgetEnemyId, pos: Vec2, options: EnemySpawnOptions) {
	switch (id) {
		case "rammer": return spawnRammer(pos, 4, options)
		case "orbit-lancer": return spawnOrbitLancer(pos, 3, options)
		case "splitter": return spawnSplitter(pos, 7, options)
		case "phase-skirmisher": return spawnPhaseSkirmisher(pos, 5, options)
		case "salvage-scavenger": return spawnSalvageScavenger(pos, 4, options)
		case "siege-barge": return spawnSiegeBarge(pos, 10, options)
		case "tether-drone": return spawnTetherDrone(pos, 4, options)
		case "repair-skiff": return spawnRepairSkiff(pos, 3, options)
		case "suppressor": return spawnSuppressor(pos, 6, options)
		case "gravity-warden": return spawnGravityWarden(pos, 6, options)
		case "breach-crawler": return spawnBreachCrawler(pos, 8, options)
	}
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
