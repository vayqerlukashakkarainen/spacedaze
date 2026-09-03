import type {
	RewardDefinition,
} from "./rewardService"
import { evaluateUpgradeRequirements, getPermanentUpgradeLevel, isToolKey } from "../upg"
import { getUpgradeDefinition } from "../upgrades/upgradeRegistry"

export interface RecoveryOffer {
	id: string
	key: string
	name: string
	description: string
	sprite: string
	rarity: string
	rewardIds: string[]
	price: number
}

interface RunInventoryStack extends Omit<RecoveryOffer, "id" | "price"> {}

type InventoryReward = Pick<
	RewardDefinition,
	| "id"
	| "name"
	| "description"
	| "sprite"
	| "rarity"
	| "upgradeKey"
	| "powerupKey"
>

const activeInventory = new Map<string, RunInventoryStack>()
let recoveryOffers: RecoveryOffer[] = []

const rarityPrices: Record<string, number> = {
	COMMON: 10,
	UNCOMMON: 18,
	RARE: 30,
	EPIC: 48,
}

export function recordRunReward(reward: InventoryReward) {
	if (reward.upgradeKey === "blaster") return
	const key = reward.upgradeKey ?? reward.powerupKey ?? reward.id
	const existing = activeInventory.get(key)
	if (existing) {
		existing.rewardIds.push(reward.id)
		existing.name = reward.name
		existing.description = reward.description
		existing.sprite = reward.sprite
		existing.rarity = reward.rarity
		return
	}

	activeInventory.set(key, {
		key,
		name: reward.name,
		description: reward.description,
		sprite: reward.sprite,
		rarity: reward.rarity,
		rewardIds: [reward.id],
	})
}

export function prepareDeathRecoveryOffers() {
	const candidates = shuffle([...activeInventory.values()])
	const selected = selectDependencySafeOffers(candidates, 3)
	recoveryOffers = selected.map((stack, index) => ({
		...stack,
		id: `${stack.key}:${index}:${Date.now()}`,
		rewardIds: [...stack.rewardIds],
		price: getRecoveryPrice(stack.rarity, stack.rewardIds.length),
	}))
	activeInventory.clear()
}

function selectDependencySafeOffers(
	candidates: RunInventoryStack[],
	limit: number
) {
	const remaining = [...candidates]
	const selected: RunInventoryStack[] = []
	const recoveredLevels = new Map<string, number>()

	while (selected.length < limit) {
		const candidateIndex = remaining.findIndex((stack) =>
			stackRequirementsMet(stack, recoveredLevels)
		)
		if (candidateIndex < 0) break

		const [stack] = remaining.splice(candidateIndex, 1)
		selected.push(stack)
		const recoveredLevel = getRecoveredUpgradeLevel(stack)
		if (recoveredLevel !== undefined) {
			recoveredLevels.set(stack.key, recoveredLevel)
		}
	}

	return selected
}

function stackRequirementsMet(
	stack: RunInventoryStack,
	recoveredLevels: ReadonlyMap<string, number>
) {
	if (!isToolKey(stack.key)) return true
	const definition = getUpgradeDefinition(stack.key)
	if (!definition) return false
	return evaluateUpgradeRequirements(definition, (toolKey) => {
		const recoveredLevel = recoveredLevels.get(toolKey)
		if (recoveredLevel !== undefined) return recoveredLevel
		return isToolKey(toolKey)
			? getPermanentUpgradeLevel(toolKey)
			: undefined
	}).met
}

function getRecoveredUpgradeLevel(stack: RunInventoryStack) {
	let highestLevel: number | undefined
	for (const rewardId of stack.rewardIds) {
		const match = /^upgrade:[^:]+:(\d+)$/.exec(rewardId)
		if (!match) continue
		const level = Number(match[1]) - 1
		if (!Number.isInteger(level) || level < 0) continue
		highestLevel = Math.max(highestLevel ?? -1, level)
	}
	return highestLevel
}

export function getRecoveryOffers(): RecoveryOffer[] {
	return recoveryOffers.map((offer) => ({
		...offer,
		rewardIds: [...offer.rewardIds],
	}))
}

export function consumeRecoveryOffer(id: string) {
	recoveryOffers = recoveryOffers.filter((offer) => offer.id !== id)
}

export function clearRecoveryOffers() {
	recoveryOffers = []
}

export function clearRunInventory() {
	activeInventory.clear()
}

function getRecoveryPrice(rarity: string, count: number) {
	const basePrice = rarityPrices[rarity] ?? rarityPrices.COMMON
	return basePrice + Math.max(0, count - 1) * Math.ceil(basePrice * 0.6)
}

function shuffle<T>(values: T[]): T[] {
	for (let index = values.length - 1; index > 0; index--) {
		const swapIndex = Math.floor(Math.random() * (index + 1))
		const current = values[index]
		values[index] = values[swapIndex]
		values[swapIndex] = current
	}
	return values
}
