import type {
	AbilityId,
	AbilityLoadout,
	AbilitySlot,
} from "./abilityLoadoutService"
import { getAbilityDefinition } from "./abilityRegistry"
import { getHubLevel } from "./hubProgressService"
import {
	RUN_LEVEL_BONUSES,
} from "./runLevelService"
import {
	getRewardDefinitions,
	getAllRewardDefinitions,
	getRewardMinimumHubLevel,
	rollDropReward,
	rollMapEventReward,
	rollCrateRewardChoices,
	type Reward,
	type RewardAvailabilityContext,
	type SyntheticRewardState,
} from "./rewardService"
import {
	finishRunTelemetry,
	formatRewardTelemetrySummary,
	getActiveRunTelemetry,
	getRunTelemetryRecords,
	recordTelemetryChestResult,
	recordTelemetryEnemyKill,
	recordTelemetryEnemySpawn,
	recordTelemetryFloor,
	recordTelemetryPlayerDamage,
	recordTelemetryRewardOffered,
	recordTelemetryRewardSelected,
	recordTelemetrySalvageEarned,
	sampleRunTelemetry,
	startRunTelemetry,
} from "./runTelemetryService"
import type { ToolKey } from "../upg"
import { getUpgradeDefinition } from "../upgrades/upgradeRegistry"
import { REWARD_RARITY_ORDER } from "./rewardQualityService"
import {
	createSimulatedEncounterEnemies,
	selectEncounterDefinition,
} from "./enemyEncounterCatalogService"
import {
	isEnemyProgressionUnlocked,
	type ProgressionEnemyId,
} from "./enemyProgressionService"

interface SimulationOptions {
	runCount: number
	seed: number
	levelUpsPerRun: number
	chestsPerRun: number
	profile: string
	hubLevel: number
	targetDepth: number
}

interface SyntheticChoice {
	id: string
	familyId: string
	rarity: string
	category: string
}

interface MutableSyntheticState extends SyntheticRewardState {
	discoveredAbilityIds: Set<AbilityId>
	upgradeLevels: Partial<Record<ToolKey, number>>
	abilityRarities: Partial<Record<AbilityId, string>>
	loadout: AbilityLoadout
	hasStandardDrone: boolean
}

export function simulateSyntheticRuns(options: Partial<SimulationOptions> = {}) {
	if (getActiveRunTelemetry()) {
		return "Cannot simulate while a live run is active"
	}
	const targetDepth = clampInteger(options.targetDepth ?? 4, 1, 20)
	const config: SimulationOptions = {
		runCount: clampInteger(options.runCount ?? 25, 1, 100),
		seed: normalizeSeed(options.seed ?? Date.now()),
		levelUpsPerRun: clampInteger(options.levelUpsPerRun ?? targetDepth * 2, 0, 50),
		chestsPerRun: clampInteger(options.chestsPerRun ?? targetDepth, 0, 100),
		profile: options.profile ?? "mixed",
		hubLevel: clampInteger(options.hubLevel ?? getHubLevel(), 1, 20),
		targetDepth,
	}
	const random = createSeededRandom(config.seed)
	for (let runIndex = 0; runIndex < config.runCount; runIndex++) {
		const state = createSyntheticState()
		startRunTelemetry({
			zoneId: "simulation",
			poolId: "synthetic",
			baseSeed: config.seed,
			levelKey: "synthetic",
			mapSeed: Math.floor(random() * 0xffffffff),
			contractName: "SYNTHETIC EXPEDITION",
			hubLevel: config.hubLevel,
			loadout: { ...state.loadout },
			upgrades: { ...state.upgradeLevels },
			synthetic: {
				profile: config.profile,
				seed: config.seed,
				index: runIndex,
				modelVersion: 2,
				targetDepth: config.targetDepth,
				requestedHubLevel: config.hubLevel,
			},
		})
		const combat = config.profile === "chests"
			? { outcome: "EXTRACTED" as const, reachedDepth: config.targetDepth }
			: simulateCombat(config, random, state)
		const completion = combat.reachedDepth / config.targetDepth
		simulateChests(
			Math.round(config.chestsPerRun * completion),
			random,
			config.hubLevel,
			state
		)
		simulateLevelUps(
			Math.round(config.levelUpsPerRun * completion),
			state,
			random
		)
		const earnedDebree = getActiveRunTelemetry()?.economy.salvageEarned ?? 0
		finishRunTelemetry(combat.outcome, {
			deposited: combat.outcome === "EXTRACTED" ? earnedDebree : 0,
			lost: combat.outcome === "DESTROYED" ? earnedDebree : 0,
		})
	}

	return [
		`Generated ${config.runCount} synthetic ${config.profile} run${config.runCount === 1 ? "" : "s"}`,
		`Seed ${config.seed} | Hub ${config.hubLevel} | target depth ${config.targetDepth}`,
		`${config.levelUpsPerRun} level-ups/run | ${config.chestsPerRun} chests/run at full completion`,
		formatRewardTelemetrySummary(),
	].join("\n")
}

export function formatSyntheticRewardDiversity() {
	const records = getRunTelemetryRecords().filter((record) => record.context.synthetic)
	if (records.length === 0) return "No synthetic reward telemetry recorded"
	const offered = new Set<string>()
	const selected = new Set<string>()
	const sourceOffers: Record<string, Set<string>> = {}
	let debreeEarned = 0
	let debreeDeposited = 0
	let debreeLost = 0
	let maxHubLevel = 1
	for (const record of records) {
		maxHubLevel = Math.max(maxHubLevel, record.context.hubLevel)
		debreeEarned += record.economy.salvageEarned
		debreeDeposited += record.economy.salvageDeposited
		debreeLost += record.economy.salvageLost
		for (const event of record.rewards.events ?? []) {
			const family = event.familyId || event.rewardId
			if (event.type === "OFFERED") {
				offered.add(family)
				const source = event.source ?? "unknown"
				sourceOffers[source] ??= new Set<string>()
				sourceOffers[source].add(family)
			} else {
				selected.add(family)
			}
		}
	}

	const expected = new Set<string>(
		RUN_LEVEL_BONUSES.map((bonus) => `runBonus:${bonus.id}`)
	)
	for (const source of ["crate", "enemy", "boss"] as const) {
		for (const definition of getAllRewardDefinitions(source)) {
			if (getRewardMinimumHubLevel(definition) > maxHubLevel) continue
			if ((definition.weights[source] ?? 0) <= 0) continue
			expected.add(rewardFamily(definition.id))
		}
	}
	const missing = [...expected].filter((family) => !offered.has(family)).sort()
	const unselected = [...offered].filter((family) => !selected.has(family)).sort()
	const sourceSummary = Object.entries(sourceOffers)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([source, families]) => `${source} ${families.size}`)
		.join(" | ")
	return [
		`${records.length} synthetic runs | ${offered.size}/${expected.size} reward families appeared | ${selected.size} collected`,
		`Sources: ${sourceSummary || "none"}`,
		`Debree: ${Math.round(debreeEarned)} earned | ${Math.round(debreeDeposited)} extracted | ${Math.round(debreeLost)} lost`,
		`Never appeared (${missing.length}): ${missing.slice(0, 18).join(", ") || "none"}${missing.length > 18 ? `, +${missing.length - 18} more` : ""}`,
		`Appeared but not collected (${unselected.length}): ${unselected.slice(0, 18).join(", ") || "none"}${unselected.length > 18 ? `, +${unselected.length - 18} more` : ""}`,
	].join("\n")
}

function simulateLevelUps(
	count: number,
	state: MutableSyntheticState,
	random: () => number
) {
	const passiveBag = createBag(
		RUN_LEVEL_BONUSES.map((bonus) => bonus.id),
		random
	)
	for (let index = 0; index < count; index++) {
		const specialPool = getSyntheticSpecialPool(state)
		const specialBag = createBag(
			specialPool.map((choice) => choice.familyId),
			random
		)
		const runLevel = index + 2
		const choices: SyntheticChoice[] = passiveBag.draw(specialPool.length > 0 ? 2 : 3)
			.flatMap((id) => {
				const bonus = RUN_LEVEL_BONUSES.find((candidate) => candidate.id === id)
				return bonus ? [{
					id: `runBonus:${bonus.id}`,
					familyId: `runBonus:${bonus.id}`,
					rarity: bonus.rarity,
					category: "generic",
				}] : []
			})
		const specialFamily = specialPool.length === 1 && index % 2 === 1
			? undefined
			: specialBag.draw(1)[0]
		const special = specialPool.find((choice) => choice.familyId === specialFamily)
		if (special) choices.push(special)

		for (const choice of choices) {
			recordTelemetryRewardOffered(choice.id, {
				source: "level-up",
				category: choice.category,
				familyId: choice.familyId,
				rarity: choice.rarity,
				runLevel,
				candidatePoolSize: choice.category === "generic"
					? RUN_LEVEL_BONUSES.length
					: specialPool.length,
			})
		}
		const selected = pick(choices, random)
		if (selected) {
			recordTelemetryRewardSelected(selected.id, selected.rarity, false, {
				source: "level-up",
				category: selected.category,
				familyId: selected.familyId,
				runLevel,
			})
			applySyntheticChoice(selected, state)
		}
	}
}

function simulateChests(
	count: number,
	random: () => number,
	hubLevel: number,
	state: MutableSyntheticState
) {
	const discoveredIds: string[] = []
	for (let index = 0; index < count; index++) {
		const context = createRewardContext(hubLevel, state)
		const successfulHits = Math.floor(random() * 4)
		const failedAttempts = random() < 0.2 ? 1 : 0
		const result = rollCrateRewardChoices(
			successfulHits,
			failedAttempts,
			discoveredIds,
			random,
			hubLevel,
			context
		)
		const candidatePoolSize = getRewardDefinitions("crate", context).filter(
			(reward) => !discoveredIds.includes(reward.id)
		).length
		for (const reward of result.rewards) {
			recordSyntheticChestOffer(reward, candidatePoolSize)
		}
		for (const discovery of result.discoveries) {
			if (discoveredIds.includes(discovery.id)) continue
			discoveredIds.push(discovery.id)
			collectSyntheticReward(discovery, "chest", state, false)
		}
		const selected = pick(result.choices, random)
		if (selected) {
			collectSyntheticReward(selected, "chest", state, false)
		}
		recordTelemetryChestResult(
			"synthetic",
			result.failures,
			result.failures === 0
		)
	}
}

function simulateCombat(
	config: SimulationOptions,
	random: () => number,
	state: MutableSyntheticState
) {
	const maxHull = 3 + Math.floor((config.hubLevel - 1) / 2)
	let remainingHull = maxHull
	let reachedDepth = 0
	for (let depth = 1; depth <= config.targetDepth; depth++) {
		reachedDepth = depth
		const floorSeconds = 95 + random() * 145
		const tier = Math.min(5, Math.floor((floorSeconds + (depth - 1) * 12) / 75) + 1)
		recordTelemetryFloor(depth, "synthetic", Math.floor(random() * 0xffffffff), tier)
		sampleRunTelemetry(1 / 60, { tier } as never)
		const available = (id: ProgressionEnemyId) => isEnemyProgressionUnlocked(id, {
			runDepth: depth,
			hubLevel: config.hubLevel,
		})
		for (let encounter = 0; encounter < 3 + depth; encounter++) {
			const definition = selectEncounterDefinition(tier, random, true, available)
			if (!definition) continue
			const enemies = createSimulatedEncounterEnemies(definition, tier, random, available)
			for (const enemy of enemies) {
				const elite = random() < [0, 0.04, 0.08, 0.15, 0.24, 0.34][tier]
				recordTelemetryEnemySpawn(enemy, elite)
				const killChance = clamp(0.93 + config.hubLevel * 0.018 - tier * 0.055, 0.48, 0.97)
				const killed = random() < killChance
				if (killed) {
					recordTelemetryEnemyKill(enemy, elite, 4 + random() * 18)
					recordTelemetrySalvageEarned(getEnemyDebreeValue(enemy, elite))
					const reward = rollDropReward(
						"enemy",
						elite ? 1.5 : 1,
						random,
						createRewardContext(config.hubLevel, state)
					)
					if (reward) collectSyntheticReward(reward, "enemy-drop", state)
				}
				const damage = getEnemyDamagePressure(enemy) * tier *
					(0.55 + random() * 0.9) *
					Math.max(0.35, 1 - (config.hubLevel - 1) * 0.055) *
					(elite ? 1.35 : 1)
				if (random() < 0.42) {
					remainingHull -= damage
					recordTelemetryPlayerDamage(damage, enemy)
				}
				if (remainingHull <= 0) return { outcome: "DESTROYED" as const, reachedDepth }
			}
		}
		simulateWorldRewards(depth, config.hubLevel, random, state)
		if (depth >= 2 && (depth % 3 === 0 || random() < 0.35)) {
			recordTelemetryEnemySpawn("impact-ace", true)
			recordTelemetryEnemyKill("impact-ace", true, 18 + random() * 12)
			recordTelemetrySalvageEarned(18 + depth * 2)
			const bossReward = rollDropReward(
				"boss",
				1 + depth * 0.15,
				random,
				createRewardContext(config.hubLevel, state)
			)
			if (bossReward) collectSyntheticReward(bossReward, "boss-drop", state)
		}
		remainingHull = Math.min(maxHull, remainingHull + 0.5)
	}
	return { outcome: "EXTRACTED" as const, reachedDepth }
}

function getEnemyDamagePressure(id: ProgressionEnemyId) {
	const pressure: Partial<Record<ProgressionEnemyId, number>> = {
		"swarm-drone": 0.08, fighter: 0.2, assassin: 0.28, rammer: 0.42,
		sniper: 0.36, hivemind: 0.04, "mine-layer": 0.3, "shield-drone": 0.03,
		"orbit-lancer": 0.24, splitter: 0.22, "siege-barge": 0.48,
		"tether-drone": 0.25, "repair-skiff": 0.04, "gravity-warden": 0.38,
		"phase-skirmisher": 0.3, "salvage-scavenger": 0.1,
		suppressor: 0.25, "breach-crawler": 0.36,
	}
	return pressure[id] ?? 0.2
}

function recordSyntheticChestOffer(reward: Reward, candidatePoolSize: number) {
	recordTelemetryRewardOffered(reward.id, {
		source: "chest",
		category: reward.kind,
		rarity: reward.rarity,
		candidatePoolSize,
	})
}

function createSyntheticState(): MutableSyntheticState {
	return {
		discoveredAbilityIds: new Set<AbilityId>(["standardBlaster"]),
		upgradeLevels: {},
		abilityRarities: { standardBlaster: "COMMON" },
		loadout: { primary: "standardBlaster" },
		hasStandardDrone: false,
	}
}

function createRewardContext(
	hubLevel: number,
	state: MutableSyntheticState
): RewardAvailabilityContext {
	return { hubLevel, syntheticState: state }
}

function collectSyntheticReward(
	reward: Reward,
	source: "chest" | "enemy-drop" | "boss-drop" | "secret" | "challenge",
	state: MutableSyntheticState,
	recordOffer = true
) {
	const discovery = reward.abilityId !== undefined &&
		!state.discoveredAbilityIds.has(reward.abilityId)
	if (recordOffer) {
		recordTelemetryRewardOffered(reward.id, {
			source,
			category: reward.kind,
			rarity: reward.rarity,
		})
	}
	recordTelemetryRewardSelected(reward.id, reward.rarity, discovery, {
		source,
		category: reward.kind,
	})
	if (reward.abilityId && reward.abilitySlot) {
		state.discoveredAbilityIds.add(reward.abilityId)
		state.abilityRarities[reward.abilityId] = reward.rarity
		state.loadout = { ...state.loadout, [reward.abilitySlot]: reward.abilityId }
		if (reward.abilitySlot === "secondary") {
			state.equippedActiveModuleId = reward.abilityId as MutableSyntheticState["equippedActiveModuleId"]
		}
	}
	if (reward.upgradeKey !== undefined && reward.levelIndex !== undefined) {
		state.upgradeLevels[reward.upgradeKey as ToolKey] = reward.levelIndex
	}
	if (reward.id === "addFollower") state.hasStandardDrone = true
}

function applySyntheticChoice(
	choice: SyntheticChoice,
	state: MutableSyntheticState
) {
	if (choice.category === "abilityTier") {
		const abilityId = choice.familyId.slice("abilityTier:".length) as AbilityId
		state.abilityRarities[abilityId] = choice.rarity
		return
	}
	if (choice.category !== "upgrade") return
	const key = choice.familyId.slice("upgrade:".length) as ToolKey
	state.upgradeLevels[key] = (state.upgradeLevels[key] ?? -1) + 1
}

function simulateWorldRewards(
	depth: number,
	hubLevel: number,
	random: () => number,
	state: MutableSyntheticState
) {
	const context = createRewardContext(hubLevel, state)
	const secretCount = 1 + Math.floor(random() * 2)
	for (let index = 0; index < secretCount; index++) {
		recordTelemetrySalvageEarned(3 + Math.floor(random() * 5))
		if (random() < 0.16) {
			const token = getAllRewardDefinitions("enemy", context)
				.find((reward) => reward.id === "rerollToken")
			if (token) collectSyntheticReward(token, "secret", state)
		}
		const reward = rollMapEventReward(
			1 + Math.floor(random() * 3),
			random,
			context
		)
		if (reward) collectSyntheticReward(reward, "secret", state)
	}

	const challengeRewards = depth % 2 === 0 ? 2 : 1
	for (let index = 0; index < challengeRewards; index++) {
		const reward = rollMapEventReward(2, random, context)
		if (reward) collectSyntheticReward(reward, "challenge", state)
	}
	if (random() < 0.15) {
		const token = getAllRewardDefinitions("enemy", context)
			.find((reward) => reward.id === "rerollToken")
		if (token) collectSyntheticReward(token, "challenge", state)
	}
}

function getEnemyDebreeValue(id: ProgressionEnemyId, elite: boolean) {
	const values: Partial<Record<ProgressionEnemyId, number>> = {
		"swarm-drone": 2,
		fighter: 3,
		assassin: 4,
		rammer: 4,
		sniper: 5,
		hivemind: 10,
		"mine-layer": 6,
		"shield-drone": 5,
		"siege-barge": 10,
		"repair-skiff": 4,
		"salvage-scavenger": 3,
	}
	return Math.round((values[id] ?? 4) * (elite ? 1.5 : 1))
}

function getSyntheticSpecialPool(state: MutableSyntheticState): SyntheticChoice[] {
	const choices: SyntheticChoice[] = []
	for (const [rawKey, currentLevel] of Object.entries(state.upgradeLevels)) {
		const key = rawKey as ToolKey
		if (currentLevel === undefined) continue
		const nextLevel = currentLevel + 1
		const definition = getUpgradeDefinition(key)
		if (!definition?.levels[nextLevel]?.effects.modifiers?.length) continue
		choices.push({
			id: `upgrade:${key}:${nextLevel + 1}`,
			familyId: `upgrade:${key}`,
			rarity: definition.reward?.rarity ?? "COMMON",
			category: "upgrade",
		})
	}

	for (const slot of ["primary", "secondary", "mobility", "ultimate"] as AbilitySlot[]) {
		const abilityId = state.loadout[slot] as AbilityId | undefined
		if (!abilityId) continue
		const ability = getAbilityDefinition(abilityId)
		const currentRarity = state.abilityRarities[abilityId] ?? "COMMON"
		const currentRank = REWARD_RARITY_ORDER.indexOf(currentRarity as never)
		const rarity = REWARD_RARITY_ORDER[currentRank + 1]
		if (!ability || !rarity) continue
		choices.push({
			id: `abilityTier:${abilityId}:${rarity}`,
			familyId: `abilityTier:${abilityId}`,
			rarity,
			category: "abilityTier",
		})
	}
	return choices
}

function createBag(ids: readonly string[], random: () => number) {
	let bag: string[] = []
	let previous: string[] = []
	return {
		draw(count: number) {
			const selected: string[] = []
			while (selected.length < count && ids.length > 0) {
				if (bag.length === 0) {
					const recent = new Set(previous)
					bag = [
						...shuffle(ids.filter((id) => !recent.has(id)), random),
						...shuffle(ids.filter((id) => recent.has(id)), random),
					]
				}
				const next = bag.shift()
				if (next && !selected.includes(next)) selected.push(next)
			}
			previous = selected
			return selected
		},
	}
}

function shuffle<T>(values: readonly T[], random: () => number) {
	const result = [...values]
	for (let index = result.length - 1; index > 0; index--) {
		const swapIndex = Math.floor(random() * (index + 1))
		const current = result[index]
		result[index] = result[swapIndex]
		result[swapIndex] = current
	}
	return result
}

function pick<T>(values: readonly T[], random: () => number) {
	return values[Math.floor(random() * values.length)]
}

function createSeededRandom(seed: number) {
	let state = seed >>> 0
	return () => {
		state += 0x6d2b79f5
		let value = state
		value = Math.imul(value ^ value >>> 15, value | 1)
		value ^= value + Math.imul(value ^ value >>> 7, value | 61)
		return ((value ^ value >>> 14) >>> 0) / 4294967296
	}
}

function clampInteger(value: number, min: number, max: number) {
	if (!Number.isFinite(value)) return min
	return Math.max(min, Math.min(max, Math.floor(value)))
}

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value))
}

function normalizeSeed(value: number) {
	if (!Number.isFinite(value)) return 1
	return Math.max(1, Math.floor(Math.abs(value)) % 0x80000000)
}

function rewardFamily(id: string) {
	const upgrade = /^(upgrade:[^:]+):\d+$/.exec(id)
	return upgrade ? upgrade[1] : id
}
