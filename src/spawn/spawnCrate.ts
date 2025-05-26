import {
	checkProjectileIntersection,
	createExplosion,
	playerObj,
} from "../game";
import { k } from "../main";
import { debreeEmitter } from "../particles";
import { registerHitAnimation } from "../shared";
import { tags } from "../tags";
import { randomExplosion } from "../util";
import { spawnDebree } from "./spawnDebree";

export function spawnCrate(pos, am, hp) {
	const m = k.add([
		k.pos(pos),
		k.sprite("crate1"),
		k.rotate(0),
		k.anchor("center"),
		k.health(hp),
		k.animate(),
		k.offscreen({ destroy: true }),
		{
			vel: k.Vec2.fromAngle(k.rand(0, 360)),
			rotVel: k.rand(-4, 4),
			speed: k.rand(20, 60),
			hitAngle: 0,
		},
		tags.enemy,
		tags.unit,
	]);

	registerHitAnimation(m);

	m.onUpdate(() => {
		m.move(m.vel.scale(m.speed));
		m.angle += m.rotVel;

		checkProjectileIntersection(m.pos, 12, tags.friendly, (p) => {
			k.destroy(p);

			m.hitAngle = p.angle;
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

		if (playerObj.pos.dist(m.pos) < 16) {
			m.hurt(hp);
		}
	});

	m.onDeath(() => {
		spawnDebree(m.pos, am);
		debreeEmitter.emitter.position = m.pos;
		debreeEmitter.emitter.direction = m.hitAngle - 90;
		debreeEmitter.emit(6);
		k.play("explosion4", { volume: 0.3 });
		k.destroy(m);
	});

	m.onHurt(() => {
		k.play("hit2", { volume: 0.4 });
		m.animation.seek(0);
	});
}
