import { timescale } from "../comp/timescale";
import { debrees } from "../game";
import { dt, k, velocityScale } from "../main";
import { tags } from "../tags";
import type { Vec2 } from "kaplay";
import { registerBatchedEntityUpdate } from "../services/entityUpdateService";
import {
	addLocalLight,
	updateLocalLight,
} from "../services/localLightService";

export interface DebreeCollectionState {
	elapsed: number;
	duration: number;
	startPos: Vec2;
	approachDir: Vec2;
	startAngle: number;
	startScale: number;
	spin: number;
}

export type DebreeValue = 1 | 2 | 3 | 4 | 5;

export interface DebreeSpawnOptions {
	pattern?: "random" | "radial";
	minSpeed?: number;
	maxSpeed?: number;
}

const debreeTiers: Record<
	DebreeValue,
	{ color: [number, number, number]; scale: number; weight: number }
> = {
	1: { color: [255, 255, 255], scale: 0.7, weight: 16 },
	2: { color: [70, 180, 255], scale: 0.825, weight: 8 },
	3: { color: [255, 225, 70], scale: 0.95, weight: 4 },
	4: { color: [255, 135, 35], scale: 1.075, weight: 2 },
	5: { color: [190, 75, 255], scale: 1.2, weight: 1 },
};

export function spawnDebree(
	pos: Vec2,
	amount: number,
	options: DebreeSpawnOptions = {}
) {
	spawnDebreeValues(pos, splitDebreeValue(amount), options);
}

export function spawnDebreeValues(
	pos: Vec2,
	values: DebreeValue[],
	options: DebreeSpawnOptions = {}
) {
	const minSpeed = options.minSpeed ?? 40;
	const maxSpeed = Math.max(minSpeed, options.maxSpeed ?? 60);
	const radialStartAngle = k.rand(0, 360);
	const angleStep = values.length > 0 ? 360 / values.length : 0;
	for (let index = 0; index < values.length; index++) {
		const salvageValue = values[index];
		const tier = debreeTiers[salvageValue];
		const dir = options.pattern === "radial"
			? k.Vec2.fromAngle(
				radialStartAngle + angleStep * index + k.rand(-angleStep * 0.18, angleStep * 0.18)
			)
			: k.rand(k.vec2(-1, -1), k.vec2(1, 1));
		const d = k.add([
			k.pos(pos.add(dir.scale(options.pattern === "radial" ? k.rand(2, 8) : 0))),
			k.sprite("particle2"),
			k.anchor("center"),
			k.animate({ relative: true }),
			k.rotate(k.rand(360)),
			k.scale(tier.scale),
			k.color(...tier.color),
			k.opacity(1),
			{
				salvageValue,
				dir,
				speed: k.rand(minSpeed, maxSpeed),
				lifeSpan: 0,
				collection: undefined as DebreeCollectionState | undefined,
			},
			tags.debree,
			tags.gameLoop,
		]);
		const rareGlow = salvageValue === 5
			? addLocalLight(d, {
				size: 32,
				color: [190, 75, 255],
				opacity: 0.68,
				z: -2,
				pulse: {
					scaleMin: 0.9,
					scaleMax: 1.12,
					scaleSpeed: 3.4,
					opacityMin: 0.52,
					opacityMax: 0.76,
					opacitySpeed: 2.8,
				},
			})
			: undefined;
		if (salvageValue === 5) addRareDebreeParticles(d);

		registerBatchedEntityUpdate("debris", d, () => {
			if (rareGlow) updateLocalLight(rareGlow);
			if (d.collection) return;
			if (d.lifeSpan > d.speed) {
				return;
			}
			d.move(
				k
					.vec2(
						d.dir.x * (d.speed - d.lifeSpan),
						d.dir.y * (d.speed - d.lifeSpan)
					)
					.scale(velocityScale())
			);

			d.lifeSpan += dt() * 45;
		});

		d.animate("opacity", [1, 0.5], {
			duration: 1,
		});

		debrees.push(d);
		d.onDestroy(() => {
			const index = debrees.findIndex((debris) => debris.id === d.id);
			if (index >= 0) debrees.splice(index, 1);
		});
	}
}

function addRareDebreeParticles(debris: ReturnType<typeof k.add>) {
	debris.add([
		k.pos(),
		k.z(-1),
		k.particles(
			{
				max: 18,
				speed: [4, 11],
				angle: [0, 360],
				lifeTime: [0.6, 1.15],
				colors: [k.rgb(175, 175, 175), k.WHITE],
				opacities: [0, 0.9, 0],
				scales: [0.15, 0.65, 0],
				angularVelocity: [-90, 90],
				texture: k.getSprite("particle4")!.data!.frames[0].tex,
				quads: [k.getSprite("particle4")!.data!.frames[0].q],
			},
			{
				rate: 4,
				direction: -90,
				spread: 360,
				position: k.vec2(),
			}
		),
	]);
}

function splitDebreeValue(amount: number): DebreeValue[] {
	let remaining = Math.max(0, Math.round(amount));
	const values: DebreeValue[] = [];

	while (remaining > 0) {
		const available = ([1, 2, 3, 4, 5] as DebreeValue[]).filter(
			(value) => value <= remaining
		);
		const totalWeight = available.reduce(
			(total, value) => total + debreeTiers[value].weight,
			0
		);
		let roll = k.rand(0, totalWeight);
		let selected = available[0];
		for (const value of available) {
			roll -= debreeTiers[value].weight;
			if (roll > 0) continue;
			selected = value;
			break;
		}

		values.push(selected);
		remaining -= selected;
	}

	return values;
}
