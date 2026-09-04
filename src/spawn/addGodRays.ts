import type { GameObj } from "kaplay"
import { k } from "../main"

interface GodRayProps {
	innerRadius: number
	outerRadius: number
	rayCount?: number
	opacity?: number
}

export function addGodRays(parent: GameObj, props: GodRayProps) {
	const rayCount = props.rayCount ?? 10
	return parent.add([
		k.pos(0, 0),
		k.rotate(k.rand(0, 360)),
		k.opacity(props.opacity ?? 0.68),
		k.z(-2),
		{
			draw() {
				const pulse = k.wave(0.9, 1.1, k.time() * 3.2)
				k.drawCircle({
					pos: k.vec2(0, 0),
					radius: props.innerRadius * 1.4 * pulse,
					color: k.WHITE,
					opacity: 0.1 * this.opacity,
					anchor: "center",
				})
				for (let index = 0; index < rayCount; index++) {
					const angle = index * (360 / rayCount)
					const halfWidth = index % 2 === 0 ? 5 : 2.5
					const length = props.outerRadius * (index % 2 === 0 ? 1 : 0.72)
					k.drawPolygon({
						pts: [
							k.Vec2.fromAngle(angle - halfWidth).scale(props.innerRadius),
							k.Vec2.fromAngle(angle).scale(length * pulse),
							k.Vec2.fromAngle(angle + halfWidth).scale(props.innerRadius),
						],
						color: k.WHITE,
						opacity: (index % 2 === 0 ? 0.42 : 0.24) * this.opacity,
						opacities: [0.9, 0.08, 0.9],
					})
				}
			},
		},
	])
}
