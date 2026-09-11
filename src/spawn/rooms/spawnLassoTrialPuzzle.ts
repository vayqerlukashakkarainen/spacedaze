import type { GameObj, PosComp, RotateComp, Vec2 } from "kaplay"
import { gridCollision } from "../../comp/gridCollision"
import { snareable, type SnareableComp } from "../../comp/snareable"
import { ACTIVE_RUN_GRID_KEY } from "../../grid/gridKeys"
import { k, layers, mainSoundVolume } from "../../main"
import { gameSoundService } from "../../services/audio/gameSoundService"
import { registerBatchedEntityUpdate } from "../../services/core/entityUpdateService"
import { tags } from "../../tags"
import { UI_COLORS } from "../../ui/common"
import { spawnFlash } from "../spawnFlash"
import { spawnLassoTokenPickup } from "../spawnLassoToken"
import { spawnRing } from "../spawnRing"

const TARGET_OFFSETS = [
	[-104, -82],
	[0, -118],
	[104, -82],
] as const
const WEIGHT_OFFSETS = [
	[-82, 92],
	[0, 116],
	[82, 92],
] as const
const TARGET_RADIUS = 17
const MIN_TARGET_HIT_SPEED = 220

interface LassoTrialPuzzleOptions {
	tags?: string[]
	onCompleted: () => void
}

type TrialWeight = GameObj<PosComp | RotateComp | SnareableComp> & {
	lastTrialPosition: Vec2
}

type TrialTarget = GameObj & {
	hit: boolean
	index: number
}

export function spawnLassoTrialPuzzle(
	center: Vec2,
	options: LassoTrialPuzzleOptions
) {
	const extraTags = options.tags ?? []
	let completed = false
	let hitCount = 0
	const status = spawnTrialHeader(center, extraTags)
	const targets = TARGET_OFFSETS.map((offset, index) =>
		spawnTrialTarget(center.add(offset[0], offset[1]), index, extraTags)
	)
	const weights = WEIGHT_OFFSETS.map((offset, index) =>
		spawnTrialWeight(center.add(offset[0], offset[1]), index, extraTags)
	)

	const controller = k.add([
		k.pos(center),
		k.layer(layers.gameEffects),
		k.z(8),
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
		...extraTags,
	])
	registerBatchedEntityUpdate("world", controller, () => {
		if (completed) return
		for (const weight of weights) {
			if (!weight.exists()) continue
			const previous = weight.lastTrialPosition
			const current = weight.pos.clone()
			const speed = weight.snareVelocity.len()
			if (!weight.snared && speed >= MIN_TARGET_HIT_SPEED) {
				const target = targets.find((candidate) =>
					!candidate.hit && segmentHitsCircle(
						previous,
						current,
						candidate.pos,
						TARGET_RADIUS
					)
				)
				if (target) {
					target.hit = true
					hitCount++
					status.text = hitCount >= targets.length
						? "TRIAL COMPLETE"
						: `${hitCount} / ${targets.length} TARGETS`
					spawnFlash(target.pos, 15, k.WHITE)
					spawnRing({
						pos: target.pos,
						speed: 175,
						maxRadius: 48,
						intensity: 0.72,
						color: k.rgb(...UI_COLORS.lassoToken),
					})
					gameSoundService.play("target_lock", {
						volume: mainSoundVolume * 0.72,
						detune: hitCount * 120,
					})
					k.destroy(weight)
					if (hitCount >= targets.length) complete()
					continue
				}
			}
			weight.lastTrialPosition = current
		}
	})

	function complete() {
		if (completed) return
		completed = true
		spawnLassoTokenPickup(center.add(0, -18), {
			objectTags: [tags.runMap, tags.runRoom],
			forceToTarget: true,
		})
		gameSoundService.play("room_cleared", {
			volume: mainSoundVolume * 0.82,
			detune: 240,
		})
		options.onCompleted()
	}

	return { controller, targets, weights }
}

function spawnTrialHeader(center: Vec2, extraTags: string[]) {
	const header = k.add([
		k.pos(center.add(0, -176)),
		k.text("LASSO PRECISION TRIAL", {
			font: "unscii",
			size: 10,
			width: 220,
			align: "center",
		}),
		k.anchor("center"),
		k.color(...UI_COLORS.text),
		k.layer(layers.gameText),
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
		...extraTags,
	])
	return header.add([
		k.text("THROW WEIGHTS THROUGH ALL TARGETS", {
			font: "unscii",
			size: 7,
			width: 220,
			align: "center",
		}),
		k.pos(0, 18),
		k.anchor("center"),
		k.color(...UI_COLORS.lassoToken),
		k.layer(layers.gameText),
	])
}

function spawnTrialTarget(position: Vec2, index: number, extraTags: string[]) {
	return k.add([
		k.pos(position),
		k.layer(layers.gameEffects),
		k.z(2),
		{
			hit: false,
			index,
			draw() {
				const color = this.hit
					? k.rgb(...UI_COLORS.success)
					: k.rgb(...UI_COLORS.lassoToken)
				const radius = this.hit
					? TARGET_RADIUS
					: k.wave(TARGET_RADIUS - 1, TARGET_RADIUS + 1, k.time() * 3 + index)
				k.drawCircle({
					radius,
					fill: false,
					outline: { width: 2, color },
					opacity: this.hit ? 0.95 : 0.72,
					anchor: "center",
				})
				k.drawLine({
					p1: k.vec2(-6, 0),
					p2: k.vec2(6, 0),
					width: 1,
					color,
				})
				k.drawLine({
					p1: k.vec2(0, -6),
					p2: k.vec2(0, 6),
					width: 1,
					color,
				})
			},
		},
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
		...extraTags,
	]) as TrialTarget
}

function spawnTrialWeight(position: Vec2, index: number, extraTags: string[]) {
	return k.add([
		k.pos(position),
		k.sprite("crate1"),
		k.anchor("center"),
		k.rotate(index * 18),
		k.scale(1.05),
		k.color(k.WHITE),
		k.outline(1, k.rgb(...UI_COLORS.lassoToken)),
		k.layer(layers.game),
		gridCollision(ACTIVE_RUN_GRID_KEY),
		snareable({
			mass: 1.25,
			radius: 13,
			releaseDrag: 0.75,
			angularDrag: 0.4,
		}),
		{
			lastTrialPosition: position.clone(),
		},
		tags.props,
		tags.unit,
		tags.runMap,
		tags.runRoom,
		tags.gameLoop,
		...extraTags,
	]) as TrialWeight
}

function segmentHitsCircle(start: Vec2, end: Vec2, center: Vec2, radius: number) {
	const segment = end.sub(start)
	const lengthSquared = segment.dot(segment)
	if (lengthSquared <= 0.0001) return end.dist(center) <= radius
	const progress = k.clamp(center.sub(start).dot(segment) / lengthSquared, 0, 1)
	return start.add(segment.scale(progress)).dist(center) <= radius
}
