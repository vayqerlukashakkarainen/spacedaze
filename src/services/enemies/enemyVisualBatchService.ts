import type { GameObj, Vec2 } from "kaplay"
import { k, layers } from "../../main"
import { tags } from "../../tags"
import { DensePool } from "../core/densePool"
import { setPerformanceCounter } from "../debug/frameProfilerService"

type RuntimeSpriteVisual = GameObj & {
	pos: Vec2
	sprite: string
	visualAngle?: number
}

const VISUAL_PADDING = 48
const DENSE_VISUAL_THRESHOLD = 750
const DENSE_ENEMY_VISUAL_LIMIT = 128
const DENSE_PROJECTILE_VISUAL_LIMIT = 384
const DENSE_DEBRIS_VISUAL_LIMIT = 128
const visuals = new DensePool<RuntimeSpriteVisual>((obj) => obj.id)
let controller: GameObj | undefined

export function registerEnemyVisual(enemy: GameObj) {
	if (enemy.is(tags.swarmEnemy)) return
	registerRuntimeSpriteVisual(enemy)
}

export function registerRuntimeSpriteVisual(obj: GameObj) {
	if (
		visuals.has(obj.id) ||
		!obj.pos ||
		typeof obj.sprite !== "string" ||
		(obj.children?.length ?? 0) > 0
	) return

	const visual = obj as RuntimeSpriteVisual
	visual.dataOrientedVisual = true
	visual.hidden = true
	visuals.add(visual)
	obj.onDestroy(() => visuals.remove(obj.id))
	ensureController()
}

function ensureController() {
	if (controller?.exists()) return
	controller = k.add([
		k.pos(0, 0),
		k.layer(layers.game),
		{
			draw() {
				drawEnemyVisuals()
			},
		},
		tags.props,
		tags.gameLoop,
	])
	controller.onDestroy(() => {
		visuals.forEach((obj) => {
			if (obj.exists()) obj.hidden = false
		})
		visuals.clear()
		controller = undefined
	})
}

function drawEnemyVisuals() {
	const camera = k.getCamPos()
	const cameraScale = k.getCamScale()
	const halfWidth = k.width() / (2 * cameraScale.x) + VISUAL_PADDING
	const halfHeight = k.height() / (2 * cameraScale.y) + VISUAL_PADDING
	const minX = camera.x - halfWidth
	const maxX = camera.x + halfWidth
	const minY = camera.y - halfHeight
	const maxY = camera.y + halfHeight
	const dense = visuals.size >= DENSE_VISUAL_THRESHOLD
	let enemyCandidates = 0
	let projectileCandidates = 0
	let debrisCandidates = 0
	let drawn = 0

	if (dense) {
		visuals.forEach((obj) => {
			if (!isDrawable(obj, minX, maxX, minY, maxY)) return
			if (obj.is(tags.enemy)) enemyCandidates++
			else if (obj.is(tags.projectile)) projectileCandidates++
			else if (obj.is(tags.debree)) debrisCandidates++
		})
	}

	visuals.forEach((obj) => {
		if (!obj.exists()) {
			visuals.remove(obj.id)
			return
		}
		if (obj.has("shader")) {
			obj.hidden = false
			return
		}
		obj.hidden = true
		if (!isDrawable(obj, minX, maxX, minY, maxY)) return
		if (
			dense &&
			!withinVisualBudget(
				obj,
				enemyCandidates,
				projectileCandidates,
				debrisCandidates
			)
		) return

		k.drawSprite({
			sprite: obj.sprite,
			pos: obj.pos,
			angle: obj.visualAngle ?? obj.angle ?? 0,
			anchor: obj.anchor ?? "center",
			scale: obj.scale,
			color: obj.color,
			opacity: obj.opacity ?? 1,
			frame: obj.frame,
			flipX: obj.flipX,
			flipY: obj.flipY,
		})
		drawn++
	})

	setPerformanceCounter("sharedSpriteVisuals", visuals.size)
	setPerformanceCounter("sharedSpriteVisualsDrawn", drawn)
}

function isDrawable(
	obj: RuntimeSpriteVisual,
	minX: number,
	maxX: number,
	minY: number,
	maxY: number
) {
	return obj.exists() &&
		!obj.has("shader") &&
		obj.pos.x >= minX && obj.pos.x <= maxX &&
		obj.pos.y >= minY && obj.pos.y <= maxY
}

function withinVisualBudget(
	obj: RuntimeSpriteVisual,
	enemyCandidates: number,
	projectileCandidates: number,
	debrisCandidates: number
) {
	let candidates = 0
	let limit = 0
	if (obj.is(tags.enemy)) {
		candidates = enemyCandidates
		limit = DENSE_ENEMY_VISUAL_LIMIT
	} else if (obj.is(tags.projectile)) {
		candidates = projectileCandidates
		limit = DENSE_PROJECTILE_VISUAL_LIMIT
	} else if (obj.is(tags.debree)) {
		candidates = debrisCandidates
		limit = DENSE_DEBRIS_VISUAL_LIMIT
	}
	if (candidates <= limit || limit === 0) return true
	const sample = Math.imul(obj.id, 0x9e3779b1) >>> 0
	return sample % candidates < limit
}
