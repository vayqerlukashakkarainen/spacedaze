import type { EaseFunc, GameObj, TweenController, Vec2 } from "kaplay"
import { k } from "../../main"

interface UiModalTransitionOptions {
	panelPos: Vec2
	panelScale?: number
	backdropOpacity?: number
}

interface UiElementTransitionOptions {
	pos: Vec2
	scale?: number
	travel?: number
}

const OPEN_DURATION = 0.18
const CLOSE_DURATION = 0.14
const activeFadeTweens = new Map<number, TweenController>()

export function playUiModalOpen(
	backdrop: GameObj,
	panel: GameObj,
	{
		panelPos,
		panelScale = 1,
		backdropOpacity = 0.8,
	}: UiModalTransitionOptions
) {
	backdrop.animation.seek(0)
	backdrop.opacity = 0
	backdrop.animate("opacity", [0, backdropOpacity], {
		duration: OPEN_DURATION,
		loops: 1,
		easing: k.easings.easeOutCubic,
	})
	playUiElementOpen(panel, { pos: panelPos, scale: panelScale })
}

export function playUiModalClose(
	backdrop: GameObj,
	panel: GameObj,
	{
		panelPos,
		panelScale = 1,
		backdropOpacity = 0.8,
	}: UiModalTransitionOptions
): Promise<void> {
	if (backdrop.exists()) {
		backdrop.animation.seek(0)
		backdrop.animate("opacity", [backdropOpacity, 0], {
			duration: CLOSE_DURATION,
			loops: 1,
			easing: k.easings.easeInCubic,
		})
	}
	return playUiElementClose(panel, {
		pos: panelPos,
		scale: panelScale,
		travel: 20,
	})
}

export function playUiElementOpen(
	element: GameObj,
	{ pos, scale = 1, travel = 18 }: UiElementTransitionOptions
) {
	if (!element.exists()) return
	element.animation.seek(0)
	element.pos = pos.add(0, travel * 0.7)
	element.scale = k.vec2(scale * 0.95)
	void k.wait(0).then(() => fadeElementTree(element, 0, 1, OPEN_DURATION))
	element.animate("pos", [element.pos, pos], {
		duration: OPEN_DURATION,
		loops: 1,
		easing: k.easings.easeOutCubic,
	})
	element.animate(
		"scale",
		[k.vec2(scale * 0.95), k.vec2(scale * 1.008), k.vec2(scale)],
		{
			duration: OPEN_DURATION,
			loops: 1,
			timing: [0, 0.78, 1],
			easing: k.easings.easeOutCubic,
		}
	)
}

export function playUiElementClose(
	element: GameObj,
	{ pos, scale = 1, travel = 20 }: UiElementTransitionOptions
): Promise<void> {
	return new Promise((resolve) => {
		if (!element.exists()) {
			resolve()
			return
		}

		let settled = false
		let finishedController: ReturnType<typeof element.onAnimateFinished> | undefined
		const finish = () => {
			if (settled) return
			settled = true
			finishedController?.cancel()
			resolve()
		}
		element.animation.seek(0)
		finishedController = element.onAnimateFinished(finish)
		fadeElementTree(
			element,
			getCurrentFadeFactor(element),
			0,
			CLOSE_DURATION,
			k.easings.easeInCubic
		)
		element.animate("pos", [element.pos, pos.add(0, travel)], {
			duration: CLOSE_DURATION,
			loops: 1,
			easing: k.easings.easeInCubic,
		})
		element.animate("scale", [element.scale, k.vec2(scale * 0.94)], {
			duration: CLOSE_DURATION,
			loops: 1,
			easing: k.easings.easeInCubic,
		})
		void k.wait(CLOSE_DURATION + 0.05).then(finish)
	})
}

function fadeElementTree(
	element: GameObj,
	from: number,
	to: number,
	duration: number,
	easing: EaseFunc = k.easings.easeOutCubic
) {
	if (!element.exists()) return
	activeFadeTweens.get(element.id)?.cancel()
	const nodes = collectElementTree(element)
	const baselines = nodes.map((node) => {
		if (!node.has("opacity")) node.use(k.opacity(1))
		if (typeof node.uiTransitionBaseOpacity !== "number") {
			node.uiTransitionBaseOpacity = node.opacity
		}
		return node.uiTransitionBaseOpacity as number
	})
	const apply = (factor: number) => {
		nodes.forEach((node, index) => {
			if (node.exists()) node.opacity = baselines[index] * factor
		})
	}
	apply(from)
	const tween = k.tween(from, to, duration, apply, easing)
	activeFadeTweens.set(element.id, tween)
	tween.onEnd(() => {
		if (activeFadeTweens.get(element.id) === tween) {
			activeFadeTweens.delete(element.id)
		}
	})
}

function getCurrentFadeFactor(element: GameObj) {
	if (!element.has("opacity")) return 1
	const baseline = element.uiTransitionBaseOpacity as number | undefined
	if (!baseline) return 1
	return k.clamp(element.opacity / baseline, 0, 1)
}

export function getUiTreeTransitionOpacity(element: GameObj) {
	let current: GameObj | null = element
	let opacity = 1
	while (current) {
		if (current.hidden) return 0
		const baseline = current.uiTransitionBaseOpacity as number | undefined
		if (baseline && current.has("opacity")) {
			opacity = Math.min(
				opacity,
				k.clamp(current.opacity / baseline, 0, 1)
			)
		}
		current = current.parent
	}
	return opacity
}

function collectElementTree(element: GameObj): GameObj[] {
	return [
		element,
		...element.children.flatMap((child) => collectElementTree(child)),
	]
}
