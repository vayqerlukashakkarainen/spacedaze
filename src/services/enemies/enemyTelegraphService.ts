import type { GameObj, Vec2 } from "kaplay"
import { k, layers } from "../../main"
import { registerBatchedEntityUpdate } from "../core/entityUpdateService"
import { tags } from "../../tags"
import { DensePool } from "../core/densePool"

interface TelegraphVisual {
	id: number
	obj: GameObj
	kind: "target" | "line"
	duration: number
	radius?: number
	end?: Vec2
}

const visuals = new DensePool<TelegraphVisual>((visual) => visual.id)
let visualController: GameObj | undefined

interface TelegraphOptions {
	duration: number
	tags?: string[]
	onComplete?: () => void
}

interface LineTelegraphOptions extends TelegraphOptions {
	getStart?: () => Vec2 | undefined
	getEnd?: () => Vec2 | undefined
}

export function spawnTargetTelegraph(
	pos: Vec2,
	radius: number,
	options: TelegraphOptions
) {
	const telegraph = k.add([
		k.pos(pos),
		k.opacity(1),
		{ elapsed: 0 },
		tags.props,
		tags.gameLoop,
		...(options.tags ?? []),
	])
	registerVisual(telegraph, "target", options.duration, { radius })
	registerBatchedEntityUpdate("effects", telegraph, () => {
		telegraph.elapsed += k.dt()
		if (telegraph.elapsed < options.duration) return
		options.onComplete?.()
		k.destroy(telegraph)
	})
	return telegraph
}

export function spawnLineTelegraph(
	start: Vec2,
	end: Vec2,
	options: LineTelegraphOptions
) {
	const telegraph = k.add([
		k.pos(start),
		{ elapsed: 0, lineEnd: end.clone() },
		tags.props,
		tags.gameLoop,
		...(options.tags ?? []),
	])
	registerVisual(telegraph, "line", options.duration, { end })
	registerBatchedEntityUpdate("effects", telegraph, () => {
		const nextStart = options.getStart?.()
		const nextEnd = options.getEnd?.()
		if (nextStart) telegraph.pos = nextStart
		if (nextEnd) telegraph.lineEnd = nextEnd
		telegraph.elapsed += k.dt()
		if (telegraph.elapsed < options.duration) return
		options.onComplete?.()
		k.destroy(telegraph)
	})
	return telegraph
}

function registerVisual(
	obj: GameObj,
	kind: TelegraphVisual["kind"],
	duration: number,
	geometry: { radius?: number; end?: Vec2 }
) {
	visuals.add({ id: obj.id, obj, kind, duration, ...geometry })
	obj.onDestroy(() => visuals.remove(obj.id))
	ensureVisualController()
}

function ensureVisualController() {
	if (visualController?.exists()) return
	visualController = k.add([
		k.pos(0, 0),
		k.layer(layers.gameEffects),
		{
			draw() {
				visuals.forEach(drawVisual)
			},
		},
		tags.props,
		tags.gameLoop,
	])
	visualController.onDestroy(() => {
		visuals.clear()
		visualController = undefined
	})
}

function drawVisual(visual: TelegraphVisual) {
	const obj = visual.obj
	if (!obj.exists() || obj.runtimeVisibilityCulled === true) return
	const progress = k.clamp(obj.elapsed / visual.duration, 0, 1)
	if (visual.kind === "target") {
		const radius = visual.radius ?? 0
		k.drawCircle({
			pos: obj.pos,
			radius: radius * k.lerp(1.35, 0.72, progress),
			color: k.WHITE,
			opacity: k.wave(0.15, 0.42, k.time() * 9),
			anchor: "center",
		})
		k.drawCircle({
			pos: obj.pos,
			radius: radius * 0.62,
			color: k.BLACK,
			anchor: "center",
		})
		return
	}
	const lineEnd = obj.lineEnd ?? visual.end
	if (!lineEnd) return
	k.drawLine({
		p1: obj.pos,
		p2: lineEnd,
		width: k.lerp(1, 3, progress),
		color: k.WHITE,
		opacity: k.wave(0.18, 0.8, k.time() * 10),
	})
}
