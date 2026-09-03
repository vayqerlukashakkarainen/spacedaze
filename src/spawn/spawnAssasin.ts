import { checkProjectileIntersection, playerObj } from "../game";
import { k, mainSoundVolume, subSoundVolume, timeScale } from "../main";
import { audioService } from "../services/audioService";
import { spawnEnemyBlaster } from "../services/projectileHelpers";
import {
	lerpAngleBetweenPos,
	steerMoveRotateAndLean,
	registerHitAnimation,
} from "../shared";
import { tags } from "../tags";
import { randomExplosion } from "../util";
import { enemyOnDeath, onEnemyHit } from "./enemyShared";
import type { Vec2 } from "kaplay";
import { timescale } from "../comp/timescale";
import {
	createEnemySpawnProfile,
	type EnemySpawnOptions,
} from "../services/threatService";

export function spawnAssasin(
	pos: Vec2,
	am: number,
	hp: number,
	scale: number,
	options: EnemySpawnOptions = {}
) {
	const profile = createEnemySpawnProfile(hp, 2, scale, options);
	const hb = 12 * profile.scale;
	const m = k.add([
		k.pos(pos),
		k.sprite("enemy_ship1"),
		k.color(...profile.tint),
		k.rotate(0),
		k.anchor("center"),
		k.health(profile.hp),
		k.animate(),
		timescale(),
		k.scale(profile.scale),
		...(options.persistOffscreen ? [] : [k.offscreen({ destroy: true })]),
		{
			speed: k.rand(100, 130) * profile.speedMultiplier,
			hb,
			elite: profile.elite,
			damage: profile.damage,
			targetPos: k.rand(k.vec2(k.width(), k.height())),
		},
		k.state("retreat", ["attack", "retreat"]),
		tags.enemy,
		tags.unit,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(options.tags ?? []),
	]);

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
		} else if (dist > 50 && dist < 200) {
			if (Math.floor(k.rand(0, 200)) == 1) {
				spawnEnemyBlaster(
					m.pos,
					k.Vec2.fromAngle(m.angle - 90),
					m.angle,
					m.damage,
					{
						name: profile.elite ? "ELITE ASSASSIN" : "ASSASSIN",
						sprite: "enemy_ship1",
					}
				);
			}
		}
	});

	registerHitAnimation(m);

	m.onUpdate(() => {
		const { lerp, correctedDesiredRot } = lerpAngleBetweenPos(
			m.angle,
			m.pos,
			m.targetPos,
			0.01 * timeScale * m.getTimescale(),
			-90
		);

		steerMoveRotateAndLean(
			m,
			lerp,
			m.speed * m.getTimescale(),
			correctedDesiredRot
		);
		checkProjectileIntersection(m.pos, m.hb, tags.friendly, (p) => {
			onEnemyHit(m, p);
		});
	});

	m.onDeath(() => {
		audioService.playSound(randomExplosion(), { volume: subSoundVolume });
		enemyOnDeath(m.pos, am * profile.rewardMultiplier, profile.rewardMultiplier);
		k.destroy(m);
	});

	m.onHurt(() => {
		audioService.playSound("hit1", { volume: mainSoundVolume });
		m.animation.seek(0);
	});
}
