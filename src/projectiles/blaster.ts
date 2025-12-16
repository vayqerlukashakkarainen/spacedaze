import { timescale } from "../comp/timescale";
import { createExplosion, projectiles } from "../game";
import { BULLET_SPEED, dt, dtScaled, k, mainSoundVolume } from "../main";
import { audioService } from "../services/audioService";
import { spawnFlash } from "../spawn/spawnFlash";
import { tags } from "../tags";
import type { Vec2 } from "kaplay";

export function shootBlaster(
	pos: Vec2,
	dir: Vec2,
	rot: number,
	dmg: number,
	speedMltp: number,
	attachTags: string[],
	playSound: boolean
) {
	const p = k.add([
		k.pos(pos),
		k.area(),
		k.rotate(rot),
		timescale(),
		k.offscreen({ destroy: true }),
		k.anchor("center"),
		k.sprite("bullet1"),
		{
			dmg,
			speed: BULLET_SPEED * speedMltp,
		},
		...[...attachTags, tags.gameLoopUi],
	]);

	p.onUpdate(() => {
		p.move(dir.scale(p.speed * dtScaled() * p.getTimescale()));
	});

	p.onDestroy(() => {
		const index = projectiles.findIndex((p2) => p2.id == p.id);

		projectiles.splice(index, 1);
		spawnFlash(p.pos, 5);
	});

	if (playSound) {
		audioService.playSound("shoot1", { volume: mainSoundVolume });
	}

	projectiles.push(p);
}
