import type { GameObj, Vec2 } from "kaplay"
import { k } from "../main"
import { tags } from "../tags"
import { DensePool } from "./densePool"
import { setPerformanceCounter } from "./frameProfilerService"
import type { RunFrameContext } from "./runLoopService"

type VisibilityObject = GameObj & {
	pos: Vec2
	runtimeCullRadius?: number
}

type CullableEmitter = GameObj & {
	runtimeVisibilityEmitterPaused?: boolean
}

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
			if (obj.runtimeVisibilityCulled !== true) {
				obj.hidden = true
				obj.runtimeVisibilityCulled = true
				setEmitterSimulationPaused(obj, true)
			}
			culled++
		} else if (obj.runtimeVisibilityCulled === true) {
			if (!sharedVisual) obj.hidden = false
			obj.runtimeVisibilityCulled = false
			setEmitterSimulationPaused(obj, false)
		}
	})

	setPerformanceCounter("visibilityObjects", objects.size)
	setPerformanceCounter("visibilityCulled", culled)
}

function ensureRegistry() {
	if (initialized) return
	initialized = true
	for (const obj of k.get<GameObj>(tags.gameLoop)) registerObject(obj)
	for (const obj of k.get<GameObj>(tags.runtimeCullable)) registerObject(obj)
	k.onAdd(tags.gameLoop, registerObject)
	k.onAdd(tags.runtimeCullable, registerObject)
	k.onTag(tags.runtimeCullable, registerObject)
	k.onAdd("particles", pauseEmitterUnderCulledParent)
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
	const explicitRadius = typeof obj.runtimeCullRadius === "number"
		? obj.runtimeCullRadius
		: 0
	const width = typeof obj.width === "number"
		? obj.width * Math.abs(obj.scale?.x ?? 1)
		: 0
	const height = typeof obj.height === "number"
		? obj.height * Math.abs(obj.scale?.y ?? 1)
		: 0
	return Math.max(24, explicitRadius, width / 2, height / 2, obj.hb ?? 0)
}

function setEmitterSimulationPaused(root: GameObj, paused: boolean) {
	setEmitterPaused(root, paused)
	for (const descendant of root.get("*", { recursive: true })) {
		setEmitterPaused(descendant, paused)
	}
}

function setEmitterPaused(obj: GameObj, paused: boolean) {
	if (!obj.has("particles")) return
	const emitter = obj as CullableEmitter
	if (paused) {
		if (emitter.paused) return
		emitter.paused = true
		emitter.runtimeVisibilityEmitterPaused = true
		return
	}
	if (emitter.runtimeVisibilityEmitterPaused !== true) return
	emitter.paused = false
	delete emitter.runtimeVisibilityEmitterPaused
}

function pauseEmitterUnderCulledParent(obj: GameObj) {
	let parent = obj.parent
	while (parent) {
		if (parent.runtimeVisibilityCulled === true) {
			setEmitterPaused(obj, true)
			return
		}
		parent = parent.parent
	}
}
