import { timescale } from "../comp/timescale";
import { debrees } from "../game";
import { dt, k, velocityScale } from "../main";
import { tags } from "../tags";
import type { Vec2 } from "kaplay";

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

export function spawnDebree(pos: Vec2, amount: number) {
	spawnDebreeValues(pos, splitDebreeValue(amount));
}

export function spawnDebreeValues(pos: Vec2, values: DebreeValue[]) {
	for (const salvageValue of values) {
		const tier = debreeTiers[salvageValue];
		const d = k.add([
			k.pos(pos),
			k.sprite("particle2"),
			k.animate({ relative: true }),
			k.rotate(k.rand(360)),
			k.scale(tier.scale),
			k.color(...tier.color),
			k.opacity(1),
			{
				salvageValue,
				dir: k.rand(k.vec2(-1, -1), k.vec2(1, 1)),
				speed: k.rand(40, 60),
				lifeSpan: 0,
				collection: undefined as DebreeCollectionState | undefined,
			},
			tags.debree,
			tags.gameLoop,
		]);

		d.onUpdate(() => {
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
