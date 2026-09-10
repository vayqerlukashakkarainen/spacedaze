import type { Vec2 } from "kaplay"
import { k } from "../../main"
import { saveGame } from "../../util"
import { spawnRewardPickup } from "../../spawn/spawnPowerup"
import {
	equipAbilityInSlot,
	getEquippedAbilityId,
	type AbilityId,
	type AbilitySlot,
} from "./abilityLoadoutService"
import {
	createReward,
	REWARD_RARITY_COLORS,
	type Reward,
} from "../economy/rewardService"
import { getAbilityDefinition } from "./abilityRegistry"
import { getAbilityTierRarity } from "./abilityTierService"
import { showPopover } from "../ui/popoverService"
import { equipWeapon } from "../player/weaponService"
import type { NpcInteractionPromptPool } from "../../ui/common"

export function equipAbilityWithWorldDrop(
	slot: AbilitySlot,
	abilityId: AbilityId,
	position: Vec2
) {
	const previousAbilityId = getEquippedAbilityId(slot)
	if (previousAbilityId === abilityId) return true
	if (!equipDirectly(slot, abilityId)) return false
	if (slot === "primary") {
		saveGame("slot1")
		return true
	}

	if (previousAbilityId) {
		spawnDroppedAbility(slot, previousAbilityId, position)
	}
	saveGame("slot1")
	return true
}

export function spawnAbilityLoadoutPickup(
	slot: AbilitySlot,
	abilityId: AbilityId,
	position: Vec2,
	interactionPromptPool?: NpcInteractionPromptPool
) {
	const definition = getAbilityDefinition(abilityId)
	if (!definition) return
	const rarity = getAbilityTierRarity(abilityId, definition.rarity)
	const reward = createReward(getRewardId(slot, abilityId), rarity)
	if (!reward) return

	return spawnRewardPickup(position, reward, {
		compactAura: true,
		interactionOnly: true,
		interactionRadius: 30,
		interactionPromptStyle: "key",
		interactionPromptPool,
		persistent: true,
		stationary: true,
		suppressAcquisition: true,
		applyEffect: () => equipAbilityFromRange(slot, abilityId),
	})
}

function spawnDroppedAbility(
	slot: AbilitySlot,
	abilityId: AbilityId,
	position: Vec2
) {
	const definition = getAbilityDefinition(abilityId)
	if (!definition) return
	const rarity = getAbilityTierRarity(abilityId, definition.rarity)
	const reward = createReward(getRewardId(slot, abilityId), rarity)
	if (!reward) return

	spawnRewardPickup(position.clone(), reward, {
		interactionOnly: true,
		suppressAcquisition: true,
		applyEffect: (droppedReward, pickupPos) =>
			equipDroppedReward(droppedReward, pickupPos),
	})
}

function equipDroppedReward(reward: Reward, position: Vec2) {
	if (!reward.abilityId || !reward.abilitySlot) return false
	return equipAbilityWithWorldDrop(
		reward.abilitySlot,
		reward.abilityId,
		position
	)
}

function equipDirectly(slot: AbilitySlot, abilityId: AbilityId) {
	if (slot === "primary") return equipWeapon(abilityId as Parameters<typeof equipWeapon>[0])
	equipAbilityInSlot(slot, abilityId)
	return true
}

function equipAbilityFromRange(slot: AbilitySlot, abilityId: AbilityId) {
	if (!equipDirectly(slot, abilityId)) return false
	saveGame("slot1")
	const definition = getAbilityDefinition(abilityId)
	if (definition) {
		const rarity = getAbilityTierRarity(abilityId, definition.rarity)
		showPopover({
			title: `${slot.toUpperCase()} EQUIPPED`,
			message: definition.name,
			sprite: definition.icon,
			color: k.rgb(...REWARD_RARITY_COLORS[rarity]),
			duration: 2.4,
		})
	}
	return true
}

function getRewardId(slot: AbilitySlot, abilityId: AbilityId) {
	if (slot === "primary") return `weapon:${abilityId}`
	if (slot === "secondary") return `active:${abilityId}`
	return `${slot}:${abilityId}`
}
