import type { Vec2 } from "kaplay"
import { k, layers, mainSoundVolume } from "../../main"
import { starsEmitter } from "../../particles"
import { addFloorKeys } from "../../services/world/roomFloorService"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import {
	addLocalLight,
	updateLocalLight,
} from "../../services/world/localLightService"
import { gameSoundService } from "../../services/audio/gameSoundService"
import { tags } from "../../tags"
import { UI_COLORS } from "../../ui/common"
import { showPopover } from "../../services/ui/popoverService"
import { spawnFlash } from "../spawnFlash"
import { spawnRing } from "../spawnRing"
import { getPickupVisual } from "../../visuals/pickupVisualCatalog"
import { requirePrimaryVisualSprite } from "../../visuals/visualRepresentation"

const KEY_LAUNCH_DURATION = 0.5
const KEY_PICKUP_RADIUS = 24

export function spawnRoomKeyPickup(
	pos: Vec2,
	objectTags: string[] = [tags.runMap, tags.runRoom]
) {
	const visual = getPickupVisual("room-key")
	const start = pos.clone()
	const direction = k.Vec2.fromAngle(k.rand(205, 335))
	const end = start.add(direction.scale(k.rand(28, 44)))
	let elapsed = 0
	let collected = false
	const pickup = k.add([
		k.pos(start),
		k.sprite(requirePrimaryVisualSprite(visual), { width: 24, height: 24 }),
		k.anchor("center"),
		k.rotate(k.rand(360)),
		k.scale(visual.worldScale),
		k.color(k.WHITE),
		k.outline(1, k.rgb(...UI_COLORS.warning)),
		k.layer(layers.game),
		k.z(60),
		tags.props,
		tags.gameLoop,
		tags.runtimeCullable,
		...objectTags,
	])
	const ring = pickup.add([
		k.circle(17, { fill: false }),
		k.anchor("center"),
		k.opacity(0.7),
		k.scale(1),
		k.outline(1, k.rgb(...UI_COLORS.warning)),
		k.layer(layers.gameEffects),
		k.z(-1),
	])
	const light = addLocalLight(pickup, {
		size: 46,
		color: UI_COLORS.warning,
		opacity: 0.5,
		pulse: {
			scaleMin: 0.9,
			scaleMax: 1.12,
			scaleSpeed: 3.2,
			opacityMin: 0.32,
			opacityMax: 0.56,
			opacitySpeed: 2.8,
		},
	})

	registerBatchedEntityUpdate("world", pickup, () => {
		elapsed += k.dt()
		updateLocalLight(light)
		if (elapsed < KEY_LAUNCH_DURATION) {
			const progress = elapsed / KEY_LAUNCH_DURATION
			pickup.pos = start.lerp(end, progress)
			pickup.pos.y -= Math.sin(progress * Math.PI) * 24
			pickup.scale = k.vec2(k.lerp(0.45, 1, Math.min(1, progress * 2)))
			pickup.angle += 480 * k.dt()
			return
		}
		pickup.angle += 45 * k.dt()
		pickup.scale = k.vec2(k.wave(0.96, 1.04, k.time() * 3))
		ring.scale = k.vec2(k.wave(0.9, 1.15, k.time() * 2.4))
		const player = k.get(tags.player)[0]
		if (!player?.exists() || player.pos.dist(pickup.pos) > KEY_PICKUP_RADIUS) return
		collect()
	})

	function collect() {
		if (collected || !pickup.exists()) return
		collected = true
		const collectedAt = pickup.pos.clone()
		addFloorKeys(1)
		starsEmitter.emitter.position = collectedAt
		starsEmitter.emit(24)
		spawnFlash(collectedAt, 9, k.rgb(...UI_COLORS.warning))
		spawnRing({
			pos: collectedAt,
			speed: 95,
			maxRadius: 34,
			intensity: 0.7,
			visualize: true,
			color: k.rgb(...UI_COLORS.warning),
		})
		gameSoundService.play("powerup1", {
			volume: mainSoundVolume * 0.7,
			detune: 220,
		})
		showPopover({
			title: "ACCESS KEY",
			message: "+1 PHASE KEY",
			description: "UNLOCKS ONE TREASURE OR SHOP DOOR",
			sprite: "room_phase_key",
			color: k.rgb(...UI_COLORS.warning),
			duration: 2.8,
		})
		k.destroy(pickup)
	}

	return pickup
}
