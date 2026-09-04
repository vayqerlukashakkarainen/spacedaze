import type { GameObj, KEventController, Vec2 } from "kaplay"
import { k } from "../main"
import { tags } from "../tags"
import { DensePool } from "./densePool"
import { profileSection, setPerformanceCounter } from "./frameProfilerService"
import { runLoop } from "./runLoopService"

type PointerCallback = () => void

export interface UiPointerRegion {
	id: number
	obj?: GameObj
	size: Vec2
	centered: boolean
	hovered: boolean
	clickCallbacks: Set<PointerCallback>
	hoverCallbacks: Set<PointerCallback>
	hoverEndCallbacks: Set<PointerCallback>
	hoverUpdateCallbacks: Set<PointerCallback>
}

const regions = new DensePool<UiPointerRegion>((region) => region.id)
let nextRegionId = 1
let pointerController: GameObj | undefined
let pressController: KEventController | undefined
let clickDispatchActive = false

export function createUiPointerRegion(size: Vec2, centered = false) {
	const region: UiPointerRegion = {
		id: nextRegionId++,
		size,
		centered,
		hovered: false,
		clickCallbacks: new Set(),
		hoverCallbacks: new Set(),
		hoverEndCallbacks: new Set(),
		hoverUpdateCallbacks: new Set(),
	}

	return {
		id: "uiPointerRegion",
		add(this: GameObj) {
			region.obj = this
			regions.add(region)
			ensurePointerController()
		},
		destroy() {
			regions.remove(region.id)
		},
		isHovering() {
			const obj = region.obj
			return !!obj?.exists() &&
				!isHidden(obj) &&
				containsScreenPoint(region, k.mousePos())
		},
		onClick(callback: PointerCallback) {
			return addCallback(region.clickCallbacks, callback)
		},
		onHover(callback: PointerCallback) {
			return addCallback(region.hoverCallbacks, callback)
		},
		onHoverEnd(callback: PointerCallback) {
			return addCallback(region.hoverEndCallbacks, callback)
		},
		onHoverUpdate(callback: PointerCallback) {
			return addCallback(region.hoverUpdateCallbacks, callback)
		},
	}
}

export function updateUiPointerRegions() {
	profileSection("uiPointer", () => {
		const mousePos = k.mousePos()
		regions.forEach((region) => {
			const obj = region.obj
			if (!obj?.exists()) {
				regions.remove(region.id)
				return
			}
			const hovered = !isHidden(obj) && containsScreenPoint(region, mousePos)
			if (hovered && !region.hovered) callCallbacks(region.hoverCallbacks)
			if (!hovered && region.hovered) callCallbacks(region.hoverEndCallbacks)
			region.hovered = hovered
			if (hovered) callCallbacks(region.hoverUpdateCallbacks)
		})
	})
	setPerformanceCounter("uiPointerRegions", regions.size)
}

export function isPointerOverUi() {
	const mousePos = k.mousePos()
	for (let index = regions.size - 1; index >= 0; index--) {
		const region = regions.items[index]
		const obj = region.obj
		if (!obj?.exists() || isHidden(obj)) continue
		if (containsScreenPoint(region, mousePos)) return true
	}
	return false
}

function ensurePointerController() {
	if (pointerController?.exists()) return
	const controller = k.add([tags.props, tags.gameLoop])
	pointerController = controller
	pressController = k.onMousePress("left", dispatchClick)
	controller.onUpdate(() => {
		if (!runLoop.isEnabled()) updateUiPointerRegions()
	})
	controller.onDestroy(() => {
		if (pointerController?.id !== controller.id) return
		pressController?.cancel()
		pressController = undefined
		pointerController = undefined
		regions.clear()
	})
}

function dispatchClick() {
	if (clickDispatchActive) return
	for (let index = regions.size - 1; index >= 0; index--) {
		const region = regions.items[index]
		const obj = region?.obj
		if (!obj?.exists() || isHidden(obj)) continue
		if (!containsScreenPoint(region, k.mousePos())) continue
		if (region.clickCallbacks.size === 0) continue
		clickDispatchActive = true
		try {
			callCallbacks(region.clickCallbacks)
		} finally {
			queueMicrotask(() => {
				clickDispatchActive = false
			})
		}
		return
	}
}

function containsScreenPoint(region: UiPointerRegion, screenPoint: Vec2) {
	const obj = region.obj
	if (!obj) return false
	const local = obj.fromScreen(screenPoint)
	const minX = region.centered ? -region.size.x / 2 : 0
	const minY = region.centered ? -region.size.y / 2 : 0
	return local.x >= minX &&
		local.x <= minX + region.size.x &&
		local.y >= minY &&
		local.y <= minY + region.size.y
}

function isHidden(obj: GameObj) {
	let current: GameObj | null = obj
	while (current) {
		if (current.hidden) return true
		current = current.parent
	}
	return false
}

function addCallback(callbacks: Set<PointerCallback>, callback: PointerCallback) {
	callbacks.add(callback)
	return {
		cancel() {
			callbacks.delete(callback)
		},
	}
}

function callCallbacks(callbacks: Set<PointerCallback>) {
	for (const callback of callbacks) callback()
}
