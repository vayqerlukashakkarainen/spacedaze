import type { Vec2 } from "kaplay"
import { k, layers } from "../main"
import { tags as gameTags } from "../tags"

interface CurrencyBurstOptions {
	particleCount?: number
	fixed?: boolean
	tags?: string[]
}

export function spawnCurrencyBurst(
	pos: Vec2,
	options: CurrencyBurstOptions = {}
) {
	const particleCount = Math.max(1, Math.round(options.particleCount ?? 96))
	const fixed = options.fixed === true
	const burst = k.add([
		k.pos(pos),
		...(fixed ? [k.fixed()] : []),
		k.layer(fixed ? layers.uiEffects : layers.gameEffects),
		k.opacity(1),
		k.lifespan(4),
		k.particles(
			{
				max: Math.max(128, particleCount),
				speed: [150, 340],
				acceleration: [k.vec2(-18, 100), k.vec2(18, 230)],
				lifeTime: [1.8, 3.2],
				angle: [0, 360],
				angularVelocity: [-260, 260],
				colors: [k.WHITE],
				opacities: [1, 1, 0.8, 0],
				scales: [2.6, 2, 1.1, 0.2],
				texture: k.getSprite("particle4")!.data!.frames[0].tex,
				quads: [k.getSprite("particle4")!.data!.frames[0].q],
			},
			{
				rate: 0,
				direction: -90,
				spread: 360,
				position: k.vec2(0, 0),
			}
		),
		...(fixed ? [] : [gameTags.gameLoop]),
		...(options.tags ?? []),
	])
	burst.emit(particleCount)
	return burst
}

export function purchaseBurstParticleCount(price: number) {
	return 16 + Math.round(Math.max(0, price) * 0.65)
}
