import type { GameObj } from "kaplay"
import { k, layers } from "../main"
import { loadPlayer } from "../player"
import {
	getEffectiveUpgradeRarity,
	getNextRunUpgradeLevel,
	isPermanentUpgradeKey,
	levelLoadout,
	type ToolKey,
} from "../upg"
import {
	applyReward,
	createDirectUpgradeReward,
	REWARD_RARITY_COLORS,
	type Reward,
} from "../services/rewardService"
import {
	consumeRunLevelSelection,
	drawRunLevelOfferIds,
	getAvailableRunLevelBonuses,
	getRunLevelBonusValue,
	getRunLevelSnapshot,
	grantRunLevelBonus,
	rollRunLevelBonusRarity,
	type RunLevelBonusDefinition,
} from "../services/runLevelService"
import { tags } from "../tags"
import { addCollectedPowerup } from "./gameUi"
import { uiState } from "./uiState"
import {
	addThemedText,
	createAbilitySlotMarker,
	createInputPromptRow,
	createUiBadge,
	createUiPanel,
	createUiSelectableCard,
	createUiStatList,
	formatTieredTextValues,
	type UiStatRow,
	playUiModalOpen,
	UI_COLORS,
	UI_FONT_SIZES,
} from "./common"
import { playUiClickSound, playUiHoverSound } from "../services/uiSoundService"
import { getUpgradeDefinition } from "../upgrades/upgradeRegistry"
import {
	getAbilityLoadout,
	type AbilityId,
	type AbilitySlot,
} from "../services/abilityLoadoutService"
import {
	getAbilityTierValues,
	getNextAbilityTierRarity,
	registerAbilityTier,
	rollAbilityTierState,
	type AbilityTierState,
} from "../services/abilityTierService"
import {
	getAbilityDefinition,
	type AbilityDefinition,
} from "../services/abilityRegistry"
import {
	recordTelemetryRewardOffered,
	recordTelemetryRewardSelected,
	type RewardTelemetryDetails,
} from "../services/runTelemetryService"
import { getRewardStatComparisonRows } from "./rewardStatComparison"

type RunLevelChoice =
	| { kind: "generic"; bonus: RunLevelBonusDefinition; candidatePoolSize: number }
	| { kind: "upgrade"; reward: Reward; candidatePoolSize: number }
	| {
		kind: "abilityTier"
		ability: AbilityDefinition
		tier: AbilityTierState
		candidatePoolSize: number
	}

interface RunLevelChoiceDetails {
	name: string
	description: string
	stats: readonly UiStatRow[]
	sprite: string
	rarity: Reward["rarity"]
	slot?: AbilitySlot
}

let isOpen = false
let selectionLocked = false
let selectionArmed = false

const SELECTION_INPUT_SETTLE_DURATION = 0.3

export function showRunLevelChoice() {
	const snapshot = getRunLevelSnapshot()
	if (
		isOpen ||
		!snapshot.active ||
		snapshot.pendingSelections <= 0 ||
		uiState.modalOpen
	) return false

	const choices = createRunLevelChoices()
	if (choices.length === 0) {
		consumeRunLevelSelection()
		return false
	}
	recordRunLevelOffers(choices, snapshot.level)

	isOpen = true
	selectionLocked = false
	selectionArmed = false
	uiState.modalOpen = true
	pauseGameObjects(true)
	renderRunLevelChoice(choices, snapshot.level)
	return true
}

export function runLevelChoiceOpen() {
	return isOpen
}

export function hideRunLevelChoice() {
	if (!isOpen) return
	k.destroyAll(tags.runLevelChoice)
	uiState.modalOpen = false
	uiState.isOverUI = false
	pauseGameObjects(false)
	isOpen = false
	selectionLocked = false
	selectionArmed = false
}

function renderRunLevelChoice(choices: RunLevelChoice[], level: number) {
	const panelWidth = Math.min(900, k.width() - 40)
	const panelHeight = Math.min(500, k.height() - 24)
	const center = k.center()
	const backdrop = k.add([
		k.rect(k.width(), k.height()),
		k.pos(0, 0),
		k.color(k.BLACK),
		k.opacity(0.8),
		k.animate(),
		k.fixed(),
		k.layer(layers.uiEffects),
		tags.runLevelChoice,
	])
	const panel = createUiPanel({
		pos: center,
		size: k.vec2(panelWidth, panelHeight),
		anchor: "center",
		layer: layers.uiEffects,
		tags: [tags.runLevelChoice],
		animated: true,
	})
	playUiModalOpen(backdrop, panel, {
		panelPos: center,
		backdropOpacity: 0.8,
	})

	panel.add([
		k.text("RUN LEVEL INCREASED", {
			size: UI_FONT_SIZES.display,
			font: "unscii",
		}),
		k.pos(0, -panelHeight / 2 + 30),
		k.anchor("center"),
		k.color(...UI_COLORS.text),
	])
	const selectionInstruction = panel.add([
		k.text(`LEVEL ${level}  //  SELECT ONE`, {
			size: UI_FONT_SIZES.small,
			font: "unscii",
		}),
		k.pos(0, -panelHeight / 2 + 58),
		k.anchor("center"),
		k.color(...UI_COLORS.accent),
	])
	selectionInstruction.text = `LEVEL ${level}  //  RELEASE FIRE TO SELECT`
	let releasedDuration = 0
	panel.onUpdate(() => {
		if (selectionArmed) return
		if (k.isMouseDown("left")) {
			releasedDuration = 0
			return
		}
		releasedDuration += k.dt()
		if (releasedDuration < SELECTION_INPUT_SETTLE_DURATION) return
		selectionArmed = true
		selectionInstruction.text = `LEVEL ${level}  //  SELECT ONE`
	})

	const gap = 14
	const cardWidth = Math.min(
		264,
		(panelWidth - 52 - gap * (choices.length - 1)) / choices.length
	)
	const cardHeight = panelHeight - 104
	const rowWidth = cardWidth * choices.length + gap * (choices.length - 1)
	const selectionControllers: { cancel: () => void }[] = []
	for (let index = 0; index < choices.length; index++) {
		const choice = choices[index]
		const details = getChoiceDetails(choice)
		const color = REWARD_RARITY_COLORS[details.rarity]
		const x = -rowWidth / 2 + cardWidth / 2 + index * (cardWidth + gap)
		const cardControl = createUiSelectableCard(panel, {
			pos: k.vec2(x - cardWidth / 2, 37 - cardHeight / 2),
			size: k.vec2(cardWidth, cardHeight),
			onClick: () => selectRunLevelChoice(choice),
		})
		const card = cardControl.obj
		card.add([
			k.sprite(details.sprite, { width: 54, height: 54 }),
			k.pos(cardWidth / 2, 60),
			k.anchor("center"),
			k.color(...color),
			k.z(3),
		])
		const badgeWidth = Math.min(cardWidth - 24, 112)
		createUiBadge(card, {
			pos: k.vec2((cardWidth - badgeWidth) / 2, 10),
			width: badgeWidth,
			text: details.rarity,
			color,
		})
		addThemedText(card, {
			text: details.name,
			pos: k.vec2(12, 102),
			variant: "heading",
			size: UI_FONT_SIZES.body,
			width: cardWidth - 24,
			align: "center",
			lineHeight: 1.45,
			color: k.rgb(...color),
			z: 3,
		})
		const descriptionTop = 148
		const description = addThemedText(card, {
			text: formatTieredTextValues(details.description),
			pos: k.vec2(14, descriptionTop),
			variant: "body",
			size: UI_FONT_SIZES.small,
			width: cardWidth - 28,
			align: "center",
			lineHeight: 1.4,
			color: k.WHITE,
			styles: {
				value: {
					color: k.rgb(...color),
					override: true,
				},
			},
			z: 3,
		})
		const statTop = Math.max(
			Math.min(240, cardHeight - 128),
			Math.ceil(descriptionTop + description.height + 12)
		)
		createUiStatList(card, {
			pos: k.vec2(16, statTop),
			width: cardWidth - 32,
			rows: details.stats.slice(0, 4),
			rowHeight: 19,
			wrapLongRows: true,
		})
		if (details.slot) {
			createAbilitySlotMarker(card, {
				pos: k.vec2(cardWidth / 2, cardHeight),
				slot: details.slot,
				color,
			})
		}
		createInputPromptRow(card, {
			pos: k.vec2(cardWidth / 2, cardHeight - 40),
			prompts: [{
				action: `select${index + 1}` as "select1" | "select2" | "select3",
				label: "TO SELECT",
			}],
			color: UI_COLORS.accent,
		})
		card.onHover(playUiHoverSound)
		selectionControllers.push(
			k.onKeyPress(`${index + 1}`, () => selectRunLevelChoice(choice))
		)
	}
	panel.onDestroy(() => {
		for (const controller of selectionControllers) controller.cancel()
	})
}

function selectRunLevelChoice(choice: RunLevelChoice) {
	if (!selectionArmed || selectionLocked) return
	selectionLocked = true
	let applied = false
	const runLevel = getRunLevelSnapshot().level
	if (choice.kind === "generic") {
		applied = grantRunLevelBonus(choice.bonus.id, choice.bonus.rarity)
		if (applied) {
			loadPlayer()
			recordTelemetryRewardSelected(
				`runBonus:${choice.bonus.id}`,
				choice.bonus.rarity,
				false,
				getChoiceTelemetryDetails(choice, runLevel)
			)
		}
	} else if (choice.kind === "upgrade") {
		applied = applyReward(choice.reward, k.center())
		if (applied) {
			addCollectedPowerup(
				choice.reward,
				getChoiceTelemetryDetails(choice, runLevel)
			)
		}
	} else {
		applied = registerAbilityTier(choice.tier)
		if (applied) {
			recordTelemetryRewardSelected(
				`abilityTier:${choice.ability.id}:${choice.tier.rarity}`,
				choice.tier.rarity,
				false,
				getChoiceTelemetryDetails(choice, runLevel)
			)
		}
	}
	if (!applied) {
		selectionLocked = false
		return
	}

	consumeRunLevelSelection()
	playUiClickSound()
	hideRunLevelChoice()
}

function createRunLevelChoices(): RunLevelChoice[] {
	const availableBonuses = getAvailableRunLevelBonuses()
	const specialCandidates = [
		...getOwnedUpgradeChoices(),
		...getAbilityTierChoices(),
	]
	const specialFamilyId = drawRunLevelOfferIds(
		"special",
		specialCandidates.map(getChoiceFamilyId),
		1,
		Math.random,
		false
	)[0]
	const special = specialCandidates.find(
		(choice) => getChoiceFamilyId(choice) === specialFamilyId
	)
	const genericCount = special ? 2 : 3
	const genericIds = drawRunLevelOfferIds(
		"passive",
		availableBonuses.map((bonus) => bonus.id),
		genericCount
	)
	const choices: RunLevelChoice[] = genericIds.flatMap((id) => {
		const bonus = availableBonuses.find((candidate) => candidate.id === id)
		return bonus ? [{
			kind: "generic" as const,
			bonus: withRolledRarity(bonus),
			candidatePoolSize: availableBonuses.length,
		}] : []
	})
	if (special) {
		choices.push({
			...special,
			candidatePoolSize: specialCandidates.length,
		})
	}
	return shuffle(choices)
}

function getAbilityTierChoices(): RunLevelChoice[] {
	const loadout = getAbilityLoadout()
	const slots: AbilitySlot[] = ["secondary", "mobility", "ultimate"]
	return slots.flatMap((slot) => {
		const abilityId = loadout[slot] as AbilityId | undefined
		if (!abilityId) return []
		const ability = getAbilityDefinition(abilityId)
		const rarity = getNextAbilityTierRarity(abilityId)
		if (!ability || !rarity) return []
		return [{
			kind: "abilityTier" as const,
			ability,
			tier: rollAbilityTierState(abilityId, slot, rarity),
			candidatePoolSize: 0,
		}]
	})
}

function getOwnedUpgradeChoices(): RunLevelChoice[] {
	const candidates: RunLevelChoice[] = []
	for (const [rawKey, currentLevel] of Object.entries(levelLoadout)) {
		const key = rawKey as ToolKey
		if (currentLevel === undefined || isPermanentUpgradeKey(key)) continue
		const nextLevel = getNextRunUpgradeLevel(key)
		if (nextLevel === undefined) continue
		const definition = getUpgradeDefinition(key)
		if (!definition?.levels[nextLevel]?.effects.modifiers?.length) continue
		const reward = createDirectUpgradeReward(key, nextLevel)
		if (!reward) continue
		reward.rarity = getEffectiveUpgradeRarity(key) ?? reward.rarity
		candidates.push({ kind: "upgrade", reward, candidatePoolSize: 0 })
	}
	return candidates
}

function recordRunLevelOffers(choices: readonly RunLevelChoice[], runLevel: number) {
	for (const choice of choices) {
		recordTelemetryRewardOffered(
			getChoiceRewardId(choice),
			getChoiceTelemetryDetails(choice, runLevel)
		)
	}
}

function getChoiceRewardId(choice: RunLevelChoice) {
	if (choice.kind === "generic") return `runBonus:${choice.bonus.id}`
	if (choice.kind === "abilityTier") {
		return `abilityTier:${choice.ability.id}:${choice.tier.rarity}`
	}
	return choice.reward.id
}

function getChoiceFamilyId(choice: RunLevelChoice) {
	if (choice.kind === "generic") return `runBonus:${choice.bonus.id}`
	if (choice.kind === "abilityTier") return `abilityTier:${choice.ability.id}`
	return choice.reward.upgradeKey
		? `upgrade:${choice.reward.upgradeKey}`
		: choice.reward.id
}

function getChoiceTelemetryDetails(
	choice: RunLevelChoice,
	runLevel: number
): RewardTelemetryDetails {
	return {
		source: "level-up",
		category: choice.kind,
		familyId: getChoiceFamilyId(choice),
		rarity: choice.kind === "generic"
			? choice.bonus.rarity
			: choice.kind === "abilityTier"
				? choice.tier.rarity
				: choice.reward.rarity,
		runLevel,
		candidatePoolSize: choice.candidatePoolSize,
	}
}

function getChoiceDetails(choice: RunLevelChoice): RunLevelChoiceDetails {
	if (choice.kind === "generic") {
		const snapshot = getRunLevelSnapshot()
		const stacks = snapshot.bonuses[choice.bonus.id]
		const value = getRunLevelBonusValue(choice.bonus, choice.bonus.rarity)
		const currentValue = choice.bonus.baseValue * snapshot.bonusPower[choice.bonus.id]
		return {
			name: choice.bonus.name,
			description: choice.bonus.description,
			stats: [
				{
					label: choice.bonus.stat,
					value: `${formatBonusValue(choice.bonus, currentValue)} > ${formatBonusValue(choice.bonus, currentValue + value)}`,
				},
				{ label: "STACK", value: `${stacks + 1} > ${stacks + 2}` },
			],
			sprite: choice.bonus.sprite,
			rarity: choice.bonus.rarity,
		}
	}
	if (choice.kind === "abilityTier") {
		const currentValues = getAbilityTierValues(choice.ability.id)
		const values = choice.tier.values
		return {
			name: choice.ability.name,
			description: `Upgrade equipped ${choice.ability.slot} to its next tier`,
			stats: [
				{ label: "POWER", value: `${formatMultiplier(currentValues.power)} > ${formatMultiplier(values.power)}` },
				{ label: "SPEED", value: `${formatMultiplier(currentValues.speed)} > ${formatMultiplier(values.speed)}` },
				{ label: "RECOVERY", value: `${formatMultiplier(currentValues.recovery)} > ${formatMultiplier(values.recovery)}` },
			],
			sprite: choice.ability.icon,
			rarity: choice.tier.rarity,
			slot: choice.ability.slot,
		}
	}
	return {
		name: choice.reward.name,
		description: choice.reward.description,
		stats: getRewardStatComparisonRows(choice.reward),
		sprite: choice.reward.sprite,
		rarity: choice.reward.rarity,
		slot: choice.reward.abilitySlot,
	}
}

function withRolledRarity(bonus: RunLevelBonusDefinition) {
	return {
		...bonus,
		rarity: rollRunLevelBonusRarity(),
	}
}

function pauseGameObjects(paused: boolean) {
	for (const object of k.get(tags.gameLoop, { recursive: true }) as GameObj[]) {
		if (object.exists()) object.paused = paused
	}
}

function shuffle<T>(values: readonly T[]) {
	const shuffled = [...values]
	for (let index = shuffled.length - 1; index > 0; index--) {
		const swapIndex = Math.floor(Math.random() * (index + 1))
		const current = shuffled[index]
		shuffled[index] = shuffled[swapIndex]
		shuffled[swapIndex] = current
	}
	return shuffled
}

function formatBonusValue(definition: RunLevelBonusDefinition, value: number) {
	const displayValue = definition.percentage ? value * 100 : value
	return `${Math.round(displayValue)}%`
}

function formatMultiplier(value: number) {
	return `x${value.toFixed(2)}`
}
