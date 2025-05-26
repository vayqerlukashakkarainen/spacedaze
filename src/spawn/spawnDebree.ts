import { debrees } from "../game";
import { k } from "../main";
import { tags } from "../tags";

export function spawnDebree(pos, am) {
	for (let i = 0; i < am; i++) {
		const debree = k.add([
			k.pos(pos),
			k.sprite("particle2"),
			k.animate({ relative: true }),
			tags.debree,
		]);

		debree.animate("angle", [0, k.rand(-360, 360)], {
			duration: 1,
			loops: 1,
			easing: k.easings.easeOutCubic,
		});
		debree.animate(
			"pos",
			[k.vec2(0, 0), k.vec2(k.rand(-20, 20), k.rand(-20, 20))],
			{
				duration: 1,
				loops: 1,
				easing: k.easings.easeOutCubic,
			}
		);

		debree.onAnimateFinished(() => {
			debree.animation.paused = true;
		});

		debrees.push(debree);
	}
}
