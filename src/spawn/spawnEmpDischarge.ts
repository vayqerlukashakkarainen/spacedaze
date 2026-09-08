import type { Vec2 } from "kaplay"
import { k, layers } from "../main"
import { registerBatchedEntityUpdate } from "../services/entityUpdateService"
import { tags } from "../tags"

interface EmpDischargeProps {
	pos: Vec2
	radius: number
	targets: Vec2[]
}

interface EmpBolt {
	angle: number
	reach: number
	bends: number[]
}

const EMP_DURATION = 0.62

export function spawnEmpDischarge(props: EmpDischargeProps) {
	const bolts: EmpBolt[] = Array.from({ length: 9 }, (_unused, index) => ({
		angle: index * 40 + k.rand(-12, 12),
		reach: k.rand(0.45, 1),
		bends: [k.rand(-8, 8), k.rand(-13, 13), k.rand(-8, 8)],
	}))
	const targetOffsets = props.targets.map((target) => target.sub(props.pos))
	const effect = k.add([
		k.pos(props.pos),
		k.layer(layers.gameEffects),
		{
			elapsed: 0,
			draw() {
				const progress = k.clamp(this.elapsed / EMP_DURATION, 0, 1)
				const opacity = 1 - progress
				const cyan = k.rgb(75, 205, 255)

				for (let band = 0; band < 3; band++) {
					const bandProgress = k.clamp(progress * 1.65 - band * 0.13, 0, 1)
					const radius = props.radius * bandProgress
					if (radius <= 2) continue
					for (let segment = 0; segment < 12; segment++) {
						if ((segment + band) % 4 === 1) continue
						const start = segment * 30 + band * 7
						const end = start + 19
						k.drawLine({
							p1: k.Vec2.fromAngle(start).scale(radius),
							p2: k.Vec2.fromAngle(end).scale(radius),
							width: band === 0 ? 2 : 1,
							color: band === 0 ? k.WHITE : cyan,
							opacity: opacity * (1 - band * 0.2),
						})
					}
				}

				for (const bolt of bolts) {
					const reach = props.radius * bolt.reach * Math.min(1, progress * 5)
					let previous = k.vec2(0)
					for (let step = 1; step <= 4; step++) {
						const distance = reach * step / 4
						const side = k.Vec2.fromAngle(bolt.angle + 90)
						const next = k.Vec2.fromAngle(bolt.angle).scale(distance)
							.add(side.scale(step < 4 ? bolt.bends[step - 1] : 0))
						k.drawLine({
							p1: previous,
							p2: next,
							width: step === 1 ? 2 : 1,
							color: step % 2 === 0 ? cyan : k.WHITE,
							opacity: opacity * 0.9,
						})
						previous = next
					}
				}

				for (let index = 0; index < targetOffsets.length; index++) {
					const target = targetOffsets[index]
					const flicker = Math.floor(this.elapsed * 35 + index) % 2 === 0
					if (!flicker) continue
					const size = 7 + index % 3 * 2
					k.drawLine({
						p1: target.add(-size, 0),
						p2: target.add(0, -size / 2),
						width: 2,
						color: k.WHITE,
						opacity,
					})
					k.drawLine({
						p1: target.add(0, -size / 2),
						p2: target.add(size, 1),
						width: 1,
						color: cyan,
						opacity,
					})
				}

				if (progress < 0.38) {
					const coreSize = k.lerp(18, 4, progress / 0.38)
					k.drawRect({
						pos: k.vec2(-coreSize, -1),
						width: coreSize * 2,
						height: 2,
						color: k.WHITE,
						opacity,
					})
					k.drawRect({
						pos: k.vec2(-1, -coreSize),
						width: 2,
						height: coreSize * 2,
						color: k.WHITE,
						opacity,
					})
				}
			},
		},
		tags.gameLoop,
	])

	registerBatchedEntityUpdate("effects", effect, () => {
		effect.elapsed += k.dt()
		if (effect.elapsed >= EMP_DURATION) k.destroy(effect)
	})
	return effect
}
