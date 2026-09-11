import type { Vec2 } from "kaplay"
import { gridCollision } from "../../comp/gridCollision"
import { snareable } from "../../comp/snareable"
import { ACTIVE_RUN_GRID_KEY } from "../../grid/gridKeys"
import { k, layers, mainSoundVolume } from "../../main"
import { gameSoundService } from "../../services/audio/gameSoundService"
import {
	traceElectricalNetwork,
	type ElectricalNode,
} from "../../services/world/electricalConductionService"
import { tags } from "../../tags"
import { UI_COLORS } from "../../ui/common/theme"
import { spawnChest } from "../spawnChest"
import { spawnFlash } from "../spawnFlash"
import {
	drawElectricalTrace,
	spawnTeslaCoilVisual,
} from "./spawnTeslaCoil"

const COIL_OFFSET_X = 132
const CHEST_OFFSET_Y = -116
const CIRCUIT_LINK_DISTANCE = 88
const CONDUCTOR_RADIUS = 12
const CONDUCTOR_SPRITES = [
	"enemy_fighter_left_wing",
	"enemy_fighter_core",
	"enemy_fighter_right_wing",
] as const
const CONDUCTOR_START_OFFSETS = [
	[-62, 88],
	[0, -72],
	[66, 82],
] as const
const DORMANT_CONDUCTOR_COLOR = [155, 165, 170] as const

export interface ScrapCircuitPuzzleOptions {
	difficulty: number
	tags?: string[]
	onCompleted: () => void
}

export function spawnScrapCircuitPuzzle(
	center: Vec2,
	options: ScrapCircuitPuzzleOptions
) {
	let circuitClosed = false
	const sourceCoil = spawnTeslaCoilVisual(
		center.add(-COIL_OFFSET_X, 0),
		true,
		options.tags ?? []
	)
	const targetCoil = spawnTeslaCoilVisual(
		center.add(COIL_OFFSET_X, 0),
		false,
		options.tags ?? []
	)
	const source = sourceCoil.object
	const target = targetCoil.object
	const conductors = CONDUCTOR_START_OFFSETS.map((offset, index) =>
		spawnCircuitConductor(
			center.add(offset[0], offset[1]),
			CONDUCTOR_SPRITES[index],
			index,
			options.tags
		)
	)
	let trace = traceElectricalNetwork(
		{ id: source.id, position: source.pos },
		getCircuitNodes(conductors, target),
		CIRCUIT_LINK_DISTANCE
	)

	spawnChest(center.add(0, CHEST_OFFSET_Y), options.difficulty, {
		available: () => circuitClosed,
		ghostWhenUnavailable: true,
		revealWhenAvailable: true,
		onOpened: options.onCompleted,
		tags: options.tags,
	})

	const controller = k.add([
		k.pos(0, 0),
		k.layer(layers.gameEffects),
		k.z(8),
		{
			update() {
				trace = traceElectricalNetwork(
					{ id: source.id, position: source.pos },
					getCircuitNodes(conductors, target),
					CIRCUIT_LINK_DISTANCE
				)
				for (const conductor of conductors) {
					if (!conductor.exists()) continue
					conductor.color = trace.poweredIds.has(conductor.id)
						? k.rgb(...UI_COLORS.accent)
						: k.rgb(...DORMANT_CONDUCTOR_COLOR)
				}
				if (
					circuitClosed ||
					!target.exists() ||
					!trace.poweredIds.has(target.id)
				) return
				circuitClosed = true
				targetCoil.setPowered(true)
				spawnFlash(target.pos.clone(), 20, k.rgb(...UI_COLORS.accent))
				gameSoundService.play("powerup1", {
					volume: mainSoundVolume * 0.85,
				})
			},
			draw() {
				drawElectricalTrace(trace, circuitClosed ? 0.9 : 0.72)
			},
		},
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
		...(options.tags ?? []),
	])

	return { controller, source, target, conductors }
}

function spawnCircuitConductor(
	position: Vec2,
	sprite: string,
	index: number,
	extraTags: string[] | undefined
) {
	return k.add([
		k.pos(position),
		k.sprite(sprite),
		k.anchor("center"),
		k.rotate(index * 97),
		k.scale(0.9),
		k.color(...DORMANT_CONDUCTOR_COLOR),
		k.layer(layers.game2),
		k.z(3),
		gridCollision(ACTIVE_RUN_GRID_KEY),
		snareable({
			mass: 1.35,
			radius: CONDUCTOR_RADIUS,
			releaseDrag: 2.6,
			angularDrag: 1.7,
		}),
		{
			draw() {
				k.drawCircle({
					radius: CONDUCTOR_RADIUS + 3,
					fill: false,
					outline: {
						width: 1,
						color: this.color,
					},
					opacity: 0.26,
				})
			},
		},
		tags.props,
		tags.unit,
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
		...(extraTags ?? []),
	])
}

function getCircuitNodes(
	conductors: ReturnType<typeof spawnCircuitConductor>[],
	target: ReturnType<typeof spawnTeslaCoilVisual>["object"]
) {
	const nodes: ElectricalNode[] = []
	for (const conductor of conductors) {
		if (!conductor.exists()) continue
		nodes.push({ id: conductor.id, position: conductor.pos })
	}
	if (target.exists()) nodes.push({ id: target.id, position: target.pos })
	return nodes
}
