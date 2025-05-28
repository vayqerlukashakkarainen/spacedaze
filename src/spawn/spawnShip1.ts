import { Vec2 } from "kaplay";
import { checkProjectileComponentIntersection, createExplosion } from "../game";
import { k } from "../main";
import { trailEmitter } from "../particles";
import { shootBlaster } from "../projectiles/blaster";
import { tags } from "../tags";
import { randomExplosion } from "../util";

const components = {
	body: 1,
	leftWing: 2,
	rightWing: 3,
	blaster: 4,
};
import { Component, compose } from "../compose";
import { jitter } from "../comp/jitter";

const wingOffset = [6, 2];
export const unitComponents: Record<number, Component[]> = {};

export function spawnShip1(pos, dir: Vec2, am, hp, scale, speed) {
	const hb = 16 * scale;
	const m = k.add([
		k.pos(pos),
		k.sprite("enemy_ship1_body"),
		k.rotate(dir.angle() + 90),
		k.anchor("center"),
		k.health(hp),
		k.animate(),
		k.scale(scale),
		jitter(),
		k.offscreen({ destroy: true }),
		{
			vel: dir,
			speed: speed,
			hb,
		},
		tags.enemy,
		tags.unit,
	]);

	const wing1 = m.add([
		k.pos(k.vec2(-wingOffset[0], -wingOffset[1])),
		k.sprite("enemy_ship1_left_wing"),
		k.anchor("center"),
		k.health(Math.floor(hp / 2)),
		k.animate(),
		jitter(),
		tags.part,
	]);
	const wing2 = m.add([
		k.pos(k.vec2(wingOffset[0], -wingOffset[1])),
		k.sprite("enemy_ship1_right_wing"),
		k.anchor("center"),
		k.health(Math.floor(hp / 2)),
		k.animate(),
		jitter(),
		tags.part,
	]);

	unitComponents[m.id!] = compose({
		parts: [
			{ obj: m, hitbox: 8, isBody: true, scoreOnDestroy: am },
			{ obj: wing1, hitbox: 8, isBody: false, scoreOnDestroy: 2 },
			{ obj: wing2, hitbox: 8, isBody: false, scoreOnDestroy: 2 },
		],
	});

	m.onUpdate(() => {
		m.move(m.vel.scale(m.speed));

		checkProjectileComponentIntersection(
			m.pos,
			m.hb,
			tags.friendly,
			unitComponents[m.id!],
			(p, i) => {
				k.destroy(p);

				if (p.tags.includes(tags.blaster)) {
					unitComponents[m.id!][i].obj.hurt(p.dmg);
				} else if (p.tags.includes(tags.rocket)) {
					unitComponents[m.id!][i].obj.hurt(p.impactDmg);
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
			}
		);

		if (Math.floor(k.rand(0, 500)) == 10) {
			shootBlaster(m.pos, k.Vec2.fromAngle(m.angle - 90), m.angle, 2, 1, [
				tags.enemy,
				tags.blaster,
			]);
		}

		const dir = k.Vec2.fromAngle(m.angle - 90);
		const emitterPos = k.vec2(m.pos.x - 12 * dir.x, m.pos.y - 12 * dir.y);
		trailEmitter.emitter.position = emitterPos;
		trailEmitter.emitter.direction = k.Vec2.toAngle(dir);
		trailEmitter.emit(1);
	});
}
