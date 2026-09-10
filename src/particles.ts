import { GameObj, ParticlesComp, PosComp, Vec2 } from "kaplay";
import { k, layers } from "./main";
import {
	incrementPerformanceCounter,
	setPerformanceCounter,
} from "./services/debug/frameProfilerService";
import { tags } from "./tags";

export let trailEmitter: GameObj<PosComp | ParticlesComp>;
export let boostTrailEmitter: GameObj<PosComp | ParticlesComp>;
export let railgunTrailEmitter: GameObj<PosComp | ParticlesComp>;
export let starsEmitter: GameObj<PosComp | ParticlesComp>;
export let starsEmitterDir: GameObj<PosComp | ParticlesComp>;
export let explosionEmitter: GameObj<PosComp | ParticlesComp>;
export let debreeEmitter: GameObj<PosComp | ParticlesComp>;
export let debreeRocketEmitter: GameObj<PosComp | ParticlesComp>;
export let dustTrailEmitter: GameObj<PosComp | ParticlesComp>;
export let sparkEmitter: GameObj<PosComp | ParticlesComp>;
export let shineEmitter: GameObj<PosComp | ParticlesComp>;

interface ImpactChip {
	position: Vec2;
	velocity: Vec2;
	angle: number;
	angularVelocity: number;
	width: number;
	height: number;
	lifetime: number;
	elapsed: number;
	brightness: number;
}

interface UiEffects {
	shineEmitter: GameObj<PosComp | ParticlesComp>;
	explosionEmitter: GameObj<PosComp | ParticlesComp>;
}

let uiEffects: UiEffects | null = null;

const MAX_ENEMY_TRAIL_EMISSIONS_PER_FRAME = 24;
const ENEMY_EFFECT_VIEW_MARGIN = 72;
const MAX_IMPACT_CHIPS = 180;
const impactChips: ImpactChip[] = [];
let enemyEffectFrame = -1;
let enemyEffectCadence = 1;

export function emitEnemyTrail(
	enemy: GameObj,
	position: Vec2,
	direction: number,
	count = 1
) {
	refreshEnemyEffectBudget();
	incrementPerformanceCounter("enemyFxRequested");
	if (!isNearViewport(position)) {
		incrementPerformanceCounter("enemyFxCulled");
		return false;
	}
	if ((enemy.id + enemyEffectFrame) % enemyEffectCadence !== 0) {
		incrementPerformanceCounter("enemyFxBudgetSkipped");
		return false;
	}

	trailEmitter.emitter.position = position;
	trailEmitter.emitter.direction = direction;
	trailEmitter.emit(count);
	incrementPerformanceCounter("enemyFxEmitted");
	return true;
}

function refreshEnemyEffectBudget() {
	const frame = Math.floor(k.time() * 60);
	if (frame === enemyEffectFrame) return;
	enemyEffectFrame = frame;
	const enemyCount = k.get(tags.enemy).length;
	enemyEffectCadence = Math.max(
		1,
		Math.ceil(enemyCount / MAX_ENEMY_TRAIL_EMISSIONS_PER_FRAME)
	);
	setPerformanceCounter("enemyFxCrowd", enemyCount);
	setPerformanceCounter("enemyFxCadence", enemyEffectCadence);
}

function isNearViewport(position: Vec2) {
	const screenPosition = k.toScreen(position);
	return screenPosition.x >= -ENEMY_EFFECT_VIEW_MARGIN &&
		screenPosition.x <= k.width() + ENEMY_EFFECT_VIEW_MARGIN &&
		screenPosition.y >= -ENEMY_EFFECT_VIEW_MARGIN &&
		screenPosition.y <= k.height() + ENEMY_EFFECT_VIEW_MARGIN;
}

export function emitImpactChips(
	position: Vec2,
	targetPosition: Vec2,
	direction: Vec2,
	projectileSpeed: number,
	critical = false
) {
	if (!isNearViewport(position)) return false;
	const travelDirection = direction.len() > 0.001
		? direction.unit()
		: k.Vec2.fromAngle(k.rand(0, 360));
	const impactOffset = position.sub(targetPosition);
	const forwardOffset = travelDirection.scale(impactOffset.dot(travelDirection));
	const lateralOffset = impactOffset.sub(forwardOffset);
	const sideWeight = k.clamp(lateralOffset.len() / 8, 0, 1);
	const chipDirectionBase = lateralOffset.len() > 0.001
		? travelDirection.add(lateralOffset.unit().scale(sideWeight)).unit()
		: travelDirection;
	const spread = k.lerp(44, 28, sideWeight);
	const speed = Math.max(0, Math.abs(projectileSpeed));
	const count = critical ? 5 : 3;
	for (let index = 0; index < count; index++) {
		if (impactChips.length >= MAX_IMPACT_CHIPS) impactChips.shift();
		const chipDirection = k.Vec2.fromAngle(
			chipDirectionBase.angle() + k.rand(-spread, spread)
		);
		const launchSpeed = k.clamp(
			speed * k.rand(0.45, 0.85),
			110,
			520
		);
		impactChips.push({
			position: position.add(chipDirection.scale(k.rand(0, 2))),
			velocity: chipDirection.scale(launchSpeed),
			angle: k.rand(0, 360),
			angularVelocity: k.rand(-760, 760),
			width: k.rand() > 0.55 ? 2 : 1,
			height: k.rand() > 0.65 ? 3 : 2,
			lifetime: k.rand(0.2, critical ? 0.42 : 0.34),
			elapsed: 0,
			brightness: k.rand(0.58, 1),
		});
	}
	return true;
}

function updateImpactChips() {
	const delta = k.dt();
	const damping = Math.exp(-2.6 * delta);
	for (let index = impactChips.length - 1; index >= 0; index--) {
		const chip = impactChips[index];
		chip.elapsed += delta;
		if (chip.elapsed >= chip.lifetime) {
			impactChips.splice(index, 1);
			continue;
		}
		chip.position = chip.position.add(chip.velocity.scale(delta));
		chip.velocity = chip.velocity.scale(damping);
		chip.angle += chip.angularVelocity * delta;
	}
}

function drawImpactChips() {
	for (const chip of impactChips) {
		const progress = chip.elapsed / chip.lifetime;
		const fade = progress < 0.62 ? 1 : 1 - (progress - 0.62) / 0.38;
		const value = Math.round(255 * chip.brightness);
		k.drawRect({
			pos: chip.position,
			width: chip.width,
			height: chip.height,
			anchor: "center",
			angle: chip.angle,
			color: k.rgb(value, value, value),
			opacity: fade,
		});
	}
}

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
	k.add([
		k.pos(),
		{
			update: updateImpactChips,
			draw: drawImpactChips,
		},
		k.layer(layers.gameEffects),
		k.z(8),
	]);

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

	railgunTrailEmitter = k.add([
		k.pos(),
		k.particles(
			{
				max: 800,
				speed: [4, 38],
				lifeTime: [0.12, 0.38],
				colors: [k.rgb(255, 236, 120), k.rgb(255, 185, 30)],
				opacities: [0.95, 0.5],
				angle: [0, 360],
				damping: [2, 3],
				scales: [0.55, 0.25, 0.05],
				texture: k.getSprite("particle3")!.data!.frames[0].tex,
				quads: [k.getSprite("particle3")!.data!.frames[0].q],
			},
			{
				rate: 0,
				direction: 0,
				spread: 70,
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
