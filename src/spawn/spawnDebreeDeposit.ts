import type { GameObj, PosComp, Vec2 } from "kaplay"
import { interactable, type InteractableComp } from "../comp/interactable"
import { k, layers, mainSoundVolume } from "../main"
import { starsEmitter } from "../particles"
import { audioService } from "../services/audioService"
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

const DEPOSIT_RADIUS = 76

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
	]) as GameObj<PosComp | InteractableComp>

	function playDepositEffect(deposited: number) {
		saveGame("slot1")
		starsEmitter.emitter.position = station.pos.clone()
		starsEmitter.emit(Math.min(54, 16 + deposited))
		spawnCurrencyBurst(station.pos.clone(), {
			particleCount: Math.min(72, 12 + deposited),
			tags: [tags.runMap],
		})
		spawnRing({
			pos: station.pos.clone(),
			speed: 240,
			intensity: 0.35,
			maxRadius: 100,
			color: k.rgb(...UI_COLORS.success),
		})
		audioService.playSound("purchase1", { volume: mainSoundVolume })
	}

	station.add([
		k.pos(0, 19),
		k.rect(46, 10),
		k.anchor("center"),
		k.color(...UI_COLORS.panelRaised),
		k.outline(2, k.rgb(...UI_COLORS.accent)),
		k.layer(layers.buildings),
	])
	for (const x of [-17, 17]) {
		station.add([
			k.pos(x, 0),
			k.rect(6, 38),
			k.anchor("center"),
			k.color(...UI_COLORS.panelRaised),
			k.outline(1, k.rgb(...UI_COLORS.accent)),
			k.layer(layers.buildings),
		])
	}
	const ring = station.add([
		k.circle(22, { fill: false }),
		k.anchor("center"),
		k.outline(2, k.rgb(...UI_COLORS.success)),
		k.opacity(0.7),
		k.layer(layers.gameEffects),
	])
	const core = station.add([
		k.sprite("debree_part1", { width: 18, height: 18 }),
		k.anchor("center"),
		k.color(...UI_COLORS.success),
		k.layer(layers.gameEffects),
	])
	const prompt = createInteractionPrompt({
		target: station,
		offset: k.vec2(0, -70),
		content: () => ({
			title: "DEBREE RELAY",
			action: getCarriedDebree() > 0
				? "MANAGE DEPOSIT"
				: "NO DEBREE TO DEPOSIT",
			detailLeft: `${getCarriedDebree()} CARRIED`,
			detailRight: `${getDepositedDebree()} SAFE`,
		}),
	})

	registerBatchedEntityUpdate("world", station, () => {
		prompt.update(station.isInRange && k.get(tags.player).length > 0)
		const pulse = k.wave(0.88, 1.12, k.time() * 3.4)
		core.scale = k.vec2(pulse)
		ring.scale = k.vec2(k.wave(0.92, 1.08, k.time() * 2.6))
		ring.opacity = k.wave(0.45, 0.85, k.time() * 2.8)
	})

	return station
}
