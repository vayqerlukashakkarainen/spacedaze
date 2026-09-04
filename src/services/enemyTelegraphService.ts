import type { Vec2 } from "kaplay"
import { k } from "../main"
import { registerBatchedEntityUpdate } from "./entityUpdateService"
import { tags } from "../tags"

interface TelegraphOptions {
	duration: number
	tags?: string[]
	onComplete?: () => void
}

export function spawnTargetTelegraph(
	pos: Vec2,
	radius: number,
	options: TelegraphOptions
) {
	const telegraph = k.add([
		k.pos(pos),
		k.opacity(1),
		{
			elapsed: 0,
			draw() {
				const progress = k.clamp(this.elapsed / options.duration, 0, 1)
				k.drawCircle({
					pos: k.vec2(),
					radius: radius * k.lerp(1.35, 0.72, progress),
					color: k.WHITE,
					opacity: k.wave(0.15, 0.42, k.time() * 9),
					anchor: "center",
				})
				k.drawCircle({
					pos: k.vec2(),
					radius: radius * 0.62,
					color: k.BLACK,
					anchor: "center",
				})
			},
		},
		tags.props,
		tags.gameLoop,
		...(options.tags ?? []),
	])
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
	options: TelegraphOptions
) {
	const delta = end.sub(start)
	const telegraph = k.add([
		k.pos(start),
		{
			elapsed: 0,
			draw() {
				const progress = k.clamp(this.elapsed / options.duration, 0, 1)
				k.drawLine({
					p1: k.vec2(),
					p2: delta,
					width: k.lerp(1, 3, progress),
					color: k.WHITE,
					opacity: k.wave(0.18, 0.8, k.time() * 10),
				})
			},
		},
		tags.props,
		tags.gameLoop,
		...(options.tags ?? []),
	])
	registerBatchedEntityUpdate("effects", telegraph, () => {
		telegraph.elapsed += k.dt()
		if (telegraph.elapsed < options.duration) return
		options.onComplete?.()
		k.destroy(telegraph)
	})
	return telegraph
}
