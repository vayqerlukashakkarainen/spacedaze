import { GameObj } from "kaplay"
import {
	addScore,
	getScore,
	k,
	layers,
	mainSoundVolume,
	spendScore,
} from "../main"
import {
	applyReward,
	createReward,
	getRewardDefinition,
	getRewardLockReason,
	REWARD_RARITY_COLORS,
	RewardRarity,
} from "../services/rewardService"
import {
	consumeRecoveryOffer,
	getRecoveryOffers,
	RecoveryOffer,
} from "../services/runInventoryService"
import { audioService } from "../services/audioService"
import {
	playShopMenuCloseSound,
	playShopMenuOpenSound,
} from "../services/shopMenuSoundService"
import { tags } from "../tags"
import { addCollectedPowerup } from "./gameUi"
import { uiState } from "./uiState"
import { createUiPanel } from "./common/panel"
import { UI_COLORS } from "./common/theme"
import { uiHitRegion } from "./common/hitRegion"
import {
	playUiModalClose,
	playUiModalOpen,
} from "./common/modalTransition"

let isOpen = false
let isClosing = false
let activePanel: GameObj | undefined
let activeBackdrop: GameObj | undefined

export function showRecoveryShop() {
	if (isOpen) return
	isOpen = true
	uiState.modalOpen = true
	pauseGameObjects(true)
	renderRecoveryShop()
	playShopMenuOpenSound()
}

export function hideRecoveryShop(animate = true) {
	if (!isOpen || isClosing) return
	if (!animate) {
		finishClosingRecoveryShop(false)
		return
	}
	isClosing = true
	playShopMenuCloseSound()
	const panel = activePanel
	const backdrop = activeBackdrop
	if (!panel?.exists() || !backdrop?.exists()) {
		finishClosingRecoveryShop(false)
		return
	}
	void playUiModalClose(backdrop, panel, {
		panelPos: k.center(),
		backdropOpacity: 0.78,
	}).then(() => finishClosingRecoveryShop(false))
}

export function recoveryShopOpen() {
	return isOpen
}

function finishClosingRecoveryShop(playTransitionSound: boolean) {
	isOpen = false
	isClosing = false
	uiState.modalOpen = false
	k.destroyAll(tags.recoveryShop)
	pauseGameObjects(false)
	if (playTransitionSound) playShopMenuCloseSound()
	activePanel = undefined
	activeBackdrop = undefined
}

function renderRecoveryShop(animate = true) {
	k.destroyAll(tags.recoveryShop)
	const offers = getRecoveryOffers()
	const center = k.center()
	const panelWidth = Math.min(840, k.width() - 40)
	const panelHeight = Math.min(470, k.height() - 40)

	const backdrop = k.add([
		k.rect(k.width(), k.height()),
		k.pos(0, 0),
		k.color(k.BLACK),
		k.opacity(0.78),
		k.animate(),
		k.fixed(),
		k.layer(layers.uiEffects),
		tags.recoveryShop,
	])

	const panel = createUiPanel({
		pos: center,
		size: k.vec2(panelWidth, panelHeight),
		anchor: "center",
		layer: layers.uiEffects,
		tags: [tags.recoveryShop],
		animated: animate,
	})
	activeBackdrop = backdrop
	activePanel = panel
	if (animate) {
		playUiModalOpen(backdrop, panel, {
			panelPos: center,
			backdropOpacity: 0.78,
		})
	}

	panel.add([
		k.text("RECOVERY SHOP", { size: 24, font: "unscii" }),
		k.pos(0, -panelHeight / 2 + 30),
		k.anchor("center"),
	])
	panel.add([
		k.text(`SALVAGE: ${getScore()}`, { size: 12, font: "unscii" }),
		k.pos(0, -panelHeight / 2 + 62),
		k.anchor("center"),
		k.color(100, 200, 255),
	])

	if (offers.length === 0) {
		panel.add([
			k.text("NO LOST POWERUPS TO RECOVER", {
				size: 14,
				font: "unscii",
			}),
			k.anchor("center"),
		])
	}

	const gap = 16
	const cardWidth = Math.min(
		230,
		(panelWidth - 50 - Math.max(0, offers.length - 1) * gap) /
			Math.max(1, offers.length)
	)
	const cardHeight = 300
	const rowWidth =
		cardWidth * offers.length + gap * Math.max(0, offers.length - 1)

	offers.forEach((offer, index) => {
		const lockReason = getOfferLockReason(offer)
		const colorValues = REWARD_RARITY_COLORS[offer.rarity as RewardRarity]
		const cardX = -rowWidth / 2 + cardWidth / 2 + index * (cardWidth + gap)
		const card = panel.add([
			k.rect(cardWidth, cardHeight),
			k.pos(cardX, 28),
			k.anchor("center"),
			uiHitRegion(k.vec2(cardWidth, cardHeight), true),
			k.color(...UI_COLORS.panel),
			k.outline(2, new k.Color(...colorValues)),
		])

		card.add([
			k.sprite(offer.sprite, { width: 52, height: 52 }),
			k.pos(0, -103),
			k.anchor("center"),
		])
		card.add([
			k.text(`${offer.rarity}${offer.rewardIds.length > 1 ? `  x${offer.rewardIds.length}` : ""}`, {
				size: 9,
				font: "unscii",
			}),
			k.pos(0, -68),
			k.anchor("center"),
			k.color(...colorValues),
		])
		card.add([
			k.text(offer.name, {
				size: 12,
				font: "unscii",
				width: cardWidth - 18,
				align: "center",
			}),
			k.pos(0, -38),
			k.anchor("center"),
		])
		card.add([
			k.text(offer.description, {
				size: 9,
				font: "unscii",
				width: cardWidth - 22,
				align: "center",
			}),
			k.pos(0, 25),
			k.anchor("center"),
		])
		card.add([
			k.text(lockReason ? `LOCKED\n${lockReason}` : `RECOVER  ${offer.price}`, {
				size: lockReason ? 8 : 12,
				font: "unscii",
				width: cardWidth - 18,
				align: "center",
			}),
			k.pos(0, 112),
			k.anchor("center"),
			k.color(!lockReason && getScore() >= offer.price ? k.WHITE : k.RED),
		])

		card.onHover(() => {
			card.color = k.rgb(...UI_COLORS.panelHover)
		})
		card.onHoverEnd(() => {
			card.color = k.rgb(...UI_COLORS.panel)
		})
		card.onClick(() => purchaseOffer(offer))
	})

	const close = panel.add([
		k.rect(180, 38),
		k.pos(0, panelHeight / 2 - 28),
		k.anchor("center"),
		uiHitRegion(k.vec2(180, 38), true),
		k.color(...UI_COLORS.panel),
		k.outline(2, k.rgb(...UI_COLORS.accent)),
	])
	close.add([
		k.text("CLOSE", { size: 12, font: "unscii" }),
		k.anchor("center"),
	])
	close.onClick(() => hideRecoveryShop())
}

function purchaseOffer(offer: RecoveryOffer) {
	if (getOfferLockReason(offer)) return
	if (!spendScore(offer.price)) return

	for (const rewardId of offer.rewardIds) {
		const reward = createReward(rewardId)
		if (!reward || !applyReward(reward, k.center())) {
			addScore(offer.price)
			return
		}
		addCollectedPowerup(reward)
	}

	consumeRecoveryOffer(offer.id)
	audioService.playSound("purchase1", { volume: mainSoundVolume })
	renderRecoveryShop(false)
}

function getOfferLockReason(offer: RecoveryOffer) {
	const firstReward = getRewardDefinition(offer.rewardIds[0] ?? "")
	return firstReward ? getRewardLockReason(firstReward) : "Invalid reward"
}

function pauseGameObjects(paused: boolean) {
	for (const obj of k.get<GameObj>(tags.gameLoop)) {
		obj.paused = paused
	}
}
