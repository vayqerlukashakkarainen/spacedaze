import { debrees } from "../game";
import { k } from "../main";
import { tags } from "../tags";

export function spawnDebree(pos, am) {
	for (let i = 0; i < am; i++) {
		const d = k.add([
			k.pos(pos),
			k.sprite("particle2"),
			k.animate({ relative: true }),
			k.rotate(k.rand(360)),
			k.opacity(1),
			{
				dir: k.rand(k.vec2(-1, -1), k.vec2(1, 1)),
				speed: k.rand(40, 60),
				lifeSpan: 0,
			},
			tags.debree,
		]);

		d.onUpdate(() => {
			if (d.lifeSpan > d.speed) {
				return;
			}
			d.move(
				d.dir.x * (d.speed - d.lifeSpan),
				d.dir.y * (d.speed - d.lifeSpan)
			);

			d.lifeSpan += k.dt() * 45;
		});

		d.animate("opacity", [1, 0.5], {
			duration: 1,
		});

		debrees.push(d);
	}
}
