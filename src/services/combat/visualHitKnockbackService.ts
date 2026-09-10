import type { GameObj, Vec2 } from "kaplay"
import { k } from "../../main"
import { tags } from "../../tags"

const VISUAL_HIT_DISTANCE = 2
const VISUAL_HIT_DURATION = 0.12
const VISUAL_HIT_PEAK = 0.2

interface VisualHitState {
	id: number
	target: GameObj
	direction: Vec2
	elapsed: number
	shaderNodes: GameObj[]
}

const activeHits = new Map<number, VisualHitState>()
let controller: GameObj | undefined

export function playVisualHitKnockback(target: GameObj, direction: Vec2) {
	if (!target.exists() || !target.pos || direction.len() <= 0.001) return
	const normalizedDirection = direction.unit()
	const existing = activeHits.get(target.id)
	if (existing) {
		existing.direction = normalizedDirection
		existing.elapsed = 0
		return
	}

	target.visualHitOffset = k.vec2(0, 0)
	const state: VisualHitState = {
		id: target.id,
		target,
		direction: normalizedDirection,
		elapsed: 0,
		shaderNodes: target.dataOrientedVisual === true
			? []
			: installVisualOffsetShaders(target),
	}
	activeHits.set(target.id, state)
	target.onDestroy(() => clearVisualHit(state))
	ensureController()
}

function ensureController() {
	if (controller?.exists()) return
	controller = k.add([
		{
			update() {
				updateVisualHits()
			},
		},
		tags.gameLoop,
	])
	controller.onDestroy(() => {
		for (const state of activeHits.values()) clearVisualHit(state)
		activeHits.clear()
		controller = undefined
	})
}

function updateVisualHits() {
	for (const state of activeHits.values()) {
		if (!state.target.exists()) {
			clearVisualHit(state)
			continue
		}
		state.elapsed += k.dt()
		const progress = k.clamp(state.elapsed / VISUAL_HIT_DURATION, 0, 1)
		const distance = getVisualHitDistance(progress)
		state.target.visualHitOffset = state.direction.scale(distance)
		if (progress >= 1) clearVisualHit(state)
	}
}

function getVisualHitDistance(progress: number) {
	if (progress < VISUAL_HIT_PEAK) {
		return VISUAL_HIT_DISTANCE * easeOutCubic(progress / VISUAL_HIT_PEAK)
	}
	const returnProgress = (progress - VISUAL_HIT_PEAK) /
		(1 - VISUAL_HIT_PEAK)
	return VISUAL_HIT_DISTANCE * (1 - easeOutCubic(returnProgress))
}

function easeOutCubic(value: number) {
	return 1 - Math.pow(1 - value, 3)
}

function installVisualOffsetShaders(target: GameObj) {
	const shaderNodes: GameObj[] = []
	for (const node of collectObjectTree(target)) {
		if (!node.exists() || node.has("shader")) continue
		node.use(k.shader("visualHitKnockback", () => ({
			u_visualHitOffset: target.visualHitOffset ?? k.vec2(0, 0),
		})))
		shaderNodes.push(node)
	}
	return shaderNodes
}

function collectObjectTree(root: GameObj): GameObj[] {
	return [
		root,
		...root.children.flatMap((child) => collectObjectTree(child)),
	]
}

function clearVisualHit(state: VisualHitState) {
	if (activeHits.get(state.id) !== state) return
	activeHits.delete(state.id)
	if (state.target.exists()) state.target.visualHitOffset = k.vec2(0, 0)
	for (const node of state.shaderNodes) {
		if (
			node.exists() &&
			node.has("shader") &&
			node.shader === "visualHitKnockback"
		) node.unuse("shader")
	}
}
