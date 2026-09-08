import type { Vec2 } from "kaplay"
import { k, layers } from "../../main"
import { registerBatchedEntityUpdate } from "../../services/entityUpdateService"
import {
	addLocalLight,
	updateLocalLight,
} from "../../services/localLightService"
import { tags } from "../../tags"
import { spawnHealthOrb } from "../spawnHealthOrb"

const HEALTH_SHRINE_SCALE = 1.5
const HEALTH_ORB_COUNT = 3
const HEALTH_ORB_RADIUS = 46
const TRAINING_ORB_RESPAWN_DELAY = 1.4
const HEALTH_COLOR = [70, 255, 120] as const

interface HealthShrineProps {
	pos: Vec2
	respawnOrbs?: boolean
	tags?: string[]
	onDepleted?: () => void
}

export function spawnHealthShrine(props: HealthShrineProps) {
	const shrine = k.add([
		k.pos(props.pos),
		k.sprite("shrine_health"),
		k.anchor("center"),
		k.scale(HEALTH_SHRINE_SCALE),
		k.color(k.WHITE),
		k.layer(layers.buildings),
		k.z(2),
		{
			runtimeCullRadius: 82,
		},
		tags.props,
		tags.gameLoop,
		tags.runtimeCullable,
		...(props.tags ?? []),
	])
	const light = addLocalLight(shrine, {
		size: 132 / HEALTH_SHRINE_SCALE,
		color: HEALTH_COLOR,
		opacity: 0.82,
		pulse: {
			scaleMin: 0.92,
			scaleMax: 1.18,
			scaleSpeed: 3.4,
			opacityMin: 0.72,
			opacityMax: 1,
			opacitySpeed: 2.8,
		},
	})
	const core = shrine.add([
		k.circle(4),
		k.anchor("center"),
		k.color(...HEALTH_COLOR),
		k.opacity(0.82),
		k.layer(layers.gameEffects),
		k.z(1),
	])
	const coreRing = shrine.add([
		k.circle(8, { fill: false }),
		k.anchor("center"),
		k.outline(1, k.rgb(...HEALTH_COLOR)),
		k.opacity(0.48),
		k.layer(layers.gameEffects),
		k.z(0),
	])
	const slotGenerations = Array(HEALTH_ORB_COUNT).fill(0) as number[]
	let collectedOrbCount = 0

	for (let index = 0; index < HEALTH_ORB_COUNT; index++) spawnOrb(index)

	registerBatchedEntityUpdate("world", shrine, () => {
		updateLocalLight(light)
		core.opacity = k.wave(0.66, 1, k.time() * 4)
		coreRing.scale = k.vec2(k.wave(0.88, 1.16, k.time() * 3))
		coreRing.opacity = k.wave(0.3, 0.62, k.time() * 3)
	})

	function spawnOrb(index: number) {
		if (!shrine.exists()) return
		const angle = -90 + index * (360 / HEALTH_ORB_COUNT)
		const orbPos = shrine.pos.add(
			k.Vec2.fromAngle(angle).scale(HEALTH_ORB_RADIUS)
		)
		const generation = ++slotGenerations[index]
		spawnHealthOrb(orbPos, {
			stationary: true,
			persistOffscreen: true,
			tags: props.tags,
			onCollected: () => {
				if (!props.respawnOrbs) {
					collectedOrbCount++
					if (collectedOrbCount >= HEALTH_ORB_COUNT) props.onDepleted?.()
					return
				}
				k.wait(TRAINING_ORB_RESPAWN_DELAY, () => {
					if (!shrine.exists() || slotGenerations[index] !== generation) return
					spawnOrb(index)
				})
			},
		})
	}

	return shrine
}
