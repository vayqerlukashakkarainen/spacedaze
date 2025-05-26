import { Vec2 } from "kaplay";
import {
	checkProjectileIntersection,
	clearGame,
	createExplosion,
	playerObj,
} from "../game";
import { k } from "../main";
import { starsEmitter, trailEmitter } from "../particles";
import { shootBlaster } from "../projectiles/blaster";
import { registerHitAnimation } from "../shared";
import { tags } from "../tags";
import { randomExplosion } from "../util";
import { spawnDebree } from "./spawnDebree";

export function spawnShip1(pos, dir: Vec2, am, hp, scale) {
	const hb = 12 * scale;
	const m = k.add([
		k.pos(pos),
		k.sprite("enemy_ship1"),
		k.rotate(dir.angle() - 90),
		k.anchor("center"),
		k.health(hp),
		k.animate(),
		k.scale(scale),
		k.offscreen({ destroy: true }),
		{
			vel: dir,
			speed: k.rand(40, 60),
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

		if (Math.floor(k.rand(0, 500)) == 10) {
			shootBlaster(m.pos, k.Vec2.fromAngle(m.angle + 90), m.angle, 2, 1, [
				tags.enemy,
				tags.blaster,
			]);
		}

		const dir = k.Vec2.fromAngle(m.angle + 90);
		const emitterPos = k.vec2(m.pos.x - 12 * dir.x, m.pos.y - 12 * dir.y);
		trailEmitter.emitter.position = emitterPos;
		trailEmitter.emitter.direction = k.Vec2.toAngle(dir);
		trailEmitter.emit(1);
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
