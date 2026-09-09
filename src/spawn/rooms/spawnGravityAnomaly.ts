import type { Vec2 } from "kaplay"
import { k, layers } from "../../main"
import { tags } from "../../tags"
import { spawnGravityPull } from "../spawnGravityPull"
import { registerBatchedEntityUpdate } from "../../services/entityUpdateService"
import { spawnDecorativeWormhole } from "../spawnLevel"
import { getWorldVisual } from "../../visuals/worldVisualCatalog"
import { requirePrimaryVisualSprite } from "../../visuals/visualRepresentation"

const GRAVITY_PURPLE = [174, 112, 255] as const
const SHRINE_OFFSET_Y = -6
const WORMHOLE_OFFSET_Y = -18
const GRAVITY_ANOMALY_VISUAL = getWorldVisual("gravity-anomaly-shrine")

interface GravityAnomalyProps {
	pos: Vec2
	radius: number
	strength: number
	tags?: string[]
}

export function spawnGravityAnomaly(props: GravityAnomalyProps) {
	const platformPieces = [
		{
			sprite: "bg_planet_chunk_1",
			offset: k.vec2(0, 20),
			scale: 0.62,
			angle: -4,
			color: k.rgb(56, 66, 82),
			z: -3,
		},
		{
			sprite: "asteroid_05",
			offset: k.vec2(-83, 46),
			scale: 1.2,
			angle: 24,
			color: k.rgb(45, 53, 68),
			z: -4,
		},
		{
			sprite: "asteroid_12",
			offset: k.vec2(79, 39),
			scale: 0.95,
			angle: -18,
			color: k.rgb(48, 57, 72),
			z: -4,
		},
	].map((piece) => k.add([
		k.pos(props.pos.add(piece.offset)),
		k.sprite(piece.sprite),
		k.anchor("center"),
		k.scale(piece.scale),
		k.rotate(piece.angle),
		k.color(piece.color),
		k.layer(layers.buildings),
		k.z(piece.z),
		tags.props,
		tags.gameLoop,
		tags.runtimeCullable,
		...(props.tags ?? []),
	]))
	const field = k.add([
		k.pos(props.pos),
		k.circle(props.radius, { fill: false }),
		k.outline(2, k.rgb(145, 105, 255)),
		k.anchor("center"),
		k.opacity(0.24),
		k.layer(layers.gameEffects),
		tags.props,
		tags.gameLoop,
		tags.runtimeCullable,
		...(props.tags ?? []),
	])
	const core = k.add([
		k.pos(props.pos.add(0, SHRINE_OFFSET_Y)),
		k.sprite(requirePrimaryVisualSprite(GRAVITY_ANOMALY_VISUAL)),
		k.anchor("center"),
		k.scale(GRAVITY_ANOMALY_VISUAL.worldScale),
		k.color(195, 175, 255),
		k.layer(layers.buildings),
		tags.props,
		tags.gameLoop,
		tags.runtimeCullable,
		...(props.tags ?? []),
	])
	const wormhole = spawnDecorativeWormhole({
		pos: props.pos.add(0, WORMHOLE_OFFSET_Y),
		color: k.rgb(...GRAVITY_PURPLE),
		scale: 0.56,
		tags: [tags.runtimeCullable, ...(props.tags ?? [])],
	})
	addPurpleWormholeLightning(wormhole)
	const gravity = spawnGravityPull({
		pos: props.pos,
		radius: props.radius,
		strength: props.strength,
		falloff: 0.65,
		targetTags: [tags.player, tags.enemy, tags.projectile, tags.debree],
		tagStrengthMultipliers: {
			[tags.player]: 0.65,
			[tags.projectile]: 1.45,
			[tags.debree]: 1.25,
		},
		visualizePull: true,
		tags: props.tags,
	})

	registerBatchedEntityUpdate("world", core, () => {
		field.opacity = k.wave(0.12, 0.32, k.time() * 1.8)
	})
	core.onDestroy(() => {
		if (field.exists()) k.destroy(field)
		if (gravity.exists()) k.destroy(gravity)
		if (wormhole.exists()) k.destroy(wormhole)
		for (const piece of platformPieces) {
			if (piece.exists()) k.destroy(piece)
		}
	})

	return core
}

function addPurpleWormholeLightning(wormhole: any) {
	const bolts = [
		{ phase: 0.2, speed: 34, span: 62, radius: 48 },
		{ phase: 2.4, speed: -27, span: 48, radius: 40 },
		{ phase: 4.1, speed: 22, span: 70, radius: 53 },
	]
	wormhole.add([
		k.pos(0, 0),
		k.layer(layers.gameEffects),
		k.z(4),
		{
			draw() {
				const time = k.time()
				for (let boltIndex = 0; boltIndex < bolts.length; boltIndex++) {
					const bolt = bolts[boltIndex]
					const startAngle = time * bolt.speed + bolt.phase * 57
					const opacity = k.wave(
						0.38,
						0.9,
						time * (8 + boltIndex * 1.7) + bolt.phase
					)
					let previous = lightningPoint(startAngle, bolt.radius, 0, time, boltIndex)
					for (let segment = 1; segment <= 7; segment++) {
						const progress = segment / 7
						const angle = startAngle + bolt.span * progress
						const next = lightningPoint(
							angle,
							bolt.radius,
							segment,
							time,
							boltIndex
						)
						k.drawLine({
							p1: previous,
							p2: next,
							width: segment % 3 === 0 ? 2 : 1.25,
							color: k.rgb(204, 155, 255),
							opacity,
						})
						if (segment === 4) {
							const branchDirection = next.unit().scale(8)
							k.drawLine({
								p1: next,
								p2: next.add(branchDirection),
								width: 1,
								color: k.rgb(174, 112, 255),
								opacity: opacity * 0.7,
							})
						}
						previous = next
					}
				}
			},
		},
	])
}

function lightningPoint(
	angle: number,
	baseRadius: number,
	segment: number,
	time: number,
	boltIndex: number
) {
	const jitter = Math.sin(time * 31 + segment * 8.7 + boltIndex * 4.3) * 4
	const direction = k.Vec2.fromAngle(angle)
	return k.vec2(
		direction.x * (baseRadius + jitter),
		direction.y * (baseRadius + jitter) * 0.72
	)
}
