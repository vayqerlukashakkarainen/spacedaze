import type { GameObj } from "kaplay"
import { k, layers, mainSoundVolume } from "../main"
import { tags } from "../tags"
import {
	EXPEDITION_SUPPORT_UPGRADES,
	getExpeditionSupportRank,
	getExpeditionSupportUpgradeCost,
	upgradeExpeditionSupport,
	type ExpeditionSupportId,
} from "../services/hub/expeditionSupportService"
import { addLvl, getPermanentUpgradeLevel } from "../upg"
import { saveGame } from "../util"
import { gameSoundService } from "../services/audio/gameSoundService"
import {
	playShopMenuCloseSound,
	playShopMenuOpenSound,
} from "../services/audio/shopMenuSoundService"
import { playRequirementErrorSound } from "../services/audio/uiSoundService"
import {
	createUiActionButton,
	createUiDebrisText,
	createUiLassoTokenText,
	createUiPhaseCoreText,
	createUiProgressBar,
	createUiPsionicPlateText,
	createUiThrusterPartText,
	createUiPanel,
	createUiSurface,
	getScaledLineSpacing,
	UI_COLORS,
	UI_FONT_SIZES,
} from "./common"
import { uiState } from "./uiState"
import {
	playUiModalClose,
	playUiModalOpen,
} from "./common/modalTransition"
import {
	purchaseBurstParticleCount,
	spawnCurrencyBurst,
} from "../spawn/spawnCurrencyBurst"
import {
	addPhaseCores,
	getPhaseCores,
	spendPhaseCores,
} from "../services/economy/phaseCoreService"
import {
	addPsionicPlates,
	getPsionicPlates,
	spendPsionicPlates,
} from "../services/economy/psionicPlateService"
import {
	addThrusterParts,
	getThrusterParts,
	spendThrusterParts,
} from "../services/economy/thrusterPartService"
import { PLAYER_TURRET_CONE_LEVEL_DEGREES } from "../services/input/playerSteeringModeService"
import { loadPlayer } from "../player"
import {
	addLassoTokens,
	getLassoRigRank,
	getLassoRigUpgradeCost,
	getLassoTokens,
	LASSO_RIG_UPGRADES,
	spendLassoTokens,
	upgradeLassoRig,
	type LassoRigUpgradeId,
} from "../services/hub/lassoRigService"

type QuartermasterOfferId = ExpeditionSupportId |
	LassoRigUpgradeId |
	"extraLife" |
	"maxHealth" |
	"movespeed" |
	"strafeSpeed" |
	"turretTraverse"
type PermanentQuartermasterOfferId = Exclude<
	QuartermasterOfferId,
	ExpeditionSupportId | LassoRigUpgradeId
>

interface QuartermasterOffer {
	id: QuartermasterOfferId
	name: string
	description: string
	sprite: string
	values: readonly number[]
	costs: readonly number[]
	currency?: "phaseCore" | "psionicPlate" | "thrusterPart" | "lassoToken"
}

const PHASE_RECALL_OFFER: QuartermasterOffer = {
	id: "extraLife",
	name: "PHASE RECALL",
	description: "Begin each expedition with reconstruction charges.",
	sprite: "phase_recall_upg1",
	values: [1, 2, 3],
	costs: [1, 2, 3],
}

const PSIONIC_PLATING_OFFER: QuartermasterOffer = {
	id: "maxHealth",
	name: "PSIONIC PLATING",
	description: "Permanently reinforce maximum hull for every expedition.",
	sprite: "hull_upg1",
	values: [15, 30, 45, 60, 75, 90, 105],
	costs: [1, 1, 1, 1, 1, 1, 1],
	currency: "psionicPlate",
}

const TURRET_TRAVERSE_OFFER: QuartermasterOffer = {
	id: "turretTraverse",
	name: "TURRET TRAVERSE",
	description: "Expand primary aim while keeping full-speed flight controls.",
	sprite: "turret_traverse_upg1",
	values: PLAYER_TURRET_CONE_LEVEL_DEGREES,
	costs: [1, 1, 2, 2, 3, 4],
}

const CRUISE_THRUSTERS_OFFER: QuartermasterOffer = {
	id: "movespeed",
	name: "CRUISE THRUSTERS",
	description: "Permanently increase normal-flight movement speed.",
	sprite: "faster_speed_upg1",
	values: [5, 15],
	costs: [1, 2],
	currency: "thrusterPart",
}

const STRAFE_THRUSTERS_OFFER: QuartermasterOffer = {
	id: "strafeSpeed",
	name: "STRAFE THRUSTERS",
	description: "Permanently increase movement speed during strafe control.",
	sprite: "faster_speed_upg1",
	values: [5, 15],
	costs: [1, 2],
	currency: "thrusterPart",
}

const OFFERS: readonly QuartermasterOffer[] = [
	...EXPEDITION_SUPPORT_UPGRADES,
	CRUISE_THRUSTERS_OFFER,
	STRAFE_THRUSTERS_OFFER,
	PHASE_RECALL_OFFER,
	PSIONIC_PLATING_OFFER,
	TURRET_TRAVERSE_OFFER,
]

const LASSO_OFFERS: readonly QuartermasterOffer[] = LASSO_RIG_UPGRADES.map(
	(definition) => ({ ...definition, currency: "lassoToken" })
)

let isOpen = false
let isClosing = false
let activePanel: GameObj | undefined
let activeBackdrop: GameObj | undefined

export function showQuartermasterShop() {
	if (isOpen) return
	isOpen = true
	uiState.modalOpen = true
	pauseGameObjects(true)
	renderQuartermasterShop()
	playShopMenuOpenSound()
}

export function hideQuartermasterShop(animate = true) {
	if (!isOpen || isClosing) return
	if (!animate) {
		finishClosing()
		return
	}
	isClosing = true
	playShopMenuCloseSound()
	const panel = activePanel
	const backdrop = activeBackdrop
	if (!panel?.exists() || !backdrop?.exists()) {
		finishClosing()
		return
	}
	void playUiModalClose(backdrop, panel, {
		panelPos: k.center(),
		backdropOpacity: 0.78,
	}).then(finishClosing, finishClosing)
}

export function quartermasterShopOpen() {
	return isOpen
}

function finishClosing() {
	isOpen = false
	isClosing = false
	uiState.modalOpen = false
	k.destroyAll(tags.quartermasterShop)
	pauseGameObjects(false)
	activePanel = undefined
	activeBackdrop = undefined
}

function renderQuartermasterShop(
	animate = true,
	purchasedOfferId?: QuartermasterOfferId
) {
	k.destroyAll(tags.quartermasterShop)
	const center = k.center()
	const panelWidth = Math.min(1220, k.width() - 24)
	const panelHeight = Math.min(720, k.height() - 24)
	const lassoUnlocked = getPermanentUpgradeLevel("salvageLasso") !== undefined
	const visibleOffers = lassoUnlocked
		? [...OFFERS, ...LASSO_OFFERS]
		: OFFERS
	const backdrop = k.add([
		k.rect(k.width(), k.height()),
		k.pos(0, 0),
		k.color(k.BLACK),
		k.opacity(0.78),
		k.animate(),
		k.fixed(),
		k.layer(layers.uiEffects),
		tags.quartermasterShop,
	])
	const panel = createUiPanel({
		pos: center,
		size: k.vec2(panelWidth, panelHeight),
		anchor: "center",
		layer: layers.uiEffects,
		tags: [tags.quartermasterShop],
		animated: true,
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
		k.text("QUARTERMASTER", {
			size: UI_FONT_SIZES.display,
			font: "unscii",
		}),
		k.pos(0, -panelHeight / 2 + 28),
		k.anchor("center"),
	])
	const currencyXs = lassoUnlocked
		? [-360, -120, 120, 360]
		: [-245, 0, 245]
	createUiPhaseCoreText(panel, {
		parts: ["PHASE CORES  ", { phaseCores: getPhaseCores() }],
		pos: k.vec2(currencyXs[0], -panelHeight / 2 + 65),
		size: UI_FONT_SIZES.small,
		iconSize: UI_FONT_SIZES.small * 2,
		iconGap: 5,
		color: k.rgb(...UI_COLORS.accent),
		align: "center",
		verticalAlign: "center",
	})
	createUiPsionicPlateText(panel, {
		parts: ["PSIONIC PLATES  ", { psionicPlates: getPsionicPlates() }],
		pos: k.vec2(currencyXs[1], -panelHeight / 2 + 65),
		size: UI_FONT_SIZES.small,
		iconSize: UI_FONT_SIZES.small * 2,
		iconGap: 5,
		color: k.rgb(...UI_COLORS.accent),
		align: "center",
		verticalAlign: "center",
	})
	createUiThrusterPartText(panel, {
		parts: ["THRUSTER PARTS  ", { thrusterParts: getThrusterParts() }],
		pos: k.vec2(currencyXs[2], -panelHeight / 2 + 65),
		size: UI_FONT_SIZES.small,
		iconSize: UI_FONT_SIZES.small * 2,
		iconGap: 5,
		color: k.rgb(...UI_COLORS.accent),
		align: "center",
		verticalAlign: "center",
	})
	if (lassoUnlocked) {
		createUiLassoTokenText(panel, {
			parts: ["LASSO TOKENS  ", { lassoTokens: getLassoTokens() }],
			pos: k.vec2(currencyXs[3], -panelHeight / 2 + 65),
			size: UI_FONT_SIZES.small,
			iconSize: UI_FONT_SIZES.small * 2,
			iconGap: 5,
			color: k.rgb(...UI_COLORS.accent),
			align: "center",
			verticalAlign: "center",
		})
	}

	const listGap = 4
	const listWidth = panelWidth - 36
	const startX = -panelWidth / 2 + 18
	const startY = -panelHeight / 2 + 96
	const listBottom = panelHeight / 2 - 64
	const rowHeight = Math.min(
		54,
		(listBottom - startY - listGap * (visibleOffers.length - 1)) /
			visibleOffers.length
	)
	visibleOffers.forEach((offer, index) => {
		const row = createOfferRow(
			panel,
			offer,
			k.vec2(startX, startY + index * (rowHeight + listGap)),
			k.vec2(listWidth, rowHeight)
		)
		if (offer.id === purchasedOfferId) {
			addPurchasedCardShine(row, k.vec2(listWidth, rowHeight))
		}
	})

	createUiActionButton(panel, {
		pos: k.vec2(-100, panelHeight / 2 - 50),
		size: k.vec2(200, 36),
		text: "CLOSE",
		onClick: () => hideQuartermasterShop(),
	})
}

function createOfferRow(
	parent: GameObj,
	offer: QuartermasterOffer,
	pos: ReturnType<typeof k.vec2>,
	size: ReturnType<typeof k.vec2>
) {
	const rank = getOfferRank(offer.id)
	const cost = getOfferCost(offer)
	const maxed = cost === undefined
	const row = createUiSurface(parent, {
		pos,
		size,
		tone: "default",
	})
	const buttonWidth = 200
	const buttonX = size.x - buttonWidth - 12
	const effectWidth = Math.min(320, Math.max(245, size.x * 0.27))
	const effectX = buttonX - effectWidth - 18
	const detailsX = 64
	const detailsWidth = effectX - detailsX - 18
	const iconSize = Math.min(42, size.y - 12)
	row.add([
		k.sprite(offer.sprite, { width: iconSize, height: iconSize }),
		k.pos(30, size.y / 2),
		k.anchor("center"),
		k.color(...UI_COLORS.warning),
		k.opacity(rank === 0 ? 0.28 : 1),
	])
	const levelMarker = row.add([
		k.rect(18, 18),
		k.pos(6, size.y - 21),
		k.color(...UI_COLORS.background),
		k.outline(1, k.rgb(...(rank === 0 ? UI_COLORS.border : UI_COLORS.accent))),
	])
	levelMarker.add([
		k.text(`${rank}`, {
			size: UI_FONT_SIZES.body,
			font: "unscii",
		}),
		k.pos(9, 9),
		k.anchor("center"),
		k.color(...(rank === 0 ? UI_COLORS.text : UI_COLORS.accent)),
	])
	row.add([
		k.text(offer.name, {
			size: UI_FONT_SIZES.body,
			font: "unscii",
			width: detailsWidth,
			lineSpacing: getScaledLineSpacing(UI_FONT_SIZES.body, 1.3),
		}),
		k.pos(detailsX, 6),
		k.color(...UI_COLORS.text),
	])
	row.add([
		k.text(offer.description, {
			size: UI_FONT_SIZES.tiny,
			font: "unscii",
			width: detailsWidth,
			lineSpacing: getScaledLineSpacing(UI_FONT_SIZES.tiny, 1.45),
		}),
		k.pos(detailsX, 24),
		k.color(...UI_COLORS.muted),
	])
	createUiProgressBar(row, {
		pos: k.vec2(detailsX, size.y - 5),
		width: detailsWidth,
		height: 3,
		value: rank / offer.values.length,
		color: rank >= offer.values.length
			? UI_COLORS.success
			: UI_COLORS.accent,
	})
	const effectColor = k.rgb(...(rank > 0 ? UI_COLORS.success : UI_COLORS.muted))
	const effectParts = getOfferEffectParts(offer, rank)
	if (effectParts) {
		createUiDebrisText(row, {
			parts: effectParts,
			pos: k.vec2(effectX, size.y / 2),
			size: UI_FONT_SIZES.small,
			iconSize: UI_FONT_SIZES.small * 2,
			color: effectColor,
			iconColor: k.rgb(...UI_COLORS.warning),
			verticalAlign: "center",
		})
	} else {
		row.add([
			k.text(getOfferEffectText(offer, rank), {
				size: UI_FONT_SIZES.small,
				font: "unscii",
				width: effectWidth,
				lineSpacing: getScaledLineSpacing(UI_FONT_SIZES.small, 1.5),
			}),
			k.pos(effectX, 14),
			k.color(effectColor),
		])
	}
	const canAfford = !maxed && getCurrencyBalance(offer) >= cost
	const buttonSize = k.vec2(buttonWidth, 38)
	const button = createUiActionButton(row, {
		pos: k.vec2(buttonX, (size.y - buttonSize.y) / 2),
		size: buttonSize,
		text: maxed ? "MAXIMUM" : "",
		disabled: maxed || !canAfford,
		requirementsMet: maxed ? undefined : canAfford,
		onDisabledClick: maxed ? undefined : playRequirementErrorSound,
		onClick: () => purchaseOffer(offer),
	})
	if (!maxed) {
		const buttonColor = k.rgb(...(canAfford ? UI_COLORS.accent : UI_COLORS.danger))
		const textProps = {
			pos: k.vec2(buttonSize.x / 2, buttonSize.y / 2),
			size: UI_FONT_SIZES.tiny,
			iconSize: UI_FONT_SIZES.tiny * 2,
			color: buttonColor,
			valueColor: buttonColor,
			iconColor: offer.currency === "psionicPlate"
				? k.rgb(...UI_COLORS.psionicPlate)
				: offer.currency === "thrusterPart"
					? k.rgb(...UI_COLORS.thrusterPart)
					: offer.currency === "lassoToken"
						? k.rgb(...UI_COLORS.lassoToken)
					: k.rgb(...UI_COLORS.danger),
			align: "center" as const,
			verticalAlign: "center" as const,
		}
		if (offer.currency === "psionicPlate") {
			createUiPsionicPlateText(button, {
				...textProps,
				parts: [rank === 0 ? "INSTALL  //  " : "UPGRADE  //  ", { psionicPlates: cost }],
			})
		} else if (offer.currency === "thrusterPart") {
			createUiThrusterPartText(button, {
				...textProps,
				parts: [rank === 0 ? "INSTALL  //  " : "UPGRADE  //  ", { thrusterParts: cost }],
			})
		} else if (offer.currency === "lassoToken") {
			createUiLassoTokenText(button, {
				...textProps,
				parts: [rank === 0 ? "INSTALL  //  " : "UPGRADE  //  ", { lassoTokens: cost }],
			})
		} else {
			createUiPhaseCoreText(button, {
				...textProps,
				parts: [rank === 0 ? "INSTALL  //  " : "UPGRADE  //  ", { phaseCores: cost }],
			})
		}
	}
	return row
}

function addPurchasedCardShine(card: GameObj, size: ReturnType<typeof k.vec2>) {
	const sweepDuration = 0.62
	const startX = -size.x / 2 - 36
	const endX = size.x / 2 + 36
	const mask = card.add([
		k.rect(size.x - 4, size.y - 4),
		k.pos(size.x / 2, size.y / 2),
		k.anchor("center"),
		k.mask("intersect"),
		k.z(30),
	])
	const glow = mask.add([
		k.rect(42, size.y * 1.4),
		k.pos(startX, 0),
		k.anchor("center"),
		k.rotate(-12),
		k.color(...UI_COLORS.accent),
		k.opacity(0),
		k.animate(),
		k.z(1),
	])
	const core = mask.add([
		k.rect(7, size.y * 1.4),
		k.pos(startX, 0),
		k.anchor("center"),
		k.rotate(-12),
		k.color(k.WHITE),
		k.opacity(0),
		k.animate(),
		k.z(2),
	])
	for (const light of [glow, core]) {
		light.animate("pos", [k.vec2(startX, 0), k.vec2(endX, 0)], {
			duration: sweepDuration,
			loops: 1,
			easing: k.easings.easeInOutCubic,
		})
	}
	glow.animate("opacity", [0, 0.34, 0.34, 0], {
		duration: sweepDuration,
		loops: 1,
		timing: [0, 0.2, 0.76, 1],
	})
	core.animate("opacity", [0, 0.92, 0.92, 0], {
		duration: sweepDuration,
		loops: 1,
		timing: [0, 0.16, 0.8, 1],
	})
	void k.wait(sweepDuration + 0.08).then(() => {
		if (mask.exists()) k.destroy(mask)
	})
}

function purchaseOffer(offer: QuartermasterOffer) {
	const cost = getOfferCost(offer)
	if (cost === undefined || !spendOfferCurrency(offer, cost)) {
		playRequirementErrorSound()
		return
	}
	const upgraded = isLassoRigOffer(offer.id)
		? upgradeLassoRig(offer.id)
		: isPermanentOffer(offer.id)
		? addLvl(offer.id) !== undefined
		: upgradeExpeditionSupport(offer.id)
	if (!upgraded) {
		refundOfferCurrency(offer, cost)
		playRequirementErrorSound()
		return
	}
	if (isPermanentOffer(offer.id)) loadPlayer()
	spawnCurrencyBurst(k.mousePos(), {
		particleCount: purchaseBurstParticleCount(cost),
		fixed: true,
	})
	gameSoundService.play("purchase1", { volume: mainSoundVolume })
	saveGame("slot1")
	renderQuartermasterShop(false, offer.id)
}

function getOfferRank(id: QuartermasterOfferId) {
	if (isLassoRigOffer(id)) return getLassoRigRank(id)
	if (isPermanentOffer(id)) {
		const level = getPermanentUpgradeLevel(id)
		return level === undefined ? 0 : level + 1
	}
	return getExpeditionSupportRank(id)
}

function getOfferCost(offer: QuartermasterOffer) {
	if (isLassoRigOffer(offer.id)) return getLassoRigUpgradeCost(offer.id)
	if (isPermanentOffer(offer.id)) return offer.costs[getOfferRank(offer.id)]
	return getExpeditionSupportUpgradeCost(offer.id)
}

function getOfferEffectText(offer: QuartermasterOffer, rank: number) {
	const current = formatEffect(offer.id, rank <= 0 ? 0 : offer.values[rank - 1])
	const next = offer.values[rank]
	return next === undefined
		? current
		: `${current}  ->  ${formatEffect(offer.id, next)}`
}

function getOfferEffectParts(
	offer: QuartermasterOffer,
	rank: number
): readonly (string | { debris: number })[] | undefined {
	if (offer.id !== "launchStipend") return undefined
	const current = rank <= 0 ? 0 : offer.values[rank - 1]
	const next = offer.values[rank]
	return next === undefined
		? [{ debris: current }]
		: [{ debris: current }, "  ->  ", { debris: next }]
}

function formatEffect(id: QuartermasterOfferId, value: number) {
	if (id === "flightRecorder") return `${value} REROLL${value === 1 ? "" : "S"}`
	if (id === "emergencyNanites") return `${value} HULL`
	if (id === "launchStipend") return `${value} STARTING DEBRIS`
	if (id === "turretTraverse") return `${value} DEG PRIMARY CONE`
	if (id === "maxHealth") return `+${value}% MAX HULL`
	if (id === "movespeed") return `+${value}% NORMAL-FLIGHT SPEED`
	if (id === "strafeSpeed") return `+${value}% STRAFE SPEED`
	if (id === "partExtractor") return value > 0 ? "PART EXTRACTION ENABLED" : "LOCKED"
	if (id === "massCoupler") return `+${Math.round((value - 1) * 100)}% IMPACT MASS`
	if (id === "forceAmplifier") return `+${Math.round((value - 1) * 100)}% LASSO FORCE`
	return `${value} RECALL CHARGE${value === 1 ? "" : "S"}`
}

function isLassoRigOffer(id: QuartermasterOfferId): id is LassoRigUpgradeId {
	return LASSO_RIG_UPGRADES.some((definition) => definition.id === id)
}

function isPermanentOffer(id: QuartermasterOfferId): id is PermanentQuartermasterOfferId {
	return id === "extraLife" ||
		id === "maxHealth" ||
		id === "movespeed" ||
		id === "strafeSpeed" ||
		id === "turretTraverse"
}

function getCurrencyBalance(offer: QuartermasterOffer) {
	if (offer.currency === "psionicPlate") return getPsionicPlates()
	if (offer.currency === "thrusterPart") return getThrusterParts()
	if (offer.currency === "lassoToken") return getLassoTokens()
	return getPhaseCores()
}

function spendOfferCurrency(offer: QuartermasterOffer, amount: number) {
	if (offer.currency === "psionicPlate") return spendPsionicPlates(amount)
	if (offer.currency === "thrusterPart") return spendThrusterParts(amount)
	if (offer.currency === "lassoToken") return spendLassoTokens(amount)
	return spendPhaseCores(amount)
}

function refundOfferCurrency(offer: QuartermasterOffer, amount: number) {
	if (offer.currency === "psionicPlate") {
		addPsionicPlates(amount)
		return
	}
	if (offer.currency === "thrusterPart") {
		addThrusterParts(amount)
		return
	}
	if (offer.currency === "lassoToken") {
		addLassoTokens(amount)
		return
	}
	addPhaseCores(amount)
}

function pauseGameObjects(paused: boolean) {
	for (const obj of k.get(tags.gameLoop)) obj.paused = paused
}
