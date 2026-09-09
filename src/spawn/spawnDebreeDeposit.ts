import type { GameObj, PosComp, Vec2 } from "kaplay"
import { addBuildingPlayerDepth } from "../comp/buildingPlayerDepth"
import { interactable, type InteractableComp } from "../comp/interactable"
import { k, layers, mainSoundVolume } from "../main"
import { starsEmitter } from "../particles"
import { gameSoundService } from "../services/gameSoundService"
import {
	getCarriedDebree,
	getDepositedDebree,
} from "../services/debreeEconomyService"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import { tags } from "../tags"
import { createInteractionPrompt, UI_COLORS } from "../ui/common"
import { saveGame } from "../util"
import { showDebreeDepositPanel } from "../ui/debreeDepositPanel"
import { spawnCurrencyBurst } from "./spawnCurrencyBurst"
import { spawnRing } from "./spawnRing"
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

export function spawnDebreeDeposit(pos: Vec2) {
	const station = k.add([
		k.pos(pos),
		interactable(DEPOSIT_RADIUS, () => {
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
	]) as GameObj<PosComp | InteractableComp>

	function playDepositEffect(deposited: number) {
		saveGame("slot1")
		const effectPos = station.pos.add(RECEIVER_X, ring.pos.y)
		starsEmitter.emitter.position = effectPos.clone()
		starsEmitter.emit(Math.min(54, 16 + deposited))
		spawnCurrencyBurst(effectPos, {
			particleCount: Math.min(72, 12 + deposited),
			tags: [tags.runMap],
		})
		spawnRing({
			pos: effectPos,
			speed: 240,
			intensity: 0.35,
			maxRadius: 100,
			color: k.rgb(...UI_COLORS.success),
		})
		gameSoundService.play("purchase1", { volume: mainSoundVolume })
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
	const ring = station.add([
		k.pos(RECEIVER_X, RECEIVER_Y),
		k.circle(16, { fill: false }),
		k.anchor("center"),
		k.outline(2, k.rgb(...UI_COLORS.success)),
		k.opacity(0.7),
		k.layer(layers.gameEffects),
	])
	const core = station.add([
		k.pos(RECEIVER_X, RECEIVER_Y),
		k.sprite("debree_part1", { width: 14, height: 14 }),
		k.anchor("center"),
		k.color(...UI_COLORS.success),
		k.layer(layers.gameEffects),
	])
	const prompt = createInteractionPrompt({
		target: station,
		offset: k.vec2(0, -92),
		content: () => ({
			title: "SALVAGE RELAY",
			action: getCarriedDebree() > 0
				? "MANAGE DEPOSIT"
				: "NO SALVAGE TO DEPOSIT",
			detailLeft: `${getCarriedDebree()} CARRIED`,
			detailRight: `${getDepositedDebree()} SAFE`,
		}),
	})

	registerBatchedEntityUpdate("world", station, () => {
		prompt.update(station.isInRange && k.get(tags.player).length > 0)
		const floatOffset = Math.sin(k.time() * FLOAT_SPEED) * FLOAT_AMOUNT
		foundation.pos.y = FOUNDATION_Y + floatOffset
		house.pos.y = HOUSE_Y + floatOffset
		ring.pos.y = RECEIVER_Y + floatOffset
		core.pos.y = RECEIVER_Y + floatOffset
		const pulse = k.wave(0.88, 1.12, k.time() * 3.4)
		core.scale = k.vec2(pulse)
		ring.scale = k.vec2(k.wave(0.92, 1.08, k.time() * 2.6))
		ring.opacity = k.wave(0.45, 0.85, k.time() * 2.8)
	})

	return station
}
