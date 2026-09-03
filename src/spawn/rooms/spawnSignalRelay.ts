import type { Vec2 } from "kaplay"
import { playerObj } from "../../game"
import { k, mainSoundVolume } from "../../main"
import { addThreatTime } from "../../services/threatService"
import { spawnThreatEncounter } from "../../services/enemyEncounterService"
import { audioService } from "../../services/audioService"
import { tags } from "../../tags"
import { spawnBuilding } from "../spawnBuilding"
import { spawnRing } from "../spawnRing"

interface SignalRelayProps {
	pos: Vec2
	nodeRadius: number
	nodeCaptureTime: number
	enemySpacing: number
	onComplete?: (pos: Vec2) => void
	tags?: string[]
}

export function spawnSignalRelay(props: SignalRelayProps) {
	let active = false
	let completed = false
	let activeNode = 0
	let nodeProgress = 0
	const relay = spawnBuilding({
		pos: props.pos,
		sprite: "room_signal_relay",
		scale: 0.62,
		interactRadius: 78,
		interactPromptOffset: k.vec2(0, -84),
		onInteract: activateRelay,
	})
	relay.tag(props.tags ?? [])
	const status = relay.add([
		k.text("ACTIVATE RELAY", { size: 12, font: "unscii" }),
		k.pos(0, 81),
		k.anchor("center"),
		k.color(110, 205, 255),
	])
	const nodes = Array.from({ length: 3 }, (_, index) => {
		const pos = props.pos.add(k.Vec2.fromAngle(-90 + index * 120).scale(105))
		const node = k.add([
			k.pos(pos),
			k.circle(props.nodeRadius),
			k.outline(2, k.rgb(95, 105, 120)),
			k.color(95, 105, 120),
			k.anchor("center"),
			k.opacity(0.22),
			{
				index,
			},
			tags.props,
			tags.gameLoop,
			...(props.tags ?? []),
		])
		node.add([
			k.text(String(index + 1), { size: 8, font: "unscii" }),
			k.anchor("center"),
			k.color(k.WHITE),
		])
		return node
	})

	relay.onUpdate(() => {
		if (!active || completed) return
		const node = nodes[activeNode]
		if (!node) return
		const inside = playerObj.pos.dist(node.pos) <= props.nodeRadius
		status.text = inside
			? `UPLINK ${activeNode + 1}  ${Math.round((nodeProgress / props.nodeCaptureTime) * 100)}%`
			: `REACH NODE ${activeNode + 1}`
		node.color = inside ? k.rgb(110, 205, 255) : k.rgb(155, 165, 180)
		if (!inside) {
			nodeProgress = Math.max(0, nodeProgress - k.dt())
			return
		}

		nodeProgress += k.dt()
		if (nodeProgress < props.nodeCaptureTime) return
		node.color = k.rgb(90, 255, 135)
		node.opacity = 1
		activeNode++
		nodeProgress = 0
		if (activeNode < nodes.length) {
			spawnRelayWave()
			return
		}

		completed = true
		status.text = "MAP UPLINK COMPLETE"
		relay.setInteractRadius(0)
		spawnRing({
			pos: relay.pos,
			speed: 230,
			intensity: 0.35,
			maxRadius: 190,
			color: k.rgb(110, 205, 255),
		})
		props.onComplete?.(relay.pos.clone())
		audioService.playSound("powerup1", { volume: mainSoundVolume })
	})

	function activateRelay() {
		if (active || completed) return
		active = true
		status.text = "REACH NODE 1"
		addThreatTime(10)
		spawnRelayWave()
	}

	function spawnRelayWave() {
		const spawnPos = relay.pos.add(
			k.Vec2.fromAngle(k.rand(360)).scale(210)
		)
		spawnThreatEncounter(spawnPos, props.enemySpacing)
	}

	return relay
}
