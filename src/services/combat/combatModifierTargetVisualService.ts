import type { GameObj } from "kaplay"
import { k, layers } from "../../main"
import { tags } from "../../tags"
import { registerBatchedEntityUpdate } from "../core/entityUpdateService"
import {
	getTargetHitRadius,
	getTargetWorldPosition,
} from "./targetingService"
import type { PositionedCombatTarget } from "./combatTarget"

const PAINT_COLOR = [255, 70, 190] as const
const GRAVITY_COLOR = [190, 95, 255] as const
const EXECUTION_COLOR = [255, 55, 55] as const

export function ensurePaintTargetVisual(target: PositionedCombatTarget) {
	const existing = target.paintTargetVisual as GameObj | undefined
	if (existing?.exists()) return
	const effect = k.add([
		k.pos(getTargetWorldPosition(target)),
		k.layer(layers.gameEffects),
		k.z(14),
		{
			draw() {
				const stacks = Math.max(0, target.projectilePaintStacks ?? 0)
				if (stacks <= 0) return
				const radius = Math.max(7, getTargetHitRadius(target) * 0.78)
				const count = Math.min(8, stacks)
				for (let index = 0; index < count; index++) {
					const angle = -90 + index * 360 / count
					const direction = k.Vec2.fromAngle(angle)
					const side = k.vec2(-direction.y, direction.x)
					const center = direction.scale(radius + 2)
					const length = 2.5 + Math.min(3, stacks * 0.35)
					k.drawLine({
						p1: center.sub(side.scale(length)),
						p2: center.add(side.scale(length)),
						width: 1.5,
						color: k.rgb(...PAINT_COLOR),
						opacity: 0.55 + Math.min(0.4, stacks * 0.07),
					})
				}
			},
		},
		tags.gameLoop,
	])
	target.paintTargetVisual = effect
	registerBatchedEntityUpdate("effects", effect, () => {
		if (!target.exists() || (target.projectilePaintStacks ?? 0) <= 0) {
			if (effect.exists()) k.destroy(effect)
			if (target.exists() && target.paintTargetVisual?.id === effect.id) {
				delete target.paintTargetVisual
			}
			return
		}
		effect.pos = getTargetWorldPosition(target)
	})
}

export function showGravityPullTargetVisual(
	target: PositionedCombatTarget,
	strength: number
) {
	const existing = target.gravityTargetVisual as GameObj | undefined
	if (existing?.exists()) {
		existing.expiresAt = k.time() + 0.14
		existing.strength = Math.max(existing.strength ?? 0, strength)
		return
	}
	const effect = k.add([
		k.pos(getTargetWorldPosition(target)),
		k.layer(layers.gameEffects),
		k.z(12),
		{
			expiresAt: k.time() + 0.14,
			strength,
			draw() {
				const radius = Math.max(8, getTargetHitRadius(target) * 0.72)
				for (let index = 0; index < 3; index++) {
					const angle = k.time() * 190 + index * 120
					const direction = k.Vec2.fromAngle(angle)
					k.drawCircle({
						pos: direction.scale(radius),
						radius: 1 + this.strength * 0.8,
						color: k.rgb(...GRAVITY_COLOR),
						opacity: 0.45 + this.strength * 0.4,
					})
				}
			},
		},
		tags.gameLoop,
	])
	target.gravityTargetVisual = effect
	registerBatchedEntityUpdate("effects", effect, () => {
		if (!target.exists() || k.time() >= effect.expiresAt) {
			if (effect.exists()) k.destroy(effect)
			if (target.exists() && target.gravityTargetVisual?.id === effect.id) {
				delete target.gravityTargetVisual
			}
			return
		}
		effect.pos = getTargetWorldPosition(target)
		effect.strength = Math.max(0, effect.strength - k.dt() * 2)
	})
}

export function spawnExecutionTargetFeedback(target: PositionedCombatTarget) {
	const effect = k.add([
		k.pos(getTargetWorldPosition(target)),
		k.layer(layers.gameEffects),
		k.z(18),
		{
			elapsed: 0,
			draw() {
				const progress = k.clamp(this.elapsed / 0.32, 0, 1)
				const radius = Math.max(9, getTargetHitRadius(target)) + progress * 7
				const opacity = 1 - progress
				for (const angle of [45, 135]) {
					const direction = k.Vec2.fromAngle(angle)
					k.drawLine({
						p1: direction.scale(-radius),
						p2: direction.scale(radius),
						width: 2,
						color: k.rgb(...EXECUTION_COLOR),
						opacity,
					})
				}
			},
		},
		tags.gameLoop,
	])
	registerBatchedEntityUpdate("effects", effect, () => {
		if (!target.exists()) {
			k.destroy(effect)
			return
		}
		effect.elapsed += k.dt()
		effect.pos = getTargetWorldPosition(target)
		if (effect.elapsed >= 0.32) k.destroy(effect)
	})
}
