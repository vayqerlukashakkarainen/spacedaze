import { GameObj, Vec2 } from "kaplay";
import {
	checkProjectileIntersection,
	clearGame,
	createExplosion,
	playerObj,
} from "../game";
import { k } from "../main";
import { starsEmitter } from "../particles";
import { tags } from "../tags";
import { randomExplosion } from "../util";
import { spawnDebree } from "./spawnDebree";
import { registerHitAnimation } from "../shared";

export function spawnHeavyVehicle(pos: Vec2, dir: Vec2, hp, sprite) {
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
			speed: k.rand(180, 240),
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

			if (p.tags.includes(tags.blaster)) {
				m.hurt(p.dmg);
				spawnDebree(m.pos, 1);
			} else if (p.tags.includes(tags.rocket)) {
				m.hurt(p.impactDmg);
				createExplosion(
					p.pos,
					p.splashSize,
					p.splashDmg,
					p.splashDmgFallof,
					p.splashDmgFallofDist
				);
				k.play(randomExplosion(), { volume: 0.6 });
				k.shake(3);
			}
		});

		if (playerObj.pos.dist(m.pos) < m.hb) {
			playerObj.hurt(1);
			m.hurt(hp);
		}
	});

	m.onDeath(() => {
		starsEmitter.emitter.position = m.pos;
		starsEmitter.emit(20);
		k.play(randomExplosion(), { volume: 0.6 });
		k.destroy(m);
	});

	m.onHurt(() => {
		k.play("hit1", { volume: 0.6 });
		m.animation.seek(0);
	});
}
