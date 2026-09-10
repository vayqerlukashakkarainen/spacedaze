import type { GameObj, Vec2 } from "kaplay"
import { k, layers } from "../../main"
import { tags } from "../../tags"

const ROCK_FRAGMENT_SPRITES = [
	{ name: "rock_fragment_32_a", size: 32 },
	{ name: "rock_fragment_32_b", size: 32 },
	{ name: "rock_fragment_32_c", size: 32 },
	{ name: "rock_fragment_16_a", size: 16 },
	{ name: "rock_fragment_16_b", size: 16 },
	{ name: "rock_fragment_16_c", size: 16 },
] as const
const MIN_FRAGMENT_COUNT = 5
const MAX_FRAGMENT_COUNT = 9

let rockFragmentEmitters: GameObj[] = []
let rockPartDustEmitter: GameObj | undefined

export function spawnRockDestructionFragments(
	position: Vec2,
	intensity: number = 1
) {
	const emitters = getRockFragmentEmitters()
	if (emitters.length === 0) return
	const normalizedIntensity = k.clamp((intensity - 0.35) / 1.1, 0, 1)
	const fragmentCount = Math.round(k.lerp(
		MIN_FRAGMENT_COUNT,
		MAX_FRAGMENT_COUNT,
		normalizedIntensity
	))
	for (let index = 0; index < fragmentCount; index++) {
		const emitter = emitters[Math.floor(k.rand(0, emitters.length))]
		emitter.emitter.position = position.clone()
		emitter.emit(1)
	}
}

export function spawnRockPartDestructionDust(position: Vec2) {
	const emitter = getRockPartDustEmitter()
	emitter.emitter.position = position.clone()
	emitter.emit(18)
}

function getRockFragmentEmitters() {
	if (
		rockFragmentEmitters.length === ROCK_FRAGMENT_SPRITES.length &&
		rockFragmentEmitters.every((emitter) => emitter.exists())
	) return rockFragmentEmitters
	rockFragmentEmitters = []
	for (const fragment of ROCK_FRAGMENT_SPRITES) {
		const sprite = k.getSprite(fragment.name)
		const frame = sprite?.data?.frames[0]
		if (!frame) continue
		const startScale = fragment.size === 32 ? 0.425 : 0.5
		rockFragmentEmitters.push(k.add([
			k.pos(),
			k.particles(
				{
					max: 32,
					speed: [18, 38],
					angle: [0, 360],
					lifeTime: [5, 10],
					colors: [k.WHITE, k.rgb(105, 115, 124)],
					opacities: [0.95, 0.86, 0],
					scales: [startScale, startScale * 0.82, startScale * 0.3],
					angularVelocity: [-105, 105],
					damping: [0.72, 1.15],
					texture: frame.tex,
					quads: [frame.q],
				},
				{
					rate: 0,
					direction: -90,
					spread: 360,
					position: k.vec2(),
				}
			),
			k.layer(layers.gameEffects),
			k.z(1),
			tags.gameLoop,
		]))
	}
	return rockFragmentEmitters
}

function getRockPartDustEmitter() {
	if (rockPartDustEmitter?.exists()) return rockPartDustEmitter
	const frame = k.getSprite("particle1")!.data!.frames[0]
	rockPartDustEmitter = k.add([
		k.pos(),
		k.particles(
			{
				max: 240,
				speed: [8, 30],
				angle: [0, 360],
				lifeTime: [0.7, 1.45],
				colors: [k.WHITE, k.rgb(108, 116, 122)],
				opacities: [0.72, 0.42, 0],
				scales: [0.72, 0.45, 0.08],
				angularVelocity: [-120, 120],
				damping: [0.8, 1.6],
				texture: frame.tex,
				quads: [frame.q],
			},
			{
				rate: 0,
				direction: -90,
				spread: 360,
				position: k.vec2(),
			}
		),
		k.layer(layers.gameEffects),
		k.z(1),
		tags.gameLoop,
	])
	return rockPartDustEmitter
}
