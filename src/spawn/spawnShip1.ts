import { Vec2 } from "kaplay";
import { checkProjectileComponentIntersection } from "../game";
import { k, velocityScale } from "../main";
import { trailEmitter } from "../particles";
import { spawnEnemyBlaster } from "../services/projectileHelpers";
import { tags } from "../tags";

const components = {
	body: 1,
	leftWing: 2,
	rightWing: 3,
	blaster: 4,
};
import { Component, compose } from "../compose";
import { jitter } from "../comp/jitter";
import { onEnemyHit } from "./enemyShared";
import { timescale } from "../comp/timescale";
import {
	createEnemySpawnProfile,
	type EnemySpawnOptions,
} from "../services/threatService";

const wingOffset = [6, 2];
export const unitComponents: Record<number, Component[]> = {};

export function spawnShip1(
	pos: Vec2,
	dir: Vec2,
	am: number,
	hp: number,
	scale: number,
	speed: number,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 1, scale, options);
	const hb = 16 * profile.scale;
	const m = k.add([
		k.pos(pos),
		k.sprite("enemy_ship1_body"),
		k.color(...profile.tint),
		k.rotate(dir.angle() + 90),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		k.scale(profile.scale),
		timescale(),
		jitter(),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			vel: dir,
			speed: speed * profile.speedMultiplier,
			hb,
			elite: profile.elite,
			damage: profile.damage,
		},
		tags.enemy,
		tags.unit,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	]);

	const wing1 = m.add([
		k.pos(k.vec2(-wingOffset[0], -wingOffset[1])),
		k.sprite("enemy_ship1_left_wing"),
		k.color(...profile.tint),
		k.anchor("center"),
		k.health(Math.floor(profile.hp / 2)),
		k.animate(),
		k.rotate(0),
		timescale(),
		jitter(),
		tags.part,
		tags.gameLoop,
	]);
	const wing2 = m.add([
		k.pos(k.vec2(wingOffset[0], -wingOffset[1])),
		k.sprite("enemy_ship1_right_wing"),
		k.color(...profile.tint),
		k.anchor("center"),
		k.health(Math.floor(profile.hp / 2)),
		k.animate(),
		k.rotate(0),
		timescale(),
		jitter(),
		tags.part,
		tags.gameLoop,
	]);

	unitComponents[m.id!] = compose({
		rewardMultiplier: profile.rewardMultiplier,
		parts: [
			{
				obj: m,
				hitbox: 8,
				isBody: true,
				scoreOnDestroy: am * profile.rewardMultiplier,
			},
			{ obj: wing1, hitbox: 8, isBody: false, scoreOnDestroy: 0 },
			{ obj: wing2, hitbox: 8, isBody: false, scoreOnDestroy: 0 },
		],
	});

	m.onUpdate(() => {
		m.move(m.vel.scale(m.speed * velocityScale() * m.getTimescale()));

		checkProjectileComponentIntersection(
			m.pos,
			m.hb,
			tags.friendly,
			unitComponents[m.id!],
			(p, i) => {
				onEnemyHit(unitComponents[m.id!][i].obj, p);
			}
		);

		if (Math.floor(k.rand(0, 500)) == 10) {
			spawnEnemyBlaster(
				m.pos,
				k.Vec2.fromAngle(m.angle - 90),
				m.angle,
				m.damage,
				{
					name: profile.elite ? "ELITE FIGHTER" : "FIGHTER",
					sprite: "enemy_ship1_body",
				}
			);
		}

		const dir = k.Vec2.fromAngle(m.angle - 90);
		const emitterPos = k.vec2(m.pos.x - 12 * dir.x, m.pos.y - 12 * dir.y);
		trailEmitter.emitter.position = emitterPos;
		trailEmitter.emitter.direction = k.Vec2.toAngle(dir);
		trailEmitter.emit(1);
	});
}
