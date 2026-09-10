import type { Color, GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import type { RewardKind } from "../../types/rewardTypes"
import type { UiAbilitySlot } from "./abilitySlotMarker"

export type RewardTypeShape =
	| "primary"
	| "secondary"
	| "mobility"
	| "ultimate"
	| "upgrade"
	| "powerup"
	| "item"

export interface RewardTypeFrameProps {
	pos?: Vec2
	size: number
	color: readonly [number, number, number]
	kind: RewardKind
	abilitySlot?: UiAbilitySlot
	fillOpacity?: number
	outlineOpacity?: number
	lineWidth?: number
	progress?: number
	progressColor?: readonly [number, number, number]
	progressLineWidth?: number
	z?: number
}

export interface RewardTypeFrameDrawProps {
	pos?: Vec2
	size: number
	shape: RewardTypeShape
	color: Color
	fillOpacity: number
	outlineOpacity: number
	lineWidth: number
	progress?: number
	progressColor?: Color
	progressLineWidth?: number
}

export function getRewardTypeShape(
	kind: RewardKind,
	abilitySlot?: UiAbilitySlot
): RewardTypeShape {
	if (abilitySlot === "primary" || kind === "weapon") return "primary"
	if (abilitySlot === "secondary" || kind === "activeModule") return "secondary"
	if (abilitySlot === "mobility" || kind === "mobility") return "mobility"
	if (abilitySlot === "ultimate" || kind === "ultimate") return "ultimate"
	if (kind === "upgrade") return "upgrade"
	if (kind === "item") return "item"
	return "powerup"
}

export function createRewardTypeFrame(
	parent: GameObj,
	props: RewardTypeFrameProps
) {
	let color = k.rgb(...props.color)
	const shape = getRewardTypeShape(props.kind, props.abilitySlot)
	const fillOpacity = props.fillOpacity ?? 0.1
	const outlineOpacity = props.outlineOpacity ?? 0.72
	const lineWidth = props.lineWidth ?? 2
	const progress = k.clamp(props.progress ?? 0, 0, 1)
	const progressColor = k.rgb(...(props.progressColor ?? props.color))
	const frame = parent.add([
		k.pos(props.pos ?? k.vec2()),
		k.scale(1),
		k.z(props.z ?? 1),
		{
			setFrameColor(nextColor: readonly [number, number, number]) {
				color = k.rgb(...nextColor)
			},
			draw() {
				drawRewardTypeFrame({
					shape,
					size: props.size,
					color,
					fillOpacity,
					outlineOpacity,
					lineWidth,
					progress,
					progressColor,
					progressLineWidth: props.progressLineWidth,
				})
			},
		},
	])
	return frame
}

export function drawRewardTypeFrame(props: RewardTypeFrameDrawProps) {
	if (props.pos) {
		k.pushTransform()
		k.pushTranslate(props.pos)
	}
	drawRewardTypeShape(
		props.shape,
		props.size,
		props.color,
		props.fillOpacity,
		props.outlineOpacity,
		props.lineWidth
	)
	const progress = k.clamp(props.progress ?? 0, 0, 1)
	if (progress > 0) {
		drawRewardTypeShapeProgress(
			props.shape,
			props.size,
			progress,
			props.progressColor ?? props.color,
			props.progressLineWidth ?? props.lineWidth
		)
	}
	if (props.pos) k.popTransform()
}

function drawRewardTypeShape(
	shape: RewardTypeShape,
	size: number,
	color: ReturnType<typeof k.rgb>,
	fillOpacity: number,
	outlineOpacity: number,
	lineWidth: number
) {
	const half = size / 2
	if (shape === "ultimate") {
		k.drawCircle({
			pos: k.vec2(),
			radius: half * 0.82,
			color,
			opacity: fillOpacity,
			anchor: "center",
		})
		for (const [start, end] of getUltimateSegments(half)) {
			k.drawLine({
				p1: start,
				p2: end,
				width: lineWidth,
				color,
				opacity: outlineOpacity,
			})
		}
		return
	}

	const points = getShapePoints(shape, half)
	k.drawPolygon({
		pts: points,
		color,
		opacity: fillOpacity,
		outline: {
			width: lineWidth,
			color,
			opacity: outlineOpacity,
		},
	})
}

function drawRewardTypeShapeProgress(
	shape: RewardTypeShape,
	size: number,
	progress: number,
	color: ReturnType<typeof k.rgb>,
	lineWidth: number
) {
	const half = size / 2
	if (shape === "ultimate") {
		drawSegmentProgress(getUltimateSegments(half), progress, color, lineWidth)
		return
	}
	const points = getShapePoints(shape, half)
	drawPathProgress([...points, points[0]], progress, color, lineWidth)
}

function drawPathProgress(
	path: readonly Vec2[],
	progress: number,
	color: ReturnType<typeof k.rgb>,
	lineWidth: number
) {
	const lengths = path.slice(1).map((point, index) =>
		point.dist(path[index])
	)
	let remaining = lengths.reduce((total, length) => total + length, 0) * progress
	const progressPoints = [path[0]]
	for (let index = 0; index < lengths.length && remaining > 0; index++) {
		const start = path[index]
		const end = path[index + 1]
		const length = lengths[index]
		if (remaining >= length) {
			progressPoints.push(end)
			remaining -= length
			continue
		}
		progressPoints.push(start.lerp(end, remaining / length))
		remaining = 0
	}
	if (progressPoints.length < 2) return
	k.drawLines({
		pts: progressPoints,
		width: lineWidth,
		color,
	})
}

function drawSegmentProgress(
	segments: readonly (readonly [Vec2, Vec2])[],
	progress: number,
	color: ReturnType<typeof k.rgb>,
	lineWidth: number
) {
	const lengths = segments.map(([start, end]) => start.dist(end))
	let remaining = lengths.reduce((total, length) => total + length, 0) * progress
	for (let index = 0; index < segments.length && remaining > 0; index++) {
		const [start, end] = segments[index]
		const length = lengths[index]
		const segmentProgress = Math.min(1, remaining / length)
		k.drawLine({
			p1: start,
			p2: start.lerp(end, segmentProgress),
			width: lineWidth,
			color,
		})
		remaining -= length
	}
}

function getUltimateSegments(half: number) {
	return [315, 45, 135, 225].map((angle) => [
		k.Vec2.fromAngle(angle - 25).scale(half),
		k.Vec2.fromAngle(angle + 25).scale(half),
	] as const)
}

function getShapePoints(shape: Exclude<RewardTypeShape, "ultimate">, half: number) {
	if (shape === "primary") {
		return [
			k.vec2(0, -half),
			k.vec2(half * 0.54, -half * 0.52),
			k.vec2(half * 0.54, half * 0.7),
			k.vec2(half * 0.26, half),
			k.vec2(-half * 0.26, half),
			k.vec2(-half * 0.54, half * 0.7),
			k.vec2(-half * 0.54, -half * 0.52),
		]
	}
	if (shape === "secondary") {
		return [
			k.vec2(0, -half),
			k.vec2(half, 0),
			k.vec2(0, half),
			k.vec2(-half, 0),
		]
	}
	if (shape === "mobility") {
		return [
			k.vec2(0, -half),
			k.vec2(half * 0.78, 0),
			k.vec2(half * 0.78, half),
			k.vec2(0, half * 0.38),
			k.vec2(-half * 0.78, half),
			k.vec2(-half * 0.78, 0),
		]
	}
	if (shape === "upgrade") {
		return Array.from({ length: 6 }, (_, index) =>
			k.Vec2.fromAngle(index * 60 - 90).scale(half)
		)
	}
	if (shape === "item") {
		return [
			k.vec2(-half * 0.16, -half),
			k.vec2(half * 0.72, -half * 0.48),
			k.vec2(half, half * 0.24),
			k.vec2(half * 0.18, half),
			k.vec2(-half * 0.82, half * 0.5),
			k.vec2(-half, -half * 0.34),
		]
	}
	return Array.from({ length: 8 }, (_, index) =>
		k.Vec2.fromAngle(index * 45 - 22.5).scale(half)
	)
}
