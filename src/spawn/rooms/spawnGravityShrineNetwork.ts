import type { Vec2 } from "kaplay"
import { playerObj } from "../../game"
import { k, layers } from "../../main"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import { resetPlayerPath } from "../../services/player/playerPathService"
import { tags } from "../../tags"
import { spawnGravityPull } from "../spawnGravityPull"
import { spawnRing } from "../spawnRing"
import { getWorldVisual } from "../../visuals/worldVisualCatalog"
import { requirePrimaryVisualSprite } from "../../visuals/visualRepresentation"

const GRAVITY_COLOR = [174, 112, 255] as const
const TELEPORT_RADIUS = 12
const REARM_RADIUS = 28
const GRAVITY_SHRINE_VISUAL = getWorldVisual("gravity-shrine")

interface GravityShrineNetworkProps {
	positions: Vec2[]
	pullRadius: number
	pullStrength: number
	tags?: string[]
}

export function spawnGravityShrineNetwork(
	props: GravityShrineNetworkProps
) {
	const positions = props.positions.map((position) => position.clone())
	let teleportArmed = true
	const shrines = positions.map((position, index) =>
		spawnGravityShrine(position, index)
	)

	function spawnGravityShrine(position: Vec2, index: number) {
		const shrine = k.add([
			k.pos(position),
			k.layer(layers.buildings),
			{
				hb: 28 * GRAVITY_SHRINE_VISUAL.worldScale,
				runtimeCullRadius: props.pullRadius + 24,
				groundShadowMode: "ground" as const,
			},
			tags.props,
			tags.gameLoop,
			tags.runtimeCullable,
			...(props.tags ?? []),
		])
		const core = shrine.add([
			k.sprite(requirePrimaryVisualSprite(GRAVITY_SHRINE_VISUAL)),
			k.anchor("center"),
			k.scale(GRAVITY_SHRINE_VISUAL.worldScale),
			k.color(205, 185, 255),
			k.layer(layers.buildings),
		])
		const field = shrine.add([
			k.circle(props.pullRadius, { fill: false }),
			k.outline(1, k.rgb(...GRAVITY_COLOR)),
			k.anchor("center"),
			k.opacity(0.12),
			k.layer(layers.gameEffects),
			k.z(-2),
		])
		const coreRing = shrine.add([
			k.circle(18, { fill: false }),
			k.outline(2, k.rgb(...GRAVITY_COLOR)),
			k.anchor("center"),
			k.opacity(0.72),
			k.scale(1),
			k.layer(layers.gameEffects),
		])
		const gravity = spawnGravityPull({
			pos: position,
			radius: props.pullRadius,
			strength: props.pullStrength,
			falloff: 0.72,
			targetTags: [tags.player, tags.enemy, tags.projectile, tags.debree],
			tagStrengthMultipliers: {
				[tags.player]: 0.72,
				[tags.projectile]: 1.4,
				[tags.debree]: 1.2,
			},
			visualizePull: true,
			tags: props.tags,
		})

		registerBatchedEntityUpdate("world", shrine, () => {
			field.opacity = k.wave(0.06, 0.16, k.time() * 1.7 + index)
			coreRing.scale = k.vec2(k.wave(0.82, 1.18, k.time() * 3 + index))
			coreRing.opacity = k.wave(0.38, 0.82, k.time() * 3 + index)
			core.color = k.rgb(
				k.wave(180, 225, k.time() * 2.2 + index),
				k.wave(145, 200, k.time() * 2.2 + index),
				255
			)
			updateTeleport(index)
		})

		shrine.onDestroy(() => {
			if (gravity.exists()) k.destroy(gravity)
		})
		return shrine
	}

	function updateTeleport(sourceIndex: number) {
		if (!playerObj?.exists() || positions.length < 2) return
		if (!teleportArmed) {
			teleportArmed = positions.every(
				(position) => playerObj.pos.dist(position) > REARM_RADIUS
			)
			return
		}
		if (playerObj.pos.dist(positions[sourceIndex]) > TELEPORT_RADIUS) return

		const destinationIndices = positions
			.map((_, index) => index)
			.filter((index) => index !== sourceIndex)
		const destinationIndex = destinationIndices[
			Math.floor(k.rand(destinationIndices.length))
		]
		const start = playerObj.pos.clone()
		const destination = positions[destinationIndex]
		teleportArmed = false
		spawnTeleportEffect(start, 0.38, 64)
		playerObj.pos = destination.clone()
		resetPlayerPath(playerObj.pos)
		spawnTeleportEffect(destination, 0.5, 82)
	}

	return shrines
}

function spawnTeleportEffect(pos: Vec2, intensity: number, maxRadius: number) {
	spawnRing({
		pos,
		speed: 250,
		intensity,
		maxRadius,
		color: k.rgb(...GRAVITY_COLOR),
	})
}
