import type { GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { playUiElementClose, playUiElementOpen } from "./modalTransition"

export interface UiCollapsibleProps {
	pos?: Vec2
	expanded?: boolean
	createContent: (parent: GameObj) => void
	onExpandedChange?: (expanded: boolean) => void
}

export interface UiCollapsible {
	obj: GameObj
	isExpanded: () => boolean
	setExpanded: (expanded: boolean) => void
	expand: () => void
	collapse: () => void
	toggle: () => void
}

export function createUiCollapsible(
	parent: GameObj,
	props: UiCollapsibleProps
): UiCollapsible {
	const root = parent.add([k.pos(props.pos ?? k.vec2(0, 0))])
	let content: GameObj | undefined
	let controlExpanded = false
	let transitionId = 0
	const contentPos = k.vec2(0, 0)

	const setExpanded = (expanded: boolean) => {
		if (expanded === controlExpanded) return
		transitionId++
		const currentTransition = transitionId
		const existingContent = content
		controlExpanded = expanded
		if (expanded) {
			if (!existingContent?.exists()) {
				content = root.add([
					k.pos(contentPos),
					k.scale(1),
					k.animate(),
				])
				props.createContent(content)
			}
			if (content?.exists()) {
				playUiElementOpen(content, { pos: contentPos, travel: 12 })
			}
		} else if (existingContent?.exists()) {
			void playUiElementClose(existingContent, {
				pos: contentPos,
				travel: 12,
			}).then(() => {
				if (currentTransition !== transitionId) return
				if (existingContent.exists()) k.destroy(existingContent)
				if (content === existingContent) content = undefined
			})
		}
		props.onExpandedChange?.(expanded)
	}
	const control: UiCollapsible = {
		obj: root,
		isExpanded: () => controlExpanded,
		setExpanded,
		expand: () => setExpanded(true),
		collapse: () => setExpanded(false),
		toggle: () => setExpanded(!controlExpanded),
	}

	if (props.expanded) setExpanded(true)
	return control
}
