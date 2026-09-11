import type { GameObj, PosComp, Vec2 } from "kaplay"
import { k, layers, mainSoundVolume } from "../main"
import { starsEmitter } from "../particles"
import { gameSoundService } from "../services/audio/gameSoundService"
import { registerBatchedEntityUpdate } from "../services/core/entityUpdateService"
import { addLassoTokens } from "../services/hub/lassoRigService"
import { showPopover } from "../services/ui/popoverService"
import { addLocalLight, updateLocalLight } from "../services/world/localLightService"
import { tags } from "../tags"
import { UI_COLORS } from "../ui/common"
import { saveGame } from "../util"
import { addGodRays } from "./addGodRays"
import { spawnFlash } from "./spawnFlash"
import { spawnRing } from "./spawnRing"

const PICKUP_RADIUS = 25
const ATTRACTION_RADIUS = 125
const LAUNCH_DURATION = 0.52

interface LassoTokenPickupOptions {
	objectTags?: string[]
	target?: GameObj<PosComp>
	forceToTarget?: boolean
}

export function spawnLassoTokenPickup(
	pos: Vec2,
	options: LassoTokenPickupOptions = {}
) {
	const start = pos.clone()
	const launchDirection = options.target?.exists()
		? options.target.pos.sub(pos).unit()
		: k.Vec2.fromAngle(k.rand(205, 335))
	const launchEnd = start.add(launchDirection.scale(k.rand(34, 50)))
	let elapsed = 0
	let collected = false
	const pickup = k.add([
		k.pos(start),
		k.scale(1),
		k.layer(layers.game),
		k.z(72),
		tags.props,
		tags.gameLoop,
		tags.runtimeCullable,
		...(options.objectTags ?? [tags.runMap, tags.runRoom]),
	])
	const sprite = pickup.add([
		k.sprite("salvage_lasso", { width: 18, height: 18 }),
		k.anchor("center"),
		k.rotate(0),
		k.color(...UI_COLORS.lassoToken),
		k.layer(layers.game),
		k.z(2),
	])
	const godrays = addGodRays(pickup, {
		innerRadius: 8,
		outerRadius: 42,
		rayCount: 9,
		opacity: 0.68,
		color: k.rgb(...UI_COLORS.lassoToken),
	})
	const light = addLocalLight(pickup, {
		size: 48,
		color: UI_COLORS.lassoToken,
		opacity: 0.54,
		pulse: {
			scaleMin: 0.9,
			scaleMax: 1.16,
			scaleSpeed: 3.4,
			opacityMin: 0.32,
			opacityMax: 0.6,
			opacitySpeed: 3,
		},
	})

	registerBatchedEntityUpdate("world", pickup, () => {
		elapsed += k.dt()
		updateLocalLight(light)
		godrays.angle -= 18 * k.dt()
		godrays.opacity = k.wave(0.46, 0.72, k.time() * 2.6)
		sprite.angle += 42 * k.dt()

		if (elapsed < LAUNCH_DURATION) {
			const progress = elapsed / LAUNCH_DURATION
			pickup.pos = start.lerp(launchEnd, progress)
			pickup.pos.y -= Math.sin(progress * Math.PI) * 28
			pickup.scale = k.vec2(k.lerp(0.3, 1, Math.min(1, progress * 1.9)))
			return
		}

		const target = options.target?.exists()
			? options.target
			: k.get<PosComp>(tags.player)[0]
		if (!target?.exists()) return
		const distance = target.pos.dist(pickup.pos)
		if (options.forceToTarget || distance <= ATTRACTION_RADIUS) {
			pickup.pos = pickup.pos.lerp(
				target.pos,
				1 - Math.exp(-(options.forceToTarget ? 7.5 : 5.8) * k.dt())
			)
		}
		pickup.scale = k.vec2(k.wave(0.96, 1.06, k.time() * 3.8))
		if (target.pos.dist(pickup.pos) <= PICKUP_RADIUS) collect()
	})

	function collect() {
		if (collected || !pickup.exists()) return
		collected = true
		const collectedAt = pickup.pos.clone()
		addLassoTokens(1)
		saveGame("slot1")
		starsEmitter.emitter.position = collectedAt
		starsEmitter.emit(40)
		spawnFlash(collectedAt, 15, k.WHITE)
		spawnRing({
			pos: collectedAt,
			speed: 165,
			maxRadius: 62,
			intensity: 0.95,
			visualize: true,
			color: k.rgb(...UI_COLORS.lassoToken),
		})
		gameSoundService.play("powerup1", {
			volume: mainSoundVolume * 0.9,
			detune: 440,
		})
		showPopover({
			title: "LASSO TOKEN SECURED",
			message: "+1 LASSO TOKEN",
			description: "PRECISION TRIAL  //  SPEND WITH THE QUARTERMASTER",
			sprite: "salvage_lasso",
			color: k.rgb(...UI_COLORS.lassoToken),
			duration: 4.2,
		})
		k.destroy(pickup)
	}

	return pickup
}
