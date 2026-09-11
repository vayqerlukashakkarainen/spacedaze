import type { GameObj, Vec2 } from "kaplay"
import { playerObj } from "../../game"
import { k, layers } from "../../main"
import { applyDamage } from "../../services/combat/damageService"
import { drawLightning } from "../../services/combat/lightningVisualService"
import { queryPersistentShipParts } from "../../services/combat/persistentShipPartService"
import { querySpatialNearby } from "../../services/core/runtimeSpatialIndexService"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import {
	traceElectricalNetwork,
	type ElectricalNode,
	type ElectricalTrace,
} from "../../services/world/electricalConductionService"
import {
	addLocalLight,
	updateLocalLight,
} from "../../services/world/localLightService"
import { tags } from "../../tags"
import { UI_COLORS } from "../../ui/common/theme"
import { spawnFlash } from "../spawnFlash"

const DORMANT_COIL_COLOR = [105, 120, 128] as const
const TESLA_LINK_DISTANCE = 88
const TESLA_NETWORK_RADIUS = 352
const TESLA_MAX_CONDUCTORS = 18
const TESLA_SCAN_INTERVAL = 0.08
const TESLA_DAMAGE_RADIUS = 25
const TESLA_ARC_DAMAGE_RADIUS = 10
const TESLA_DAMAGE = 6
const TESLA_DAMAGE_COOLDOWN = 0.65

export function spawnTeslaCoilVisual(
	position: Vec2,
	powered = true,
	extraTags: string[] = []
) {
	const coil = k.add([
		k.pos(position),
		k.sprite("room_tesla_coil"),
		k.anchor("center"),
		k.color(...(powered ? UI_COLORS.accent : DORMANT_COIL_COLOR)),
		k.scale(1),
		k.layer(layers.buildings),
		k.z(2),
		{ groundShadowMode: "ground" as const },
		tags.props,
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
		...extraTags,
	])
	const light = addLocalLight(coil, {
		size: 78,
		color: UI_COLORS.accent,
		opacity: powered ? 0.3 : 0.06,
		pulse: createCoilPulse(powered),
	})
	coil.onUpdate(() => updateLocalLight(light))

	return {
		object: coil,
		setPowered(nextPowered: boolean) {
			powered = nextPowered
			coil.color = k.rgb(...(
				powered ? UI_COLORS.accent : DORMANT_COIL_COLOR
			))
			light.pulse = createCoilPulse(powered)
		},
	}
}

export function spawnTeslaCoilHazard(position: Vec2, extraTags: string[] = []) {
	const coil = spawnTeslaCoilVisual(position, true, extraTags).object
	const source: ElectricalNode = {
		id: `tesla:${coil.id}`,
		position: coil.pos,
	}
	let trace: ElectricalTrace = {
		poweredIds: new Set([source.id]),
		edges: [],
	}
	let poweredNodes: ElectricalNode[] = [source]
	let scanTimer = 0
	let damageTimer = 0

	const controller = k.add([
		k.pos(),
		k.layer(layers.gameEffects),
		k.z(8),
		{
			draw() {
				drawElectricalTrace(trace, 0.78)
			},
		},
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
		...extraTags,
	])

	registerBatchedEntityUpdate("effects", controller, () => {
		if (!coil.exists()) return
		scanTimer -= k.dt()
		damageTimer = Math.max(0, damageTimer - k.dt())
		if (scanTimer <= 0) {
			scanTimer = TESLA_SCAN_INTERVAL
			const conductors = collectTeslaConductors(coil)
			trace = traceElectricalNetwork(source, conductors, TESLA_LINK_DISTANCE)
			poweredNodes = [source, ...conductors.filter((node) =>
				trace.poweredIds.has(node.id)
			)]
		}
		if (damageTimer > 0 || !playerObj.exists()) return
		const dangerPosition = getTeslaDangerPosition(
			playerObj.pos,
			poweredNodes,
			trace
		)
		if (!dangerPosition) return
		if (!applyDamage(playerObj, TESLA_DAMAGE, {
			position: dangerPosition,
			incomingDirection: playerObj.pos.sub(dangerPosition),
			playerHullDamage: true,
			source: { name: "TESLA COIL", sprite: "room_tesla_coil" },
		})) return
		damageTimer = TESLA_DAMAGE_COOLDOWN
		spawnFlash(playerObj.pos.clone(), 12, k.rgb(...UI_COLORS.accent))
	})

	return { coil, controller }
}

function getTeslaDangerPosition(
	playerPosition: Vec2,
	poweredNodes: ElectricalNode[],
	trace: ElectricalTrace
) {
	for (const node of poweredNodes) {
		if (node.position.dist(playerPosition) <= TESLA_DAMAGE_RADIUS) {
			return node.position
		}
	}
	for (const edge of trace.edges) {
		const closest = closestPointOnSegment(
			playerPosition,
			edge.start.position,
			edge.end.position
		)
		if (closest.dist(playerPosition) <= TESLA_ARC_DAMAGE_RADIUS) return closest
	}
	return undefined
}

function closestPointOnSegment(point: Vec2, start: Vec2, end: Vec2) {
	const segment = end.sub(start)
	const lengthSquared = segment.x * segment.x + segment.y * segment.y
	if (lengthSquared <= 0.001) return start
	const toPoint = point.sub(start)
	const progress = k.clamp(
		(toPoint.x * segment.x + toPoint.y * segment.y) / lengthSquared,
		0,
		1
	)
	return start.add(segment.scale(progress))
}

export function drawElectricalTrace(trace: ElectricalTrace, opacity: number) {
	for (let index = 0; index < trace.edges.length; index++) {
		const edge = trace.edges[index]
		drawLightning({
			start: edge.start.position,
			end: edge.end.position,
			color: k.rgb(...UI_COLORS.accent),
			opacity,
			width: 1.5,
			segmentLength: 9,
			amplitude: 5,
			waveCount: 2.2,
			smoothness: 0.68,
			flickerRate: 22,
			seed: 71 + index * 19,
			branchChance: 0.08,
			branchLength: 8,
		})
	}
}

function collectTeslaConductors(coil: GameObj) {
	const nodes: ElectricalNode[] = []
	const covers = querySpatialNearby(coil.pos, TESLA_NETWORK_RADIUS, {
		allTags: [tags.roomCover, tags.snareable],
	})
	for (const cover of covers) {
		if (!cover.exists()) continue
		nodes.push({
			id: `cover:${cover.id}`,
			position: cover.pos.clone(),
		})
	}
	for (const part of queryPersistentShipParts(coil.pos, TESLA_NETWORK_RADIUS)) {
		nodes.push({
			id: `ship-part:${part.id}`,
			position: part.position.clone(),
		})
	}
	return nodes
		.sort((a, b) => a.position.dist(coil.pos) - b.position.dist(coil.pos))
		.slice(0, TESLA_MAX_CONDUCTORS)
}

function createCoilPulse(powered: boolean) {
	return {
		scaleMin: 0.9,
		scaleMax: 1.12,
		scaleSpeed: 3.1,
		opacityMin: powered ? 0.2 : 0.04,
		opacityMax: powered ? 0.38 : 0.09,
		opacitySpeed: 4.2,
	}
}
