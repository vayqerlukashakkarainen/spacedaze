import {
	checkProjectileIntersection,
	clearGame,
	createExplosion,
	playerObj,
} from "../game";
import { k } from "../main";
import { debreeRocketEmitter, sparkEmitter, starsEmitter } from "../particles";
import { registerHitAnimation } from "../shared";
import { tags } from "../tags";
import { randomExplosion } from "../util";
import { spawnDebree } from "./spawnDebree";

export function spawnMeteorite(pos, dir, am, hp, speed) {
	const initScale = k.rand(1, 2);
	const hb = 12 * initScale;
	const m = k.add([
		k.pos(pos),
		k.sprite("asteroid1"),
		k.rotate(0),
		k.anchor("center"),
		k.scale(k.rand(1, 2)),
		k.health(hp),
		k.animate(),
		k.offscreen({ destroy: true }),
		{
			vel: dir,
			rotVel: k.rand(-4, 4),
			speed: speed,
			initScale,
			hb,
		},
		tags.enemy,
		tags.unit,
	]);

	registerHitAnimation(m);

	m.onUpdate(() => {
		m.move(m.vel.scale(m.speed));
		m.angle += m.rotVel;

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
				debreeRocketEmitter.emitter.position = m.pos;
				debreeRocketEmitter.emitter.direction = p.angle - 90;
				debreeRocketEmitter.emit(6);
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
		spawnDebree(m.pos, am);
		k.play(randomExplosion(), { volume: 0.6 });
		k.destroy(m);
	});

	m.onHurt(() => {
		k.play("hit1", { volume: 0.6 });
		m.animation.seek(0);
	});
}
