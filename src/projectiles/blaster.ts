import { projectiles } from "../game";
import { BULLET_SPEED, k, mainSoundVolume } from "../main";
import { spawnFlash } from "../spawn/spawnFlash";
import { tags } from "../tags";

export function shootBlaster(
	pos,
	dir,
	rot,
	dmg,
	speedMltp,
	attachTags,
	playSound
) {
	const p = k.add([
		k.pos(pos),
		k.move(dir, BULLET_SPEED * speedMltp),
		k.area(),
		k.rotate(rot),
		k.offscreen({ destroy: true }),
		k.anchor("center"),
		k.sprite("bullet1"),
		{
			dmg,
		},
		...[...attachTags, tags.gameLoopUi],
	]);

	p.onDestroy(() => {
		const index = projectiles.findIndex((p2) => p2.id == p.id);

		projectiles.splice(index, 1);
		spawnFlash(p.pos, 0.2);
	});

	if (playSound) {
		k.play("shoot1", { volume: mainSoundVolume });
	}

	projectiles.push(p);
}
