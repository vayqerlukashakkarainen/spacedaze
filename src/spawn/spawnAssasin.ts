import { checkProjectileComponentIntersection, playerObj } from "../game";
import { k, timeScale } from "../main";
import { compose, unitComponents } from "../compose";
import { spawnEnemyBlaster } from "../services/combat/projectileHelpers";
import {
	lerpAngleBetweenPos,
	steerMoveRotateAndLean,
} from "../shared";
import { tags } from "../tags";
import {
	HUNTER_VISUALS,
	type HunterVisualId,
} from "../visuals/enemyVisualCatalog";
import { enemyOnDeath, onEnemyHit } from "./enemyShared";
import type { Vec2 } from "kaplay";
import { timescale } from "../comp/timescale";
import { jitter } from "../comp/jitter";
import {
	createEnemySpawnProfile,
	ENEMY_THREAT_RANK,
	getThreatSnapshot,
	type EnemySpawnOptions,
} from "../services/enemies/threatService";
import { registerBatchedEntityUpdate } from "../services/core/entityUpdateService";
import { setHitSoundProfile } from "../services/audio/hitSoundService";
import {
	getEnemyNavigationTarget,
	hasEnemyLineOfSight,
} from "../services/enemies/enemyNavigationService";

export type HunterChassisId = HunterVisualId;

export interface AssassinSpawnOptions extends EnemySpawnOptions {
	hunterChassis?: HunterChassisId;
}

interface HunterChassisDefinition {
	weight: number;
	minimumPressure: number;
	healthMultiplier: number;
	damageMultiplier: number;
	speedMultiplier: number;
	turnMultiplier: number;
	fireRateMultiplier: number;
	attackRange: number;
}

export const HUNTER_CHASSIS: Record<HunterChassisId, HunterChassisDefinition> = {
	standard: {
		weight: 55, minimumPressure: 1,
		healthMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1,
		turnMultiplier: 1, fireRateMultiplier: 1, attackRange: 200,
	},
	talon: {
		weight: 15, minimumPressure: 3,
		healthMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1,
		turnMultiplier: 1.15, fireRateMultiplier: 1.1, attackRange: 200,
	},
	carapace: {
		weight: 8, minimumPressure: 4,
		healthMultiplier: 1.35, damageMultiplier: 1.1, speedMultiplier: 1,
		turnMultiplier: 1, fireRateMultiplier: 1, attackRange: 200,
	},
	needle: {
		weight: 22, minimumPressure: 2,
		healthMultiplier: 1, damageMultiplier: 1, speedMultiplier: 1.2,
		turnMultiplier: 1, fireRateMultiplier: 1, attackRange: 250,
	},
};

export function selectHunterChassis(
	pressure: number,
	randomValue: number
): HunterChassisId {
	const available = (Object.entries(HUNTER_CHASSIS) as Array<[
		HunterChassisId,
		HunterChassisDefinition,
	]>).filter(([, chassis]) => pressure >= chassis.minimumPressure);
	const totalWeight = available.reduce((sum, [, chassis]) => (
		sum + chassis.weight
	), 0);
	let roll = Math.max(0, Math.min(0.999999, randomValue)) * totalWeight;
	for (const [id, chassis] of available) {
		roll -= chassis.weight;
		if (roll < 0) return id;
	}
	return "standard";
}

export function spawnAssasin(
	pos: Vec2,
	am: number,
	hp: number,
	scale: number,
	options: AssassinSpawnOptions = {}
) {
	const threat = getThreatSnapshot();
	const pressure = threat.active ? Math.max(threat.depth, threat.tier) : 1;
	const chassisId = options.hunterChassis
		?? selectHunterChassis(pressure, k.rand());
	const chassis = HUNTER_CHASSIS[chassisId];
	const visual = HUNTER_VISUALS[chassisId];
	const profile = createEnemySpawnProfile(
		hp,
		2,
		visual.worldScale * scale,
		options
	);
	const bodyHp = Math.max(1, Math.round(profile.hp * chassis.healthMultiplier));
	const componentHp = Math.max(1, Math.round(bodyHp * 0.5));
	const weaponHp = Math.max(1, Math.round(bodyHp * 0.4));
	const [core, leftWingVisual, rightWingVisual, weaponVisual] = visual.parts;
	const hb = 24 * profile.scale;
	const m = k.add([
		k.pos(pos),
		k.sprite(core.sprite),
		k.color(k.WHITE),
		k.rotate(0),
		k.anchor("center"),
		k.health(bodyHp),
		k.animate(),
		timescale(),
		jitter(),
		k.scale(profile.scale),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			speed: k.rand(100, 130) * profile.speedMultiplier
				* chassis.speedMultiplier,
			hb,
			elite: profile.elite,
			damage: profile.damage * chassis.damageMultiplier,
			shieldFireRateMultiplier: 1,
			threatRank: ENEMY_THREAT_RANK.assassin,
			targetPos: k.rand(k.vec2(k.width(), k.height())),
			hunterChassis: chassisId,
		},
		k.state("retreat", ["attack", "retreat"]),
		tags.enemy,
		tags.unit,
		tags.enemyRolePressure,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	]);
	setHitSoundProfile(m, "lightMetal");

	const leftWing = m.add([
		k.pos(k.vec2(...(leftWingVisual.offset ?? [0, 0]))),
		k.sprite(leftWingVisual.sprite),
		k.color(k.WHITE),
		k.anchor("center"),
		k.health(componentHp),
		k.animate(),
		k.rotate(0),
		timescale(),
		jitter(),
		tags.part,
		tags.gameLoop,
	]);
	const rightWing = m.add([
		k.pos(k.vec2(...(rightWingVisual.offset ?? [0, 0]))),
		k.sprite(rightWingVisual.sprite),
		k.color(k.WHITE),
		k.anchor("center"),
		k.health(componentHp),
		k.animate(),
		k.rotate(0),
		timescale(),
		jitter(),
		tags.part,
		tags.gameLoop,
	]);
	const weapon = m.add([
		k.pos(k.vec2(...(weaponVisual.offset ?? [0, 0]))),
		k.sprite(weaponVisual.sprite),
		k.color(k.WHITE),
		k.anchor("center"),
		k.health(weaponHp),
		k.animate(),
		k.rotate(0),
		timescale(),
		jitter(),
		tags.part,
		tags.gameLoop,
	]);

	unitComponents[m.id!] = compose({
		rewardMultiplier: profile.rewardMultiplier,
		skipDefaultBodyDeath: true,
		onBodyDeath: () => {
			enemyOnDeath(
				m.pos,
				am * profile.rewardMultiplier,
				profile.rewardMultiplier,
				"enemy",
				true,
				{
					tier: profile.elite ? "elite" : "normal",
					material: "ship",
				},
				m
			);
		},
		parts: [
			{ obj: m, hitbox: 8, isBody: true, scoreOnDestroy: 0 },
			{
				obj: leftWing,
				hitbox: 7,
				isBody: false,
				scoreOnDestroy: 0,
				pullForce: profile.elite ? 90 : 75,
			},
			{
				obj: rightWing,
				hitbox: 7,
				isBody: false,
				scoreOnDestroy: 0,
				pullForce: profile.elite ? 90 : 75,
			},
			{
				obj: weapon,
				hitbox: 6,
				isBody: false,
				scoreOnDestroy: 0,
				pullForce: profile.elite ? 102 : 85,
			},
		],
	});

	m.onStateEnter("retreat", async () => {
		const pos = k.rand(k.vec2(k.width(), k.height()));
		m.targetPos = pos;
		await k.wait(2);
		m.enterState("attack");
	});

	m.onStateEnter("attack", async () => {
		await k.wait(3);
		m.enterState("retreat");
	});

	m.onStateUpdate("attack", () => {
		const pos = playerObj.pos;
		m.targetPos = pos;

		const dist = m.pos.dist(m.targetPos);

		if (dist < 50) {
			m.enterState("retreat");
		} else if (dist < chassis.attackRange && !weapon.hidden) {
			const fireRollRange = Math.max(
				1,
				Math.round(200 / (
					chassis.fireRateMultiplier
					* (m.shieldFireRateMultiplier ?? 1)
				))
			);
			if (
				Math.floor(k.rand(0, fireRollRange)) == 1 &&
				hasEnemyLineOfSight(m, playerObj.pos)
			) {
				spawnEnemyBlaster(
					m.pos,
					k.Vec2.fromAngle(m.angle - 90),
					m.angle,
					m.damage,
					{
						name: profile.elite ? "ELITE ASSASSIN" : "ASSASSIN",
						sprite: core.sprite,
					},
					m
				);
			}
		}
	});

	registerBatchedEntityUpdate("enemies", m, () => {
		const navigationTarget = getEnemyNavigationTarget(m, m.targetPos);
		const remainingWings = Number(!leftWing.hidden) + Number(!rightWing.hidden);
		const wingMotionMultiplier = 0.65 + remainingWings * 0.175;
		const { lerp, correctedDesiredRot } = lerpAngleBetweenPos(
			m.angle,
			m.pos,
			navigationTarget,
			0.01 * chassis.turnMultiplier * wingMotionMultiplier
				* timeScale * m.getTimescale(),
			-90
		);

		steerMoveRotateAndLean(
			m,
			lerp,
			m.speed * wingMotionMultiplier * m.getTimescale(),
			correctedDesiredRot
		);
		checkProjectileComponentIntersection(
			m.pos,
			m.hb,
			tags.friendly,
			unitComponents[m.id!],
			(p, index) => onEnemyHit(unitComponents[m.id!][index].obj, p)
		);
	});

	return m;
}
