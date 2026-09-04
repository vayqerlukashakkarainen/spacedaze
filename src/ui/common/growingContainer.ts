import type { GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { createUiVerticalFlow } from "./flow"
import {
	createUiSurface,
	type UiSurfaceTone,
} from "./surface"

interface UiContainerPadding {
	top: number
	right: number
	bottom: number
	left: number
}

export interface UiGrowingContainerProps {
	pos: Vec2
	width: number
	minHeight?: number
	padding?: number | Partial<UiContainerPadding>
	gap?: number
	anchor?: "topleft" | "center"
	tone?: UiSurfaceTone
	borderColor?: readonly [number, number, number]
	opacity?: number
	tags?: string[]
}

export function createUiGrowingContainer(
	parent: GameObj,
	props: UiGrowingContainerProps
) {
	const anchor = props.anchor ?? "topleft"
	const padding = resolvePadding(props.padding)
	const root = parent.add([k.pos(props.pos)])
	let height = props.minHeight ?? padding.top + padding.bottom
	const surface = createUiSurface(root, {
		pos: k.vec2(0, 0),
		size: k.vec2(props.width, height),
		anchor,
		tone: props.tone,
		borderColor: props.borderColor,
		opacity: props.opacity,
		tags: props.tags,
	})
	const contentX = anchor === "center"
		? -props.width / 2 + padding.left
		: padding.left
	const contentWidth = Math.max(
		0,
		props.width - padding.left - padding.right
	)
	const contentY = () => anchor === "center"
		? -height / 2 + padding.top
		: padding.top
	const flow = createUiVerticalFlow(root, {
		pos: k.vec2(contentX, contentY()),
		width: contentWidth,
		gap: props.gap,
		onHeightChange: (contentHeight) => {
			height = Math.max(
				props.minHeight ?? 0,
				padding.top + contentHeight + padding.bottom
			)
			surface.height = height
			flow.obj.pos.y = contentY()
		},
	})

	return {
		obj: root,
		surface,
		flow,
		getHeight: () => height,
		getSize: () => k.vec2(props.width, height),
	}
}

function resolvePadding(
	padding: number | Partial<UiContainerPadding> | undefined
): UiContainerPadding {
	if (typeof padding === "number") {
		return {
			top: padding,
			right: padding,
			bottom: padding,
			left: padding,
		}
	}
	return {
		top: padding?.top ?? 0,
		right: padding?.right ?? 0,
		bottom: padding?.bottom ?? 0,
		left: padding?.left ?? 0,
	}
}
