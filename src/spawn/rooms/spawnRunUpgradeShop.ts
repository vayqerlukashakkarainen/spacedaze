import type { Vec2 } from "kaplay"
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
	REWARD_RARITY_COLORS,
} from "../../services/rewardService"
import { addAvailableDebree } from "../../services/debreeEconomyService"
import { getActiveRoomFloor } from "../../services/roomFloorService"
import { selectRunUpgradeShopOffers } from "../../services/runUpgradeShopService"
import {
	getThreatRomanNumeral,
	getThreatSnapshot,
} from "../../services/threatService"
import { audioService } from "../../services/audioService"
import { playRequirementErrorSound } from "../../services/uiSoundService"
import {
	purchaseBurstParticleCount,
	spawnCurrencyBurst,
} from "../spawnCurrencyBurst"
import { addCollectedPowerup } from "../../ui/gameUi"
import { spawnBuilding } from "../spawnBuilding"

export function spawnRunUpgradeShop(
	pos: Vec2,
	room: RoomFloorRoom,
	objectTags: string[]
) {
	ensureShopOffers(room)
	const shop = spawnBuilding({
		pos: pos.add(0, -70),
		sprite: "recovery_shop_1bit",
		scale: 1,
		interactRadius: 0,
		interactionPrompt: false,
		tags: objectTags,
	})
	shop.use(k.color(105, 205, 235))
	const offsets = [
		k.vec2(-145, 100),
		k.vec2(0, 135),
		k.vec2(145, 100),
	]
	for (let index = 0; index < (room.shopOffers?.length ?? 0); index++) {
		const offer = room.shopOffers![index]
		if (offer.purchased) continue
		spawnShopOffer(pos.add(offsets[index]), room, offer, objectTags)
	}
	return shop
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
	room: RoomFloorRoom,
	offer: NonNullable<RoomFloorRoom["shopOffers"]>[number],
	objectTags: string[]
) {
	const definition = getRewardDefinition(offer.rewardId)
	if (!definition) return
	const rarityColor = REWARD_RARITY_COLORS[offer.rarity]
	let pickup: ReturnType<typeof spawnBuilding>
	pickup = spawnBuilding({
		pos,
		sprite: definition.sprite,
		spriteSize: k.vec2(28, 28),
		interactRadius: 72,
		interactPromptOffset: k.vec2(0, -80),
		interactionPrompt: () => {
			const status = getOfferStatus(offer)
			return {
				title: definition.name,
				action: status ?? `BUY  ${offer.price} DEBRIS`,
				detailLeft: `DEPTH ${room.shopPricing?.depth ?? 1}  //  THREAT ${getThreatRomanNumeral(room.shopPricing?.difficulty ?? 1)}`,
				detailRight: offer.rarity,
				requirementsMet: status === undefined,
			}
		},
		tags: objectTags,
		onInteract: () => purchaseOffer(pickup, offer),
	})
	pickup.use(k.color(...rarityColor))
	pickup.add([
		k.circle(27),
		k.anchor("center"),
		k.color(4, 12, 18),
		k.outline(2, k.rgb(...rarityColor)),
		k.z(-1),
	])
	const price = pickup.add([
		k.text(`${offer.price} DEBRIS`, {
			font: "unscii",
			size: 9,
		}),
		k.pos(0, -46),
		k.anchor("center"),
		k.color(...UI_PRICE_COLOR),
		k.layer(layers.gameText),
	])
	price.onUpdate(() => {
		price.color = getScore() >= offer.price
			? k.rgb(...UI_PRICE_COLOR)
			: k.rgb(255, 80, 80)
	})
}

const UI_PRICE_COLOR: [number, number, number] = [255, 255, 255]

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

function purchaseOffer(
	pickup: ReturnType<typeof spawnBuilding>,
	offer: NonNullable<RoomFloorRoom["shopOffers"]>[number]
) {
	if (getOfferStatus(offer)) {
		playRequirementErrorSound()
		return
	}
	const reward = createReward(offer.rewardId, offer.rarity)
	if (!reward || !spendScore(offer.price)) {
		playRequirementErrorSound()
		return
	}
	if (!applyReward(reward, pickup.pos)) {
		addAvailableDebree(offer.price)
		playRequirementErrorSound()
		return
	}
	offer.purchased = true
	addCollectedPowerup(reward)
	spawnCurrencyBurst(pickup.pos, {
		particleCount: purchaseBurstParticleCount(offer.price),
	})
	audioService.playSound("purchase1", { volume: mainSoundVolume })
	k.destroy(pickup)
}
