import type { GameObj, PosComp, Vec2 } from "kaplay"
import { k, layers, mainSoundVolume } from "../main"
import { starsEmitter } from "../particles"
import { gameSoundService } from "../services/audio/gameSoundService"
import { registerBatchedEntityUpdate } from "../services/core/entityUpdateService"
import {
	collectPsionicPlate,
	type PsionicPlateMiniBossId,
} from "../services/economy/psionicPlateService"
import { showPopover } from "../services/ui/popoverService"
import {
	addLocalLight,
	updateLocalLight,
} from "../services/world/localLightService"
import { tags } from "../tags"
import { UI_COLORS } from "../ui/common"
import { saveGame } from "../util"
import { addGodRays } from "./addGodRays"
import { spawnFlash } from "./spawnFlash"
import { spawnRing } from "./spawnRing"

const PICKUP_RADIUS = 25
const ATTRACTION_RADIUS = 130
const LAUNCH_DURATION = 0.58

interface PsionicPlatePickupOptions {
	miniBossId: PsionicPlateMiniBossId
	guaranteed: boolean
	objectTags?: string[]
	target?: GameObj<PosComp>
}

export function spawnPsionicPlatePickup(
	pos: Vec2,
	options: PsionicPlatePickupOptions
) {
	const start = pos.clone()
	const launchDirection = options.target?.exists()
		? options.target.pos.sub(pos).unit()
		: k.Vec2.fromAngle(k.rand(205, 335))
	const launchEnd = start.add(launchDirection.scale(k.rand(38, 58)))
	let elapsed = 0
	let collected = false
	const pickup = k.add([
		k.pos(start),
		k.scale(1),
		k.layer(layers.game),
		k.z(71),
		tags.props,
		tags.gameLoop,
		tags.runtimeCullable,
		...(options.objectTags ?? [tags.runMap, tags.runRoom]),
	])
	const sprite = pickup.add([
		k.sprite("psionic_plate", { width: 18, height: 18 }),
		k.anchor("center"),
		k.rotate(0),
		k.color(...UI_COLORS.psionicPlate),
		k.layer(layers.game),
		k.z(2),
	])
	const godrays = addGodRays(pickup, {
		innerRadius: 8,
		outerRadius: 46,
		rayCount: 10,
		opacity: 0.72,
		color: k.rgb(...UI_COLORS.psionicPlate),
	})
	const light = addLocalLight(pickup, {
		size: 52,
		color: UI_COLORS.psionicPlate,
		opacity: 0.62,
		pulse: {
			scaleMin: 0.9,
			scaleMax: 1.2,
			scaleSpeed: 3.4,
			opacityMin: 0.4,
			opacityMax: 0.68,
			opacitySpeed: 2.9,
		},
	})

	registerBatchedEntityUpdate("world", pickup, () => {
		elapsed += k.dt()
		updateLocalLight(light)
		godrays.angle -= 14 * k.dt()
		godrays.opacity = k.wave(0.52, 0.8, k.time() * 2.4)
		sprite.angle = Math.sin(k.time() * 2.8) * 7

		if (elapsed < LAUNCH_DURATION) {
			const progress = elapsed / LAUNCH_DURATION
			pickup.pos = start.lerp(launchEnd, progress)
			pickup.pos.y -= Math.sin(progress * Math.PI) * 34
			pickup.scale = k.vec2(k.lerp(0.3, 1, Math.min(1, progress * 1.8)))
			return
		}

		const target = options.target?.exists()
			? options.target
			: k.get<PosComp>(tags.player)[0]
		if (!target?.exists()) return
		if (target.pos.dist(pickup.pos) <= ATTRACTION_RADIUS) {
			pickup.pos = pickup.pos.lerp(
				target.pos,
				1 - Math.exp(-5.8 * k.dt())
			)
		}
		pickup.scale = k.vec2(k.wave(0.96, 1.06, k.time() * 3.6))
		if (target.pos.dist(pickup.pos) <= PICKUP_RADIUS) collect()
	})

	function collect() {
		if (collected || !pickup.exists()) return
		collected = true
		const collectedAt = pickup.pos.clone()
		const result = collectPsionicPlate(options.miniBossId)
		saveGame("slot1")
		starsEmitter.emitter.position = collectedAt
		starsEmitter.emit(48)
		spawnFlash(collectedAt, 16, k.WHITE)
		spawnRing({
			pos: collectedAt,
			speed: 150,
			maxRadius: 66,
			intensity: 1,
			visualize: true,
			color: k.rgb(...UI_COLORS.psionicPlate),
		})
		gameSoundService.play("powerup1", {
			volume: mainSoundVolume,
			detune: 620,
		})
		showPopover({
			title: "PSIONIC PLATE SECURED",
			message: "+1 PSIONIC PLATE",
			description: result.firstClear && options.guaranteed
				? "FIRST-CLEAR GUARANTEE  //  PERMANENT MAX-HULL CURRENCY"
				: "MINIBOSS SALVAGE  //  SPEND WITH THE QUARTERMASTER",
			sprite: "psionic_plate",
			color: k.rgb(...UI_COLORS.psionicPlate),
			duration: 4.2,
		})
		k.destroy(pickup)
	}

	return pickup
}
