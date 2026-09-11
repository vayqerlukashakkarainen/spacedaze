import { GameObj, Vec2 } from "kaplay"
import { k, layers } from "../../main"
import { uiState } from "../uiState"
import { uiHitRegion } from "./hitRegion"
import { UI_COLORS } from "./theme"

interface ScrollableProps {
	parent?: GameObj
	pos: Vec2
	width: number
	height: number
	contentWidth?: number
	contentHeight?: number
	scrollStep?: number
	wheelEnabled?: boolean
	captureWheel?: boolean
	layer?: string
	zIndex?: number
	tags?: string[]
}

export interface UiScrollableControl {
	obj: ReturnType<typeof k.add>
	content: ReturnType<typeof k.add>
	getScroll: () => number
	getMaxScroll: () => number
	getScrollX: () => number
	getMaxScrollX: () => number
	isAtEnd: () => boolean
	setScroll: (value: number) => void
	setScrollX: (value: number) => void
	scrollBy: (amount: number) => void
	scrollByX: (amount: number) => void
	scrollToStart: () => void
	scrollToEnd: () => void
	setContentWidth: (width: number, keepAtEnd?: boolean) => void
	setContentHeight: (height: number, keepAtEnd?: boolean) => void
	destroy: () => void
}

export function createUiScrollable({
	parent,
	pos,
	width,
	height,
	contentWidth = width,
	contentHeight = height,
	scrollStep = 38,
	wheelEnabled = true,
	captureWheel = false,
	layer = layers.ui,
	zIndex = 0,
	tags = [],
}: ScrollableProps): UiScrollableControl {
	let scroll = 0
	let scrollX = 0
	let measuredContentWidth = Math.max(width, contentWidth)
	let measuredContentHeight = Math.max(height, contentHeight)
	let draggingVerticalThumb = false
	let draggingHorizontalThumb = false
	let verticalDragOffset = 0
	let horizontalDragOffset = 0

	const viewportComponents = [
		k.pos(pos),
		k.rect(width, height),
		uiHitRegion(k.vec2(width, height)),
		k.color(0, 0, 0),
		k.mask("intersect"),
		...tags,
	]
	const viewport = parent
		? parent.add(viewportComponents)
		: k.add([
			...viewportComponents,
			k.fixed(),
			k.layer(layer),
			k.z(zIndex),
		])

	const content = viewport.add([k.pos(0, 0), ...tags])
	const scrollbarSize = 5
	const scrollbarHitSize = 16
	const verticalTrack = viewport.add([
		k.pos(width - scrollbarSize, 0),
		k.rect(scrollbarSize, height),
		k.color(...UI_COLORS.border),
		...tags,
	])
	const verticalThumb = viewport.add([
		k.pos(width - scrollbarSize, 0),
		k.rect(scrollbarSize, height),
		k.color(...UI_COLORS.muted),
		...tags,
	])
	const verticalInteraction = viewport.add([
		k.pos(width - scrollbarHitSize / 2, height / 2),
		uiHitRegion(k.vec2(scrollbarHitSize, height), true),
		...tags,
	])
	const horizontalTrack = viewport.add([
		k.pos(0, height - scrollbarSize),
		k.rect(width, scrollbarSize),
		k.color(...UI_COLORS.border),
		...tags,
	])
	const horizontalThumb = viewport.add([
		k.pos(0, height - scrollbarSize),
		k.rect(width, scrollbarSize),
		k.color(...UI_COLORS.muted),
		...tags,
	])
	const horizontalInteraction = viewport.add([
		k.pos(width / 2, height - scrollbarHitSize / 2),
		uiHitRegion(k.vec2(width, scrollbarHitSize), true),
		...tags,
	])

	const maxScroll = () => Math.max(0, measuredContentHeight - height)
	const maxScrollX = () => Math.max(0, measuredContentWidth - width)
	const updateScrollbar = () => {
		const verticalMaximum = maxScroll()
		const horizontalMaximum = maxScrollX()
		const verticallyScrollable = verticalMaximum > 0
		const horizontallyScrollable = horizontalMaximum > 0
		verticalTrack.hidden = !verticallyScrollable
		verticalThumb.hidden = !verticallyScrollable
		verticalInteraction.hidden = !verticallyScrollable
		horizontalTrack.hidden = !horizontallyScrollable
		horizontalThumb.hidden = !horizontallyScrollable
		horizontalInteraction.hidden = !horizontallyScrollable

		if (verticallyScrollable) {
			verticalThumb.height = Math.max(
				24,
				height * (height / measuredContentHeight)
			)
			const travel = height - verticalThumb.height
			verticalThumb.pos = k.vec2(
				verticalThumb.pos.x,
				(scroll / verticalMaximum) * travel
			)
		}
		if (horizontallyScrollable) {
			horizontalThumb.width = Math.max(
				24,
				width * (width / measuredContentWidth)
			)
			const travel = width - horizontalThumb.width
			horizontalThumb.pos = k.vec2(
				(scrollX / horizontalMaximum) * travel,
				horizontalThumb.pos.y
			)
		}
	}

	const setScroll = (value: number) => {
		scroll = k.clamp(value, 0, maxScroll())
		content.pos = k.vec2(content.pos.x, -scroll)
		updateScrollbar()
	}
	const setScrollX = (value: number) => {
		scrollX = k.clamp(value, 0, maxScrollX())
		content.pos = k.vec2(-scrollX, content.pos.y)
		updateScrollbar()
	}

	const setVerticalScrollFromMouse = (centerThumb = false) => {
		const pointer = viewport.fromScreen(k.mousePos())
		const offset = centerThumb ? verticalThumb.height / 2 : verticalDragOffset
		const localY = pointer.y - offset
		const travel = Math.max(1, height - verticalThumb.height)
		setScroll((localY / travel) * maxScroll())
	}
	const setHorizontalScrollFromMouse = (centerThumb = false) => {
		const pointer = viewport.fromScreen(k.mousePos())
		const offset = centerThumb ? horizontalThumb.width / 2 : horizontalDragOffset
		const localX = pointer.x - offset
		const travel = Math.max(1, width - horizontalThumb.width)
		setScrollX((localX / travel) * maxScrollX())
	}
	const verticalThumbHovered = () => {
		if (verticalThumb.hidden) return false
		const local = verticalThumb.fromScreen(k.mousePos())
		const padding = (scrollbarHitSize - scrollbarSize) / 2
		return local.x >= -padding &&
			local.x <= scrollbarSize + padding &&
			local.y >= 0 &&
			local.y <= verticalThumb.height
	}
	const horizontalThumbHovered = () => {
		if (horizontalThumb.hidden) return false
		const local = horizontalThumb.fromScreen(k.mousePos())
		const padding = (scrollbarHitSize - scrollbarSize) / 2
		return local.x >= 0 &&
			local.x <= horizontalThumb.width &&
			local.y >= -padding &&
			local.y <= scrollbarSize + padding
	}
	const syncHoverVisuals = () => {
		const verticalHovered = verticalInteraction.isHovering()
		const horizontalHovered = horizontalInteraction.isHovering()
		verticalTrack.color = k.rgb(...(
			verticalHovered ? UI_COLORS.muted : UI_COLORS.border
		))
		verticalThumb.color = k.rgb(...(
			draggingVerticalThumb || verticalThumbHovered()
				? UI_COLORS.accent
				: verticalHovered
					? UI_COLORS.text
					: UI_COLORS.muted
		))
		horizontalTrack.color = k.rgb(...(
			horizontalHovered ? UI_COLORS.muted : UI_COLORS.border
		))
		horizontalThumb.color = k.rgb(...(
			draggingHorizontalThumb || horizontalThumbHovered()
				? UI_COLORS.accent
				: horizontalHovered
					? UI_COLORS.text
					: UI_COLORS.muted
		))
	}

	const wheelController = k.onScroll((delta) => {
		if (!wheelEnabled) return
		if (!captureWheel && !viewport.isHovering()) return
		if (delta.x !== 0 || k.isKeyDown("shift")) {
			const amount = delta.x !== 0 ? delta.x : delta.y
			setScrollX(scrollX + amount * scrollStep)
			return
		}
		setScroll(scroll + delta.y * scrollStep)
	})
	const pressController = k.onMousePress("left", () => {
		if (verticalThumbHovered()) {
			draggingVerticalThumb = true
			verticalDragOffset = viewport.fromScreen(k.mousePos()).y -
				verticalThumb.pos.y
			uiState.isOverUI = true
			return
		}
		if (horizontalThumbHovered()) {
			draggingHorizontalThumb = true
			horizontalDragOffset = viewport.fromScreen(k.mousePos()).x -
				horizontalThumb.pos.x
			uiState.isOverUI = true
			return
		}
		if (verticalInteraction.isHovering()) {
			setVerticalScrollFromMouse(true)
			return
		}
		if (horizontalInteraction.isHovering()) {
			setHorizontalScrollFromMouse(true)
		}
	})
	const moveController = k.onMouseMove(() => {
		if (draggingVerticalThumb) {
			setVerticalScrollFromMouse()
			uiState.isOverUI = true
		}
		if (draggingHorizontalThumb) {
			setHorizontalScrollFromMouse()
			uiState.isOverUI = true
		}
	})
	const releaseController = k.onMouseRelease("left", () => {
		draggingVerticalThumb = false
		draggingHorizontalThumb = false
		uiState.isOverUI = viewport.isHovering()
	})

	viewport.onHover(() => {
		uiState.isOverUI = true
	})
	viewport.onHoverEnd(() => {
		if (!draggingVerticalThumb && !draggingHorizontalThumb) {
			uiState.isOverUI = false
		}
	})
	viewport.onUpdate(syncHoverVisuals)
	viewport.onDestroy(() => {
		wheelController.cancel()
		pressController.cancel()
		moveController.cancel()
		releaseController.cancel()
	})

	const control: UiScrollableControl = {
		obj: viewport,
		content,
		getScroll: () => scroll,
		getMaxScroll: maxScroll,
		getScrollX: () => scrollX,
		getMaxScrollX: maxScrollX,
		isAtEnd: () => maxScroll() - scroll < 1,
		setScroll,
		setScrollX,
		scrollBy: (amount) => setScroll(scroll + amount),
		scrollByX: (amount) => setScrollX(scrollX + amount),
		scrollToStart: () => setScroll(0),
		scrollToEnd: () => setScroll(maxScroll()),
		setContentWidth: (newWidth, keepAtEnd = false) => {
			const previousMaximum = maxScrollX()
			const wasAtEnd = previousMaximum > 0 && previousMaximum - scrollX < 1
			measuredContentWidth = Math.max(width, newWidth)
			if (keepAtEnd || wasAtEnd) {
				setScrollX(maxScrollX())
			} else {
				setScrollX(scrollX)
			}
		},
		setContentHeight: (newHeight, keepAtEnd = false) => {
			const wasAtEnd = control.isAtEnd()
			measuredContentHeight = Math.max(height, newHeight)
			if (keepAtEnd || wasAtEnd) {
				control.scrollToEnd()
			} else {
				setScroll(scroll)
			}
		},
		destroy: () => {
			viewport.removeAll()
			k.destroy(viewport)
		},
	}

	updateScrollbar()
	return control
}
