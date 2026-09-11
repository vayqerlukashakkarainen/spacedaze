import type { GameObj, PosComp, Vec2 } from "kaplay"
import { k, layers, mainSoundVolume } from "../main"
import { starsEmitter } from "../particles"
import { gameSoundService } from "../services/audio/gameSoundService"
import { registerBatchedEntityUpdate } from "../services/core/entityUpdateService"
import { addPhaseCores } from "../services/economy/phaseCoreService"
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

const PHASE_CORE_PICKUP_RADIUS = 25
const PHASE_CORE_ATTRACTION_RADIUS = 115
const PHASE_CORE_LAUNCH_DURATION = 0.58

interface PhaseCorePickupOptions {
	objectTags?: string[]
	target?: GameObj<PosComp>
	forceToTarget?: boolean
	source?: "boss" | "armorer"
}

export function spawnPhaseCorePickup(
	pos: Vec2,
	options: PhaseCorePickupOptions = {}
) {
	const start = pos.clone()
	const launchDirection = options.target?.exists()
		? options.target.pos.sub(pos).unit()
		: k.Vec2.fromAngle(k.rand(205, 335))
	const launchEnd = start.add(launchDirection.scale(k.rand(34, 52)))
	let elapsed = 0
	let collected = false
	const pickup = k.add([
		k.pos(start),
		k.scale(1),
		k.layer(layers.game),
		k.z(70),
		tags.props,
		tags.gameLoop,
		tags.runtimeCullable,
		...(options.objectTags ?? [tags.runMap, tags.runRoom]),
	])
	const sprite = pickup.add([
		k.sprite("phase_core", { width: 16, height: 16 }),
		k.anchor("center"),
		k.rotate(0),
		k.color(...UI_COLORS.phaseCore),
		k.layer(layers.game),
		k.z(2),
	])
	const godrays = addGodRays(pickup, {
		innerRadius: 7,
		outerRadius: 43,
		rayCount: 12,
		opacity: 0.72,
		color: k.rgb(...UI_COLORS.phaseCore),
	})
	const light = addLocalLight(pickup, {
		size: 46,
		color: UI_COLORS.phaseCore,
		opacity: 0.58,
		pulse: {
			scaleMin: 0.9,
			scaleMax: 1.18,
			scaleSpeed: 3.1,
			opacityMin: 0.38,
			opacityMax: 0.64,
			opacitySpeed: 2.7,
		},
	})

	registerBatchedEntityUpdate("world", pickup, () => {
		elapsed += k.dt()
		updateLocalLight(light)
		godrays.angle += 16 * k.dt()
		godrays.opacity = k.wave(0.52, 0.78, k.time() * 2.2)
		sprite.angle = Math.sin(k.time() * 2.6) * 8

		if (elapsed < PHASE_CORE_LAUNCH_DURATION) {
			const progress = elapsed / PHASE_CORE_LAUNCH_DURATION
			pickup.pos = start.lerp(launchEnd, progress)
			pickup.pos.y -= Math.sin(progress * Math.PI) * 30
			pickup.scale = k.vec2(k.lerp(0.32, 1, Math.min(1, progress * 1.8)))
			return
		}

		const target = options.target?.exists()
			? options.target
			: k.get<PosComp>(tags.player)[0]
		if (!target?.exists()) return
		const distance = target.pos.dist(pickup.pos)
		if (options.forceToTarget || distance <= PHASE_CORE_ATTRACTION_RADIUS) {
			const response = options.forceToTarget ? 7.5 : 5.5
			pickup.pos = pickup.pos.lerp(
				target.pos,
				1 - Math.exp(-response * k.dt())
			)
		}
		pickup.scale = k.vec2(k.wave(0.96, 1.05, k.time() * 3.4))
		if (target.pos.dist(pickup.pos) <= PHASE_CORE_PICKUP_RADIUS) collect()
	})

	function collect() {
		if (collected || !pickup.exists()) return
		collected = true
		const collectedAt = pickup.pos.clone()
		addPhaseCores(1, options.source === "boss")
		saveGame("slot1")
		starsEmitter.emitter.position = collectedAt
		starsEmitter.emit(42)
		spawnFlash(collectedAt, 15, k.WHITE)
		spawnRing({
			pos: collectedAt,
			speed: 145,
			maxRadius: 62,
			intensity: 1,
			visualize: true,
			color: k.rgb(...UI_COLORS.phaseCore),
		})
		gameSoundService.play("powerup1", {
			volume: mainSoundVolume * 0.9,
			detune: 420,
		})
		showPopover({
			title: options.source === "armorer"
				? "ARMORER'S GIFT"
				: "PHASE CORE SECURED",
			message: "+1 PHASE CORE",
			description: options.source === "armorer"
				? "WEAPON RECONSTRUCTION ONLINE  //  SPEND AT A CLEARED PRIMARY RECORD"
				: "PERSISTENT  //  UNLOCKS WEAPONS AND EXPEDITION SYSTEMS",
			sprite: "phase_core",
			color: k.rgb(...UI_COLORS.phaseCore),
			duration: 4.2,
		})
		k.destroy(pickup)
	}

	return pickup
}
