import type { GameObj, PosComp, Vec2 } from "kaplay"
import { interactable, INTERACTION_PRIORITY } from "../../comp/interactable"
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
} from "../../services/rewardService"
import { addAvailableDebree } from "../../services/debreeEconomyService"
import { getActiveRoomFloor } from "../../services/roomFloorService"
import { selectRunUpgradeShopOffers } from "../../services/runUpgradeShopService"
import { getThreatSnapshot } from "../../services/threatService"
import { audioService } from "../../services/audioService"
import { playCutscene, type CutsceneDefinition } from "../../services/cutsceneService"
import { registerBatchedEntityUpdate } from "../../services/entityUpdateService"
import {
	hasSeenNpcDialogue,
	markNpcDialogueSeen,
	registerNpcDialogueTrigger,
} from "../../services/npcDialogueService"
import { registerNpcDialogueIndicator } from "../../services/npcDialogueIndicatorService"
import { playRequirementErrorSound } from "../../services/uiSoundService"
import {
	purchaseBurstParticleCount,
	spawnCurrencyBurst,
} from "../spawnCurrencyBurst"
import { createNpcInteractionPrompt, UI_COLORS } from "../../ui/common"
import { tags } from "../../tags"
import { spawnRewardPickup } from "../spawnPowerup"

const SHOPKEEPER_DIALOGUE_ID = "void-profit"
const SHOPKEEPER_INTERACT_RADIUS = 86
const SHOPKEEPER_LINES = [
	{
		speaker: "MARGIN",
		text: "The Daze remembers the Wake. I remember where it kept the expensive parts.",
	},
	{
		speaker: "MARGIN",
		text: "Federation crews declared this stock theirs during the Claim. I found their paperwork unconvincing.",
	},
	{
		speaker: "MARGIN",
		text: "You recover Drius Wake. I recover a reasonable margin. Community requires specialization.",
	},
] as const

export function spawnRunUpgradeShop(
	pos: Vec2,
	room: RoomFloorRoom,
	objectTags: string[]
) {
	ensureShopOffers(room)
	const shopkeeper = spawnRunShopkeeper(pos.add(0, -70), objectTags)
	const offsets = [
		k.vec2(-145, 100),
		k.vec2(0, 135),
		k.vec2(145, 100),
	]
	for (let index = 0; index < (room.shopOffers?.length ?? 0); index++) {
		const offer = room.shopOffers![index]
		if (offer.purchased) continue
		spawnShopOffer(pos.add(offsets[index]), offer, objectTags)
	}
	return shopkeeper
}

function spawnRunShopkeeper(pos: Vec2, objectTags: string[]) {
	let talking = false
	const shopkeeper = k.add([
		k.pos(pos),
		k.sprite("drone_salvager", { width: 24, height: 24 }),
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
		tags.props,
		tags.gameLoop,
		tags.runtimeCullable,
		...objectTags,
	])
	const prompt = createNpcInteractionPrompt({
		target: shopkeeper,
		offset: k.vec2(0, -44),
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
		const player = k.get<GameObj<PosComp>>(tags.player)[0]
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
				lines: SHOPKEEPER_LINES.slice(0, 2),
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
				lines: SHOPKEEPER_LINES.slice(2),
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
		3,
		pricing
	)
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
	let pickup: NonNullable<ReturnType<typeof spawnRewardPickup>>
	pickup = spawnRewardPickup(pos, reward, {
		stationary: true,
		interactionOnly: true,
		interactionRadius: 72,
		interactionPromptStyle: "key",
		persistent: true,
		tags: objectTags,
		interactionPromptLabel: () => ({
			text: `${reward.name}  //  ${offer.price}`,
			color: getOfferStatus(offer) === undefined
				? k.rgb(...UI_COLORS.text)
				: k.rgb(...UI_COLORS.danger),
		}),
		beforeCollect: () => beginPurchase(offer),
		applyEffect: (purchasedReward, pickupPos) => {
			if (applyReward(purchasedReward, pickupPos)) return true
			addAvailableDebree(offer.price)
			playRequirementErrorSound()
			return false
		},
		onCollected: () => {
			offer.purchased = true
			spawnCurrencyBurst(pos, {
				particleCount: purchaseBurstParticleCount(offer.price),
			})
			audioService.playSound("purchase1", { volume: mainSoundVolume })
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
	if (getScore() < offer.price) return `NEED ${offer.price - getScore()} MORE`
	return undefined
}

function beginPurchase(
	offer: NonNullable<RoomFloorRoom["shopOffers"]>[number]
) {
	if (getOfferStatus(offer)) {
		playRequirementErrorSound()
		return false
	}
	if (!spendScore(offer.price)) {
		playRequirementErrorSound()
		return false
	}
	return true
}
