import type { GameObj, PosComp, Vec2 } from "kaplay"
import { k, layers, mainSoundVolume } from "../main"
import { starsEmitter } from "../particles"
import { gameSoundService } from "../services/audio/gameSoundService"
import { registerBatchedEntityUpdate } from "../services/core/entityUpdateService"
import { addThrusterParts } from "../services/economy/thrusterPartService"
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
const ATTRACTION_RADIUS = 115
const LAUNCH_DURATION = 0.52

interface ThrusterPartPickupOptions {
	objectTags?: string[]
	target?: GameObj<PosComp>
	forceToTarget?: boolean
}

export function spawnThrusterPartPickup(
	pos: Vec2,
	options: ThrusterPartPickupOptions = {}
) {
	const start = pos.clone()
	const launchDirection = options.target?.exists()
		? options.target.pos.sub(pos).unit()
		: k.Vec2.fromAngle(k.rand(205, 335))
	const launchEnd = start.add(launchDirection.scale(k.rand(30, 46)))
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
		k.sprite("thruster_part", { width: 16, height: 16 }),
		k.anchor("center"),
		k.rotate(0),
		k.color(...UI_COLORS.thrusterPart),
		k.layer(layers.game),
		k.z(2),
	])
	const godrays = addGodRays(pickup, {
		innerRadius: 7,
		outerRadius: 36,
		rayCount: 9,
		opacity: 0.62,
		color: k.rgb(...UI_COLORS.thrusterPart),
	})
	const light = addLocalLight(pickup, {
		size: 42,
		color: UI_COLORS.thrusterPart,
		opacity: 0.5,
		pulse: {
			scaleMin: 0.9,
			scaleMax: 1.15,
			scaleSpeed: 3.4,
			opacityMin: 0.3,
			opacityMax: 0.56,
			opacitySpeed: 3,
		},
	})

	registerBatchedEntityUpdate("world", pickup, () => {
		elapsed += k.dt()
		updateLocalLight(light)
		godrays.angle -= 20 * k.dt()
		godrays.opacity = k.wave(0.42, 0.68, k.time() * 2.5)
		sprite.angle += 36 * k.dt()

		if (elapsed < LAUNCH_DURATION) {
			const progress = elapsed / LAUNCH_DURATION
			pickup.pos = start.lerp(launchEnd, progress)
			pickup.pos.y -= Math.sin(progress * Math.PI) * 25
			pickup.scale = k.vec2(k.lerp(0.35, 1, Math.min(1, progress * 1.9)))
			return
		}

		const target = options.target?.exists()
			? options.target
			: k.get<PosComp>(tags.player)[0]
		if (!target?.exists()) return
		const distance = target.pos.dist(pickup.pos)
		if (options.forceToTarget || distance <= ATTRACTION_RADIUS) {
			const response = options.forceToTarget ? 7.5 : 5.5
			pickup.pos = pickup.pos.lerp(
				target.pos,
				1 - Math.exp(-response * k.dt())
			)
		}
		pickup.scale = k.vec2(k.wave(0.96, 1.05, k.time() * 3.7))
		if (target.pos.dist(pickup.pos) <= PICKUP_RADIUS) collect()
	})

	function collect() {
		if (collected || !pickup.exists()) return
		collected = true
		const collectedAt = pickup.pos.clone()
		addThrusterParts(1)
		saveGame("slot1")
		starsEmitter.emitter.position = collectedAt
		starsEmitter.emit(34)
		spawnFlash(collectedAt, 14, k.WHITE)
		spawnRing({
			pos: collectedAt,
			speed: 150,
			maxRadius: 56,
			intensity: 0.9,
			visualize: true,
			color: k.rgb(...UI_COLORS.thrusterPart),
		})
		gameSoundService.play("powerup1", {
			volume: mainSoundVolume * 0.9,
			detune: 260,
		})
		showPopover({
			title: "THRUSTER PART SECURED",
			message: "+1 THRUSTER PART",
			description: "PERSISTENT  //  UPGRADES CRUISE AND STRAFE THRUSTERS",
			sprite: "thruster_part",
			color: k.rgb(...UI_COLORS.thrusterPart),
			duration: 4.2,
		})
		k.destroy(pickup)
	}

	return pickup
}
