import type { Vec2 } from "kaplay"
import { k } from "../../main"
import { tags } from "../../tags"
import { spawnGravityPull } from "../spawnGravityPull"

interface GravityAnomalyProps {
	pos: Vec2
	radius: number
	strength: number
	tags?: string[]
}

export function spawnGravityAnomaly(props: GravityAnomalyProps) {
	const field = k.add([
		k.pos(props.pos),
		k.circle(props.radius, { fill: false }),
		k.outline(2, k.rgb(145, 105, 255)),
		k.anchor("center"),
		k.opacity(0.24),
		tags.props,
		tags.gameLoop,
		...(props.tags ?? []),
	])
	const core = k.add([
		k.pos(props.pos),
		k.sprite("room_gravity_core"),
		k.anchor("center"),
		k.scale(0.68),
		k.rotate(0),
		k.color(195, 175, 255),
		tags.props,
		tags.gameLoop,
		...(props.tags ?? []),
	])
	const label = k.add([
		k.pos(props.pos.add(0, -58)),
		k.text("GRAVITY ANOMALY", { size: 8, font: "unscii" }),
		k.anchor("center"),
		k.color(195, 175, 255),
		tags.gameLoop,
		...(props.tags ?? []),
	])
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

	core.onUpdate(() => {
		core.angle += k.dt() * 10
		field.opacity = k.wave(0.12, 0.32, k.time() * 1.8)
	})
	core.onDestroy(() => {
		if (field.exists()) k.destroy(field)
		if (gravity.exists()) k.destroy(gravity)
		if (label.exists()) k.destroy(label)
	})

	return core
}
