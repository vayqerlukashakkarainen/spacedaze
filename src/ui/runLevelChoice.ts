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
	getAvailableRunLevelBonuses,
	getRunLevelSnapshot,
	grantRunLevelBonus,
	type RunLevelBonusDefinition,
} from "../services/runLevelService"
import { tags } from "../tags"
import { addCollectedPowerup } from "./gameUi"
import { uiState } from "./uiState"
import { createUiPanel } from "./common/panel"
import { uiHitRegion } from "./common/hitRegion"
import { playUiModalOpen } from "./common/modalTransition"
import { UI_COLORS, UI_FONT_SIZES } from "./common/theme"
import { playUiClickSound, playUiHoverSound } from "../services/uiSoundService"
import { getUpgradeDefinition } from "../upgrades/upgradeRegistry"

type RunLevelChoice =
	| { kind: "generic"; bonus: RunLevelBonusDefinition }
	| { kind: "upgrade"; reward: Reward }

let isOpen = false
let selectionLocked = false

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

	isOpen = true
	selectionLocked = false
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
}

function renderRunLevelChoice(choices: RunLevelChoice[], level: number) {
	const panelWidth = Math.min(780, k.width() - 40)
	const panelHeight = Math.min(410, k.height() - 40)
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
	panel.add([
		k.text(`LEVEL ${level}  //  SELECT ONE`, {
			size: UI_FONT_SIZES.small,
			font: "unscii",
		}),
		k.pos(0, -panelHeight / 2 + 58),
		k.anchor("center"),
		k.color(...UI_COLORS.accent),
	])

	const gap = 14
	const cardWidth = Math.min(
		224,
		(panelWidth - 52 - gap * (choices.length - 1)) / choices.length
	)
	const cardHeight = panelHeight - 112
	const rowWidth = cardWidth * choices.length + gap * (choices.length - 1)
	for (let index = 0; index < choices.length; index++) {
		const choice = choices[index]
		const details = getChoiceDetails(choice)
		const color = REWARD_RARITY_COLORS[details.rarity]
		const x = -rowWidth / 2 + cardWidth / 2 + index * (cardWidth + gap)
		const card = panel.add([
			k.rect(cardWidth, cardHeight),
			k.pos(x, 37),
			k.anchor("center"),
			k.color(...UI_COLORS.panelRaised),
			k.outline(1, k.rgb(...color)),
			uiHitRegion(k.vec2(cardWidth, cardHeight), true),
		])
		card.add([
			k.sprite(details.sprite, { width: 54, height: 54 }),
			k.pos(0, -cardHeight / 2 + 48),
			k.anchor("center"),
		])
		card.add([
			k.text(details.category, { size: UI_FONT_SIZES.small, font: "unscii" }),
			k.pos(0, -cardHeight / 2 + 84),
			k.anchor("center"),
			k.color(...color),
		])
		card.add([
			k.text(details.name, {
				size: UI_FONT_SIZES.body,
				font: "unscii",
				width: cardWidth - 24,
				align: "center",
			}),
			k.pos(0, -cardHeight / 2 + 112),
			k.anchor("center"),
			k.color(...UI_COLORS.text),
		])
		card.add([
			k.text(details.description, {
				size: UI_FONT_SIZES.small,
				font: "unscii",
				width: cardWidth - 28,
				align: "center",
			}),
			k.pos(0, 18),
			k.anchor("center"),
			k.color(...UI_COLORS.muted),
		])
		card.add([
			k.text(details.effect, {
				size: UI_FONT_SIZES.label,
				font: "unscii",
				width: cardWidth - 24,
				align: "center",
			}),
			k.pos(0, cardHeight / 2 - 38),
			k.anchor("center"),
			k.color(...color),
		])
		card.onHover(() => {
			uiState.isOverUI = true
			card.color = k.rgb(...UI_COLORS.panelHover)
			playUiHoverSound()
		})
		card.onHoverEnd(() => {
			uiState.isOverUI = false
			card.color = k.rgb(...UI_COLORS.panelRaised)
		})
		card.onClick(() => selectRunLevelChoice(choice))
	}
}

function selectRunLevelChoice(choice: RunLevelChoice) {
	if (selectionLocked) return
	selectionLocked = true
	let applied = false
	if (choice.kind === "generic") {
		applied = grantRunLevelBonus(choice.bonus.id)
		if (applied) loadPlayer()
	} else {
		applied = applyReward(choice.reward, k.center())
		if (applied) addCollectedPowerup(choice.reward)
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
	const generic = shuffle(getAvailableRunLevelBonuses()).slice(0, 2)
	const choices: RunLevelChoice[] = generic.map((bonus) => ({
		kind: "generic",
		bonus,
	}))
	const upgrade = pickOwnedUpgradeReward()
	if (upgrade) choices.push({ kind: "upgrade", reward: upgrade })
	else {
		const used = new Set(generic.map((bonus) => bonus.id))
		const fallback = shuffle(
			getAvailableRunLevelBonuses().filter((bonus) => !used.has(bonus.id))
		)[0]
		if (fallback) choices.push({ kind: "generic", bonus: fallback })
	}
	return shuffle(choices)
}

function pickOwnedUpgradeReward() {
	const candidates: Reward[] = []
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
		candidates.push(reward)
	}
	return shuffle(candidates)[0]
}

function getChoiceDetails(choice: RunLevelChoice) {
	if (choice.kind === "generic") {
		const stacks = getRunLevelSnapshot().bonuses[choice.bonus.id]
		return {
			name: choice.bonus.name,
			description: choice.bonus.description,
			effect: `${choice.bonus.stat}  ${choice.bonus.value}  //  STACK ${stacks + 1}`,
			sprite: choice.bonus.sprite,
			rarity: choice.bonus.rarity,
			category: "PASSIVE CALIBRATION",
		}
	}
	return {
		name: choice.reward.name,
		description: choice.reward.description,
		effect: Object.entries(choice.reward.stats)
			.map(([stat, value]) => `${formatStat(stat)} ${value}`)
			.join("  //  "),
		sprite: choice.reward.sprite,
		rarity: choice.reward.rarity,
		category: "OWNED UPGRADE",
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

function formatStat(stat: string) {
	return stat.replace(/([A-Z])/g, " $1").toUpperCase()
}
