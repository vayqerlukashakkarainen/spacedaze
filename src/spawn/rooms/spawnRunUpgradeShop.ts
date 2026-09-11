import type { GameObj, PosComp, Vec2 } from "kaplay"
import { dialogue } from "../../content/dialogue/dialogueCatalog"
import { interactable, INTERACTION_PRIORITY } from "../../comp/interactable"
import { snareable } from "../../comp/snareable"
import type { RoomFloorRoom } from "../../generation/rooms/roomFloorTypes"
import {
	getScore,
	k,
	layers,
	mainSoundVolume,
	spendScore,
} from "../../main"
import {
	applyReward,
	createReward,
	getRewardDefinition,
	getRewardDefinitions,
	getRewardLockReason,
} from "../../services/economy/rewardService"
import { addAvailableDebree } from "../../services/economy/debreeEconomyService"
import { getActiveRoomFloor } from "../../services/world/roomFloorService"
import { selectRunUpgradeShopOffers } from "../../services/runs/runUpgradeShopService"
import { getThreatSnapshot } from "../../services/enemies/threatService"
import { gameSoundService } from "../../services/audio/gameSoundService"
import { playCutscene, type CutsceneDefinition } from "../../services/narrative/cutsceneService"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import {
	hasSeenNpcDialogue,
	markNpcDialogueSeen,
	registerNpcDialogueTrigger,
} from "../../services/narrative/npcDialogueService"
import { registerNpcDialogueIndicator } from "../../services/narrative/npcDialogueIndicatorService"
import { playRequirementErrorSound } from "../../services/audio/uiSoundService"
import {
	purchaseBurstParticleCount,
	spawnCurrencyBurst,
} from "../spawnCurrencyBurst"
import { createNpcInteractionPrompt, UI_COLORS } from "../../ui/common"
import { tags } from "../../tags"
import { getCompanionVisual } from "../../visuals/companionVisualCatalog"
import { requirePrimaryVisualSprite } from "../../visuals/visualRepresentation"
import { spawnRewardPickup } from "../spawnPowerup"
import { getPilotProtocolValue } from "../../services/hub/pilotProtocolService"

const SHOPKEEPER_DIALOGUE_ID = "void-profit"
const SHOPKEEPER_INTERACT_RADIUS = 86
const DRONE_SHOP_AMBIENT_DRONE_COUNT = 4
const DRONE_SHOP_ORBIT_RADIUS_X = 205
const DRONE_SHOP_ORBIT_RADIUS_Y = 118
const DRONE_SHOP_ORBIT_SPEED = 18
const DRONE_SHOP_AMBIENT_VISUALS = [
	"combat",
	"interceptor",
	"medic",
	"missile",
] as const
const DRONE_SPECIALIZATION_KEYS = new Set([
	"followerMissiles",
	"followerInterceptorProtocol",
	"followerGunship",
	"followerMedic",
	"followerSalvager",
])

export function spawnRunUpgradeShop(
	pos: Vec2,
	room: RoomFloorRoom,
	objectTags: string[]
) {
	ensureShopOffers(room)
	return spawnRunShop(pos, room, objectTags)
}

export function spawnRunDroneShop(
	pos: Vec2,
	room: RoomFloorRoom,
	objectTags: string[]
) {
	ensureDroneShopOffers(room)
	spawnDroneShopAmbientDrones(pos, objectTags)
	return spawnRunShop(pos, room, objectTags)
}

function spawnDroneShopAmbientDrones(pos: Vec2, objectTags: string[]) {
	for (let index = 0; index < DRONE_SHOP_AMBIENT_DRONE_COUNT; index++) {
		const visual = getCompanionVisual(DRONE_SHOP_AMBIENT_VISUALS[index])
		const phase = index * 360 / DRONE_SHOP_AMBIENT_DRONE_COUNT
		const drone = k.add([
			k.pos(pos),
			k.sprite(requirePrimaryVisualSprite(visual), { width: 18, height: 18 }),
			k.anchor("center"),
			k.rotate(0),
			k.color(k.WHITE),
			k.opacity(0.82),
			k.layer(layers.game),
			k.z(8),
			tags.props,
			tags.gameLoop,
			tags.runtimeCullable,
			...objectTags,
		])

		registerBatchedEntityUpdate("world", drone, () => {
			const angle = phase + k.time() * DRONE_SHOP_ORBIT_SPEED
			const radians = angle * Math.PI / 180
			const orbitOffset = k.vec2(
				Math.cos(radians) * DRONE_SHOP_ORBIT_RADIUS_X,
				Math.sin(radians) * DRONE_SHOP_ORBIT_RADIUS_Y
			)
			const tangent = k.vec2(
				-Math.sin(radians) * DRONE_SHOP_ORBIT_RADIUS_X,
				Math.cos(radians) * DRONE_SHOP_ORBIT_RADIUS_Y
			)
			drone.pos = pos.add(orbitOffset)
			drone.angle = tangent.angle() + 90
			drone.z = orbitOffset.y < -70 ? 8 : 16
		})
	}
}

function spawnRunShop(
	pos: Vec2,
	room: RoomFloorRoom,
	objectTags: string[]
) {
	const shopkeeper = spawnRunShopkeeper(pos.add(0, -70), objectTags)
	const offerCount = room.shopOffers?.length ?? 0
	const offsets = Array.from({ length: offerCount }, (_, index) => {
		const centered = index - (offerCount - 1) / 2
		return k.vec2(centered * 112, 110 + Math.abs(centered) * -12)
	})
	for (let index = 0; index < (room.shopOffers?.length ?? 0); index++) {
		const offer = room.shopOffers![index]
		if (offer.purchased) continue
		spawnShopOffer(pos.add(offsets[index]), offer, objectTags)
	}
	return shopkeeper
}

function spawnRunShopkeeper(pos: Vec2, objectTags: string[]) {
	const visual = getCompanionVisual("salvager")
	let talking = false
	const shopkeeper = k.add([
		k.pos(pos),
		k.sprite(requirePrimaryVisualSprite(visual), { width: 24, height: 24 }),
		k.anchor("center"),
		k.rotate(0),
		k.color(k.WHITE),
		k.layer(layers.game),
		k.z(12),
		interactable(
			SHOPKEEPER_INTERACT_RADIUS,
			startConversation,
			INTERACTION_PRIORITY.progressionDialogue
		),
		snareable({
			mass: 1,
			radius: 12,
			releaseDrag: 2.7,
			returnAfterRelease: true,
			returnSpeed: 95,
		}),
		tags.npc,
		tags.props,
		tags.gameLoop,
		tags.runtimeCullable,
		...objectTags,
	])
	const prompt = createNpcInteractionPrompt({
		target: shopkeeper,
		offset: k.vec2(0, -44),
		label: { text: "MARGIN" },
	})
	const unregisterDialogueTrigger = registerNpcDialogueTrigger(
		"margin",
		startConversation
	)
	shopkeeper.onDestroy(unregisterDialogueTrigger)
	registerNpcDialogueIndicator({
		actor: shopkeeper,
		npcId: "margin",
		getDialogueId: () => SHOPKEEPER_DIALOGUE_ID,
		isVisible: () => !talking && !shopkeeper.isInRange,
		offset: k.vec2(0, -44),
	})

	registerBatchedEntityUpdate("world", shopkeeper, () => {
		shopkeeper.setInteractionPriority(
			hasSeenNpcDialogue("margin", SHOPKEEPER_DIALOGUE_ID)
				? INTERACTION_PRIORITY.dialogue
				: INTERACTION_PRIORITY.progressionDialogue
		)
		prompt.update(!talking && shopkeeper.isInRange)
		const player = k.get<PosComp>(tags.player)[0]
		if (!player?.exists()) return
		const toPlayer = player.pos.sub(shopkeeper.pos)
		if (toPlayer.len() > 0.01) shopkeeper.angle = toPlayer.angle() + 90
	})

	function startConversation() {
		if (talking || !shopkeeper.exists()) return false
		talking = true
		shopkeeper.isInRange = false
		prompt.update(false)
		void playCutscene(createShopkeeperCutscene(), {
			resolveActor: (id) => id === "shopkeeper"
				? shopkeeper
				: undefined,
		}).then((result) => {
			if (result === "completed") {
				markNpcDialogueSeen("margin", SHOPKEEPER_DIALOGUE_ID)
			}
		}).finally(() => {
			if (shopkeeper.exists()) talking = false
		})
		return true
	}

	return shopkeeper
}

function createShopkeeperCutscene(): CutsceneDefinition {
	const dialogueOptions = {
		gameplay: "live" as const,
		advance: "manual" as const,
		input: "passthrough" as const,
		overlayOpacity: 0,
	}
	return {
		id: "run-upgrade-shopkeeper-dialogue",
		speakerActors: { MARGIN: "shopkeeper" },
		pauseGameplay: false,
		pauseVisualEffects: false,
		steps: [
			{
				type: "dialogue",
				lines: dialogue.shopkeeper.introduction,
				options: dialogueOptions,
			},
			{
				type: "emotion",
				actor: "shopkeeper",
				emotion: "laugh",
				options: { duration: 1.8, priority: "interaction" },
			},
			{ type: "wait", duration: 0.38 },
			{
				type: "dialogue",
				lines: dialogue.shopkeeper.conclusion,
				options: dialogueOptions,
			},
		],
	}
}

function ensureShopOffers(room: RoomFloorRoom) {
	if (room.shopOffers) return
	const pricing = {
		depth: getActiveRoomFloor()?.depth ?? 1,
		difficulty: getThreatSnapshot().tier,
	}
	const candidates = getRewardDefinitions("crate")
		.filter((definition) =>
			definition.kind === "upgrade" &&
			definition.progression.persistence === "run"
		)
	room.shopPricing = pricing
	room.shopOffers = selectRunUpgradeShopOffers(
		room.seed,
		candidates,
		3 + getPilotProtocolValue("expandedMarket"),
		pricing
	)
}

function ensureDroneShopOffers(room: RoomFloorRoom) {
	if (room.shopOffers) return
	const pricing = {
		depth: getActiveRoomFloor()?.depth ?? 1,
		difficulty: getThreatSnapshot().tier,
	}
	const candidates = getRewardDefinitions("crate")
	const combatDrone = candidates.find((definition) =>
		definition.id === "addFollower"
	)
	const specializations = candidates.filter((definition) =>
		definition.upgradeKey !== undefined &&
		DRONE_SPECIALIZATION_KEYS.has(definition.upgradeKey)
	)
	const offers = selectRunUpgradeShopOffers(
		room.seed ^ 0x64726f6e,
		specializations,
		2,
		pricing
	)
	if (combatDrone) {
		const combatOffer = selectRunUpgradeShopOffers(
			room.seed,
			[combatDrone],
			1,
			pricing
		)[0]
		offers.unshift(combatOffer)
		while (offers.length < 3) {
			offers.push({ ...combatOffer, purchased: false })
		}
	}
	room.shopPricing = pricing
	room.shopOffers = offers.slice(0, 3)
}

function spawnShopOffer(
	pos: Vec2,
	offer: NonNullable<RoomFloorRoom["shopOffers"]>[number],
	objectTags: string[]
) {
	const definition = getRewardDefinition(offer.rewardId)
	if (!definition) return
	const reward = createReward(offer.rewardId, offer.rarity)
	if (!reward) return
	let paidPrice = offer.price
	let pickup: NonNullable<ReturnType<typeof spawnRewardPickup>>
	pickup = spawnRewardPickup(pos, reward, {
		stationary: true,
		interactionOnly: true,
		interactionRadius: 72,
		interactionPromptStyle: "key",
		persistent: true,
		tags: objectTags,
		interactionPromptLabel: () => ({
			text: `BUY ${reward.name} FOR ${getEffectiveOfferPrice(offer)} DEBRIS`,
			color: getOfferStatus(offer) === undefined
				? k.rgb(...UI_COLORS.text)
				: k.rgb(...UI_COLORS.danger),
		}),
		beforeCollect: () => {
			paidPrice = getEffectiveOfferPrice(offer)
			return beginPurchase(offer, paidPrice)
		},
		applyEffect: (purchasedReward, pickupPos) => {
			if (applyReward(purchasedReward, pickupPos)) return true
			addAvailableDebree(paidPrice)
			playRequirementErrorSound()
			return false
		},
		onCollected: () => {
			offer.purchased = true
			spawnCurrencyBurst(pos, {
				particleCount: purchaseBurstParticleCount(offer.price),
			})
			gameSoundService.play("purchase1", { volume: mainSoundVolume })
			if (pickup.exists()) k.destroy(pickup)
		},
	})
}

function getOfferStatus(
	offer: NonNullable<RoomFloorRoom["shopOffers"]>[number]
) {
	if (offer.purchased) return "SOLD"
	const definition = getRewardDefinition(offer.rewardId)
	if (!definition) return "UNAVAILABLE"
	const lockReason = getRewardLockReason(definition)
	if (lockReason) return lockReason.toUpperCase()
	const price = getEffectiveOfferPrice(offer)
	if (getScore() < price) return `NEED ${price - getScore()} MORE`
	return undefined
}

function beginPurchase(
	offer: NonNullable<RoomFloorRoom["shopOffers"]>[number],
	price = getEffectiveOfferPrice(offer)
) {
	if (getOfferStatus(offer)) {
		playRequirementErrorSound()
		return false
	}
	const floor = getActiveRoomFloor()
	if (!spendScore(price)) {
		playRequirementErrorSound()
		return false
	}
	if (getPilotProtocolValue("firstPurchaseDiscount") > 0 && floor) {
		floor.shopDiscountUsed = true
	}
	return true
}

function getEffectiveOfferPrice(
	offer: NonNullable<RoomFloorRoom["shopOffers"]>[number]
) {
	const floor = getActiveRoomFloor()
	if (!floor || floor.shopDiscountUsed) return offer.price
	const discount = getPilotProtocolValue("firstPurchaseDiscount")
	return Math.max(1, Math.round(offer.price * (1 - discount / 100)))
}
