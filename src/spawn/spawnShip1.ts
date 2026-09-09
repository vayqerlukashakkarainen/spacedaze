import { Vec2 } from "kaplay";
import { checkProjectileComponentIntersection, playerObj } from "../game";
import { k, velocityScale } from "../main";
import { emitEnemyTrail } from "../particles";
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
	ENEMY_THREAT_RANK,
	type EnemySpawnOptions,
} from "../services/threatService";
import { registerBatchedEntityUpdate } from "../services/entityUpdateService";
import {
	getEnemyNavigationDirection,
	hasEnemyLineOfSight,
	pickRandomWalkableEnemyRoute,
} from "../services/enemyNavigationService";
import {
	applyDirectionalSteeringLean,
	easeDirection,
} from "../shared";

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
		k.color(k.WHITE),
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
			route: [] as Vec2[],
			routeIndex: 0,
			nextRouteAt: 0,
			usesGridNavigation: false,
			hb,
			elite: profile.elite,
			damage: profile.damage,
			threatRank: ENEMY_THREAT_RANK.fighter,
		},
		tags.enemy,
		tags.unit,
		tags.enemyRolePressure,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	]);

	const wing1 = m.add([
		k.pos(k.vec2(-wingOffset[0], -wingOffset[1])),
		k.sprite("enemy_ship1_left_wing"),
		k.color(k.WHITE),
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
		k.color(k.WHITE),
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

	registerBatchedEntityUpdate("enemies", m, () => {
		const delta = k.dt() * m.getTimescale();
		if (m.routeIndex >= m.route.length && k.time() >= m.nextRouteAt) {
			const route = pickRandomWalkableEnemyRoute(m);
			if (route !== undefined) {
				m.route = route;
				m.routeIndex = 0;
				m.usesGridNavigation = true;
			}
			m.nextRouteAt = k.time() + (route && route.length > 0 ? 0.2 : 0.8);
		}
		const waypoint = m.route[m.routeIndex];
		if (waypoint) {
			const offset = waypoint.sub(m.pos);
			const maxStep = m.speed * velocityScale() * m.getTimescale() * k.dt();
			if (offset.len() <= Math.max(3, maxStep)) {
				m.pos = waypoint.clone();
				m.routeIndex++;
			} else {
				const desiredDirection = offset.unit();
				const easedDirection = easeDirection(
					m.vel,
					desiredDirection,
					4.6,
					delta
				);
				m.vel = getEnemyNavigationDirection(
					m,
					easedDirection,
					waypoint
				);
				m.angle = m.vel.angle() + 90;
				m.move(m.vel.scale(m.speed * velocityScale() * m.getTimescale()));
				applyDirectionalSteeringLean(
					m,
					m.vel,
					desiredDirection,
					profile.scale
				);
			}
		} else if (!m.usesGridNavigation) {
			m.move(m.vel.scale(m.speed * velocityScale() * m.getTimescale()));
		}

		checkProjectileComponentIntersection(
			m.pos,
			m.hb,
			tags.friendly,
			unitComponents[m.id!],
			(p, i) => {
				onEnemyHit(unitComponents[m.id!][i].obj, p);
			}
		);

		const fireRollRange = Math.max(
			1,
			Math.round(500 / (m.shieldFireRateMultiplier ?? 1))
		);
		if (
			Math.floor(k.rand(0, fireRollRange)) == 10 &&
			hasEnemyLineOfSight(m, playerObj.pos)
		) {
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
		emitEnemyTrail(
			m,
			emitterPos,
			k.Vec2.toAngle(dir)
		);
	});

	return m;
}
