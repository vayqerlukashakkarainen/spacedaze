import { GameObj, ParticlesComp, PosComp } from "kaplay";
import { k, layers } from "./main";
import { tags } from "./tags";

export let trailEmitter: GameObj<PosComp | ParticlesComp>;
export let boostTrailEmitter: GameObj<PosComp | ParticlesComp>;
export let starsEmitter: GameObj<PosComp | ParticlesComp>;
export let starsEmitterDir: GameObj<PosComp | ParticlesComp>;
export let explosionEmitter: GameObj<PosComp | ParticlesComp>;
export let debreeEmitter: GameObj<PosComp | ParticlesComp>;
export let debreeRocketEmitter: GameObj<PosComp | ParticlesComp>;
export let dustTrailEmitter: GameObj<PosComp | ParticlesComp>;
export let sparkEmitter: GameObj<PosComp | ParticlesComp>;
export let shineEmitter: GameObj<PosComp | ParticlesComp>;

interface UiEffects {
	shineEmitter: GameObj<PosComp | ParticlesComp>;
	explosionEmitter: GameObj<PosComp | ParticlesComp>;
}

let uiEffects: UiEffects | null = null;

export function getUiEffects() {
	if (!uiEffects) {
		throw new Error("UI Effects not initialized");
	}
	return uiEffects;
}

export function initUiEffects() {
	uiEffects = {
		shineEmitter: k.add([
			k.pos(),
			k.layer(layers.uiEffects),
			k.particles(
				{
					max: 500,
					speed: [100, 200],
					angle: [0, 360],
					lifeTime: [0.3, 2.5],
					colors: [k.rgb(255, 255, 255)],
					opacities: [0.6, 1, 0.8],
					scales: [0.1, 5, 4],
					damping: [3, 5],
					texture: k.getSprite("particle4")!.data!.frames[0].tex,
					quads: [k.getSprite("particle4")!.data!.frames[0].q],
				},
				{
					rate: 0,
					direction: 0,
					spread: 360,
					position: k.vec2(),
				}
			),
		]),

		explosionEmitter: k.add([
			k.pos(),
			k.particles(
				{
					max: 1000,
					speed: [30, 80],
					angle: [0, 360],
					lifeTime: [0.5, 1.2],
					colors: [k.rgb(255, 255, 255)],
					opacities: [0.8, 0.5],
					scales: [0.4, 2, 1.2, 0.4, 0.1],
					damping: [1, 2],
					texture: k.getSprite("particle3")!.data!.frames[0].tex,
					quads: [k.getSprite("particle3")!.data!.frames[0].q],
				},
				{
					rate: 0,
					direction: -90,
					spread: 360,
					position: k.vec2(),
				}
			),

			k.layer(layers.uiEffects),
		]),
	};
}

export function initParticles() {
	trailEmitter = k.add([
		k.pos(),
		k.particles(
			{
				max: 2000,
				speed: [2, 30],
				lifeTime: [0.2, 0.6],
				colors: [k.WHITE],
				opacities: [0.8, 0.6],
				angle: [0, 360],
				damping: [2, 2],
				scales: [0.4, 0.2, 0.1],
				texture: k.getSprite("particle3")!.data!.frames[0].tex,
				quads: [k.getSprite("particle3")!.data!.frames[0].q],
			},
			{
				rate: 0,
				direction: 0,
				spread: 90,
				position: k.vec2(0, 0),
			}
		),
		"trail",
	]);

	boostTrailEmitter = k.add([
		k.pos(),
		k.particles(
			{
				max: 2000,
				speed: [2, 30],
				lifeTime: [0.2, 0.6],
				colors: [k.rgb(80, 180, 255), k.rgb(30, 100, 255)],
				opacities: [0.9, 0.6],
				angle: [0, 360],
				damping: [2, 2],
				scales: [0.4, 0.2, 0.1],
				texture: k.getSprite("particle3")!.data!.frames[0].tex,
				quads: [k.getSprite("particle3")!.data!.frames[0].q],
			},
			{
				rate: 0,
				direction: 0,
				spread: 90,
				position: k.vec2(0, 0),
			}
		),
		"trail",
	]);

	starsEmitter = k.add([
		k.pos(),
		k.particles(
			{
				max: 1000,
				speed: [10, 40],
				angle: [0, 360],
				lifeTime: [1, 1.5],
				colors: [k.rgb(255, 255, 255)],
				opacities: [1, 0.5],
				scales: [1.4, 1, 0.4, 0.1],
				damping: [0, 0.5],
				angularVelocity: [-90, 90],
				texture: k.getSprite("particle1")!.data!.frames[0].tex,
				quads: [k.getSprite("particle1")!.data!.frames[0].q],
			},
			{
				rate: 0,
				direction: -90,
				spread: 360,
				position: k.vec2(),
			}
		),
	]);

	starsEmitterDir = k.add([
		k.pos(),
		k.particles(
			{
				max: 1000,
				speed: [200, 300],
				angle: [0, 360],
				lifeTime: [1, 1.5],
				colors: [k.rgb(255, 255, 255)],
				opacities: [1, 0.5],
				scales: [1.4, 1, 0.4, 0.1],
				damping: [0, 0.5],
				angularVelocity: [-90, 90],
				texture: k.getSprite("particle1")!.data!.frames[0].tex,
				quads: [k.getSprite("particle1")!.data!.frames[0].q],
			},
			{
				rate: 0,
				direction: -90,
				spread: 40,
				position: k.vec2(),
			}
		),
	]);

	sparkEmitter = k.add([
		k.pos(),
		k.particles(
			{
				max: 1000,
				speed: [100, 150],
				lifeTime: [1, 1.5],
				angle: [0, 360],
				colors: [k.rgb(255, 255, 255)],
				opacities: [1, 0.5],
				damping: [0, 0.5],
				texture: k.getSprite("particle4")!.data!.frames[0].tex,
				quads: [k.getSprite("particle4")!.data!.frames[0].q],
			},
			{
				rate: 0,
				direction: -90,
				spread: 40,
				position: k.vec2(),
			}
		),
	]);

	dustTrailEmitter = k.add([
		k.pos(),
		k.particles(
			{
				max: 1000,
				speed: [10, 40],
				lifeTime: [1, 1.5],
				colors: [k.rgb(255, 255, 255)],
				opacities: [1, 0.5],
				scales: [1, 0.4, 0.1],
				acceleration: [k.vec2(0, 1), k.vec2(0, 2)],
				angularVelocity: [-90, 90],
				texture: k.getSprite("particle1")!.data!.frames[0].tex,
				quads: [k.getSprite("particle1")!.data!.frames[0].q],
			},
			{
				rate: 0,
				direction: -90,
				spread: 0,
				position: k.vec2(),
			}
		),
	]);

	debreeEmitter = k.add([
		k.pos(),
		k.particles(
			{
				max: 1000,
				speed: [5, 40],
				angle: [0, 360],
				lifeTime: [1, 2],
				colors: [k.rgb(255, 255, 255)],
				opacities: [0.7, 0.4],
				angularVelocity: [-90, 90],
				scales: [1, 0.8, 0],
				texture: k.getSprite("debree_part1")!.data!.frames[0].tex,
				quads: [k.getSprite("debree_part1")!.data!.frames[0].q],
			},
			{
				rate: 0,
				direction: -90,
				spread: 360,
				position: k.vec2(),
			}
		),
	]);

	debreeRocketEmitter = k.add([
		k.pos(),
		k.particles(
			{
				max: 1000,
				speed: [60, 80],
				angle: [0, 360],
				lifeTime: [1, 2],
				colors: [k.rgb(255, 255, 255)],
				angularVelocity: [-90, 90],
				scales: [1, 0.8, 0.2, 0],
				texture: k.getSprite("debree_part1")!.data!.frames[0].tex,
				quads: [k.getSprite("debree_part1")!.data!.frames[0].q],
			},
			{
				rate: 0,
				direction: -90,
				spread: 55,
				position: k.vec2(),
			}
		),
	]);

	explosionEmitter = k.add([
		k.pos(),
		k.particles(
			{
				max: 1000,
				speed: [30, 80],
				angle: [0, 360],
				lifeTime: [0.5, 1.2],
				colors: [k.rgb(255, 255, 255)],
				opacities: [0.8, 0.5],
				scales: [0.4, 2, 1.2, 0.4, 0.1],
				damping: [1, 2],
				texture: k.getSprite("particle3")!.data!.frames[0].tex,
				quads: [k.getSprite("particle3")!.data!.frames[0].q],
			},
			{
				rate: 0,
				direction: -90,
				spread: 360,
				position: k.vec2(),
			}
		),
	]);
}
