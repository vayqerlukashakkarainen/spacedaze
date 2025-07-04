import { GameObj, Vec2 } from "kaplay";
import {
	checkProjectileIntersection,
	createExplosion,
	playerObj,
} from "../game";
import { k, mainSoundVolume, subSoundVolume } from "../main";
import { starsEmitterDir } from "../particles";
import { tags } from "../tags";
import { randomExplosion } from "../util";
import { spawnDebree } from "./spawnDebree";
import { registerHitAnimation } from "../shared";
import { onEnemyHit } from "./enemyShared";

export function spawnGenericVehicle(
	addTo: GameObj<{ killed: number }>,
	pos: Vec2,
	dir: Vec2,
	hp,
	sprite
) {
	const hb = 12;
	const m = k.add([
		k.pos(pos),
		k.sprite(sprite),
		k.rotate(dir.angle() - 90),
		k.anchor("center"),
		k.health(hp),
		k.animate(),
		k.offscreen({ destroy: true }),
		{
			vel: dir,
			speed: k.rand(300, 340),
			hb,
		},
		tags.enemy,
		tags.unit,
	]);

	registerHitAnimation(m);

	m.onUpdate(() => {
		m.move(m.vel.scale(m.speed));

		checkProjectileIntersection(m.pos, m.hb, tags.friendly, (p) => {
			k.destroy(p);

			onEnemyHit(m, p);
		});

		if (playerObj.pos.dist(m.pos) < m.hb) {
			playerObj.hurt(1);
			m.hurt(hp);
		}
	});

	m.onDeath(() => {
		starsEmitterDir.emitter.position = m.pos;
		starsEmitterDir.emitter.direction = m.angle + 90;

		starsEmitterDir.emit(20);
		k.play(randomExplosion(), { volume: subSoundVolume });
		k.destroy(m);

		addTo.killed += 1;
	});

	m.onHurt(() => {
		k.play("hit1", { volume: mainSoundVolume });
		m.animation.seek(0);
	});
}
