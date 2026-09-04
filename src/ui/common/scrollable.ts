import { Vec2 } from "kaplay"
import { k, layers } from "../../main"
import { uiState } from "../uiState"
import { uiHitRegion } from "./hitRegion"

interface ScrollableProps {
	pos: Vec2
	width: number
	height: number
	contentWidth?: number
	contentHeight?: number
	scrollStep?: number
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
	pos,
	width,
	height,
	contentWidth = width,
	contentHeight = height,
	scrollStep = 38,
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

	const viewport = k.add([
		k.pos(pos),
		k.rect(width, height),
		uiHitRegion(k.vec2(width, height)),
		k.color(0, 0, 0),
		k.mask("intersect"),
		k.fixed(),
		k.layer(layer),
		k.z(zIndex),
		...tags,
	])

	const content = viewport.add([k.pos(0, 0), ...tags])
	const scrollbarSize = 5
	const verticalTrack = viewport.add([
		k.pos(width - scrollbarSize, 0),
		k.rect(scrollbarSize, height),
		uiHitRegion(k.vec2(scrollbarSize, height)),
		k.color(45, 45, 45),
		...tags,
	])
	const verticalThumb = viewport.add([
		k.pos(width - scrollbarSize, 0),
		k.rect(scrollbarSize, height),
		uiHitRegion(k.vec2(scrollbarSize, height)),
		k.color(180, 180, 180),
		...tags,
	])
	const horizontalTrack = viewport.add([
		k.pos(0, height - scrollbarSize),
		k.rect(width, scrollbarSize),
		uiHitRegion(k.vec2(width, scrollbarSize)),
		k.color(45, 45, 45),
		...tags,
	])
	const horizontalThumb = viewport.add([
		k.pos(0, height - scrollbarSize),
		k.rect(width, scrollbarSize),
		uiHitRegion(k.vec2(width, scrollbarSize)),
		k.color(180, 180, 180),
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
		horizontalTrack.hidden = !horizontallyScrollable
		horizontalThumb.hidden = !horizontallyScrollable

		if (verticallyScrollable) {
			verticalThumb.height = Math.max(
				24,
				height * (height / measuredContentHeight)
			)
			const travel = height - verticalThumb.height
			verticalThumb.pos.y = (scroll / verticalMaximum) * travel
		}
		if (horizontallyScrollable) {
			horizontalThumb.width = Math.max(
				24,
				width * (width / measuredContentWidth)
			)
			const travel = width - horizontalThumb.width
			horizontalThumb.pos.x = (scrollX / horizontalMaximum) * travel
		}
	}

	const setScroll = (value: number) => {
		scroll = k.clamp(value, 0, maxScroll())
		content.pos.y = -scroll
		updateScrollbar()
	}
	const setScrollX = (value: number) => {
		scrollX = k.clamp(value, 0, maxScrollX())
		content.pos.x = -scrollX
		updateScrollbar()
	}

	const setVerticalScrollFromMouse = () => {
		const localY =
			k.mousePos().y - viewport.pos.y - verticalThumb.height / 2
		const travel = Math.max(1, height - verticalThumb.height)
		setScroll((localY / travel) * maxScroll())
	}
	const setHorizontalScrollFromMouse = () => {
		const localX =
			k.mousePos().x - viewport.pos.x - horizontalThumb.width / 2
		const travel = Math.max(1, width - horizontalThumb.width)
		setScrollX((localX / travel) * maxScrollX())
	}

	const wheelController = k.onScroll((delta) => {
		if (!viewport.isHovering()) return
		if (delta.x !== 0 || k.isKeyDown("shift")) {
			const amount = delta.x !== 0 ? delta.x : delta.y
			setScrollX(scrollX + amount * scrollStep)
			return
		}
		setScroll(scroll + delta.y * scrollStep)
	})
	const pressController = k.onMousePress("left", () => {
		if (!verticalThumb.hidden && verticalThumb.isHovering()) {
			draggingVerticalThumb = true
			return
		}
		if (!horizontalThumb.hidden && horizontalThumb.isHovering()) {
			draggingHorizontalThumb = true
			return
		}
		if (!verticalTrack.hidden && verticalTrack.isHovering()) {
			setVerticalScrollFromMouse()
			return
		}
		if (!horizontalTrack.hidden && horizontalTrack.isHovering()) {
			setHorizontalScrollFromMouse()
		}
	})
	const moveController = k.onMouseMove(() => {
		if (draggingVerticalThumb) setVerticalScrollFromMouse()
		if (draggingHorizontalThumb) setHorizontalScrollFromMouse()
	})
	const releaseController = k.onMouseRelease("left", () => {
		draggingVerticalThumb = false
		draggingHorizontalThumb = false
	})

	viewport.onHover(() => {
		uiState.isOverUI = true
	})
	viewport.onHoverEnd(() => {
		uiState.isOverUI = false
		draggingVerticalThumb = false
		draggingHorizontalThumb = false
	})
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
