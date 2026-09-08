import type { GameObj, Vec2 } from "kaplay"
import { k } from "../main"
import { tags } from "../tags"
import { DensePool } from "./densePool"
import { setPerformanceCounter } from "./frameProfilerService"
import type { RunFrameContext } from "./runLoopService"

type VisibilityObject = GameObj & { pos: Vec2 }

const VISIBILITY_MARGIN = 160
const DENSE_VISIBILITY_THRESHOLD = 750
const objects = new DensePool<VisibilityObject>((obj) => obj.id)
let initialized = false

export function updateRuntimeVisibility(context: RunFrameContext) {
	ensureRegistry()
	if (
		objects.size >= DENSE_VISIBILITY_THRESHOLD &&
		context.frame % 2 !== 0
	) return
	const scaleX = Math.max(0.001, context.cameraScale.x)
	const scaleY = Math.max(0.001, context.cameraScale.y)
	const halfWidth = context.viewportWidth / (2 * scaleX) + VISIBILITY_MARGIN
	const halfHeight = context.viewportHeight / (2 * scaleY) + VISIBILITY_MARGIN
	const minX = context.cameraPos.x - halfWidth
	const maxX = context.cameraPos.x + halfWidth
	const minY = context.cameraPos.y - halfHeight
	const maxY = context.cameraPos.y + halfHeight
	let culled = 0

	objects.forEach((obj) => {
		if (!obj.exists()) {
			objects.remove(obj.id)
			return
		}
		const sharedVisual = obj.dataOrientedVisual === true
		if (
			obj.hidden &&
			obj.runtimeVisibilityCulled !== true &&
			!sharedVisual
		) return
		const radius = getVisualRadius(obj)
		const outside = obj.pos.x + radius < minX ||
			obj.pos.x - radius > maxX ||
			obj.pos.y + radius < minY ||
			obj.pos.y - radius > maxY
		if (outside) {
			obj.hidden = true
			obj.runtimeVisibilityCulled = true
			culled++
		} else if (obj.runtimeVisibilityCulled === true) {
			if (!sharedVisual) obj.hidden = false
			obj.runtimeVisibilityCulled = false
		}
	})

	setPerformanceCounter("visibilityObjects", objects.size)
	setPerformanceCounter("visibilityCulled", culled)
}

function ensureRegistry() {
	if (initialized) return
	initialized = true
	for (const obj of k.get<GameObj>(tags.gameLoop)) registerObject(obj)
	k.onAdd(tags.gameLoop, registerObject)
	k.onAdd(tags.runtimeCullable, registerObject)
}

function registerObject(obj: GameObj) {
	if (!obj.pos || !isCullable(obj) || objects.has(obj.id)) return
	const visibilityObject = obj as VisibilityObject
	objects.add(visibilityObject)
	obj.onDestroy(() => objects.remove(obj.id))
}

function isCullable(obj: GameObj) {
	return obj.is(tags.enemy) || obj.is(tags.projectile) || obj.is(tags.debree)
		|| obj.is(tags.runtimeCullable)
}

function getVisualRadius(obj: GameObj) {
	const width = typeof obj.width === "number" ? obj.width * (obj.scale?.x ?? 1) : 0
	const height = typeof obj.height === "number" ? obj.height * (obj.scale?.y ?? 1) : 0
	return Math.max(24, width / 2, height / 2, obj.hb ?? 0)
}
