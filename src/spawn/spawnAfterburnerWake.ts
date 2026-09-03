import type { GameObj, PosComp, Vec2 } from "kaplay"
import { k } from "../main"
import { applyDamage } from "../services/damageService"
import { tags } from "../tags"

interface Props {
	pos: Vec2
	enhanced?: boolean
}

export function spawnAfterburnerWake(props: Props) {
	const duration = props.enhanced ? 1.15 : 0.85
	const radius = props.enhanced ? 24 : 18
	const damage = props.enhanced ? 3 : 2
	const hitTargets = new Set<number>()
	const wake = k.add([
		k.pos(props.pos),
		k.circle(radius),
		k.anchor("center"),
		k.color(255, 125, 25),
		k.opacity(0.45),
		k.scale(1),
		k.z(-2),
		{ elapsed: 0 },
		tags.props,
		tags.gameLoop,
	])

	wake.onUpdate(() => {
		wake.elapsed += k.dt()
		const progress = k.clamp(wake.elapsed / duration, 0, 1)
		wake.opacity = 0.45 * (1 - progress)
		wake.scale = k.vec2(k.lerp(0.65, 1.25, progress))

		for (const enemy of k.get(tags.enemy) as GameObj<PosComp>[]) {
			if (!enemy.exists() || !enemy.pos || hitTargets.has(enemy.id!)) continue
			if (enemy.pos.dist(wake.pos) >= radius * wake.scale.x) continue
			hitTargets.add(enemy.id!)
			applyDamage(enemy, damage)
		}

		if (progress >= 1) k.destroy(wake)
	})

	return wake
}
