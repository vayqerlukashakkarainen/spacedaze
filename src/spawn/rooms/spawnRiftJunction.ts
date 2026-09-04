import type { Vec2 } from "kaplay"
import { playerObj } from "../../game"
import { k, layers } from "../../main"
import { resetPlayerPath } from "../../services/playerPathService"
import { tags } from "../../tags"
import { interactable } from "../../comp/interactable"
import { spawnRing } from "../spawnRing"
import { registerBatchedEntityUpdate } from "../../services/entityUpdateService"
import { UI_FONT_SIZES } from "../../ui/common"

interface RiftJunctionProps {
	pos: Vec2
	destinations: Vec2[]
	tags?: string[]
}

export function spawnRiftJunction(props: RiftJunctionProps) {
	let usableAt = 0
	const junction = k.add([
		k.pos(props.pos),
		tags.props,
		tags.gameLoop,
		...(props.tags ?? []),
	])
	const core = junction.add([
		k.sprite("room_rift_anchor"),
		k.anchor("center"),
		k.layer(layers.buildings),
		k.scale(0.62),
		k.rotate(0),
	])
	props.destinations.slice(0, 3).forEach((destination, index) => {
		const angle = -90 + index * 120
		const portalPos = props.pos.add(k.Vec2.fromAngle(angle).scale(68))
		const portal = k.add([
			k.pos(portalPos),
			k.anchor("center"),
			interactable(34, () => useRift(destination)),
			tags.props,
			tags.gameLoop,
			...(props.tags ?? []),
		])
		const ring = portal.add([
			k.circle(13, { fill: false }),
			k.outline(2, k.rgb(100, 205, 255)),
			k.anchor("center"),
			k.rotate(0),
			k.scale(1),
			k.opacity(0.8),
			k.layer(layers.gameEffects),
		])
		portal.add([
			k.text(`F  RIFT ${index + 1}`, { size: UI_FONT_SIZES.tiny, font: "unscii" }),
			k.pos(0, 21),
			k.anchor("center"),
			k.color(k.WHITE),
			k.layer(layers.gameText),
		])
		registerBatchedEntityUpdate("world", portal, () => {
			ring.angle += k.dt() * (index % 2 === 0 ? 80 : -80)
			ring.scale = k.vec2(k.wave(0.85, 1.15, k.time() * 3 + index))
		})
	})

	registerBatchedEntityUpdate("world", junction, () => {
		core.angle += k.dt() * 5
	})

	function useRift(destination: Vec2) {
		if (k.time() < usableAt) return
		usableAt = k.time() + 1
		const start = playerObj.pos.clone()
		spawnRing({
			pos: start,
			speed: 240,
			intensity: 0.35,
			maxRadius: 65,
			color: k.rgb(100, 205, 255),
		})
		playerObj.pos = destination.clone()
		resetPlayerPath(playerObj.pos)
		spawnRing({
			pos: playerObj.pos,
			speed: 240,
			intensity: 0.45,
			maxRadius: 80,
			color: k.rgb(100, 205, 255),
		})
	}

	return junction
}
