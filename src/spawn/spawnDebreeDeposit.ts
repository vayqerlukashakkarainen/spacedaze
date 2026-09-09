import type { GameObj, PosComp, Vec2 } from "kaplay"
import { addBuildingPlayerDepth } from "../comp/buildingPlayerDepth"
import { interactable, type InteractableComp } from "../comp/interactable"
import { k, layers, mainSoundVolume } from "../main"
import { starsEmitter } from "../particles"
import { gameSoundService } from "../services/gameSoundService"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import { tags } from "../tags"
import { createNpcInteractionPrompt } from "../ui/common"
import { saveGame } from "../util"
import { showDebreeDepositPanel } from "../ui/debreeDepositPanel"
import { spawnCurrencyBurst } from "./spawnCurrencyBurst"
import { getWorldVisual } from "../visuals/worldVisualCatalog"
import { requirePrimaryVisualSprite } from "../visuals/visualRepresentation"

const DEPOSIT_RADIUS = 88
const FOUNDATION_VISUAL = getWorldVisual("debris-foundation")
const HOUSE_VISUAL = getWorldVisual("debris-house")
const FOUNDATION_Y = 8
const HOUSE_Y = -24
const RECEIVER_X = 34
const RECEIVER_Y = -5
const FLOAT_AMOUNT = 2
const FLOAT_SPEED = 1.15

interface DebreeDepositOptions {
	available?: () => boolean
	onDeposit?: (amount: number) => void
	tags?: string[]
}

export function spawnDebreeDeposit(
	pos: Vec2,
	options: DebreeDepositOptions = {}
) {
	const available = options.available ?? (() => true)
	const station = k.add([
		k.pos(pos),
		interactable(DEPOSIT_RADIUS, () => {
			if (!available()) return
			showDebreeDepositPanel({
				onDeposit: playDepositEffect,
			})
		}),
		tags.debreeDeposit,
		tags.runMap,
		tags.props,
		tags.gameLoop,
		tags.runtimeCullable,
		{ runtimeCullRadius: 120 },
		...(options.tags ?? []),
	]) as GameObj<PosComp | InteractableComp>

	function playDepositEffect(deposited: number) {
		saveGame("slot1")
		const floatOffset = Math.sin(k.time() * FLOAT_SPEED) * FLOAT_AMOUNT
		const effectPos = station.pos.add(
			RECEIVER_X,
			RECEIVER_Y + floatOffset
		)
		starsEmitter.emitter.position = effectPos.clone()
		starsEmitter.emit(Math.min(54, 16 + deposited))
		spawnCurrencyBurst(effectPos, {
			particleCount: Math.min(72, 12 + deposited),
			tags: [tags.runMap],
		})
		gameSoundService.play("purchase1", { volume: mainSoundVolume })
		options.onDeposit?.(deposited)
	}

	const foundation = station.add([
		k.pos(0, FOUNDATION_Y),
		k.sprite(requirePrimaryVisualSprite(FOUNDATION_VISUAL)),
		k.anchor("center"),
		k.scale(FOUNDATION_VISUAL.worldScale),
		k.shader("rockFoundationPalette"),
		k.layer(layers.buildings),
		k.z(-12),
	])
	const house = station.add([
		k.pos(0, HOUSE_Y),
		k.sprite(requirePrimaryVisualSprite(HOUSE_VISUAL)),
		k.anchor("center"),
		k.scale(HOUSE_VISUAL.worldScale),
		k.color(170, 184, 192),
		k.layer(layers.game),
		k.z(-20),
	])
	addBuildingPlayerDepth(house, {
		centerY: () => station.pos.y + house.pos.y,
		renderedHeight: () => house.height * Math.abs(house.scale.y),
	})
	const prompt = createNpcInteractionPrompt({
		target: station,
		offset: k.vec2(0, -92),
	})

	registerBatchedEntityUpdate("world", station, () => {
		station.setInteractRadius(available() ? DEPOSIT_RADIUS : 0)
		prompt.update(station.isInRange && k.get(tags.player).length > 0)
		const floatOffset = Math.sin(k.time() * FLOAT_SPEED) * FLOAT_AMOUNT
		foundation.pos.y = FOUNDATION_Y + floatOffset
		house.pos.y = HOUSE_Y + floatOffset
	})

	return station
}
