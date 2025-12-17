import { checkProjectileIntersection, playerObj } from "../game";
import { k, mainSoundVolume, subSoundVolume, timeScale } from "../main";
import { audioService } from "../services/audioService";
import { spawnEnemyBlaster } from "../services/projectileHelpers";
import {
	lerpAngleBetweenPos,
	lerpMoveRotateAndScale,
	registerHitAnimation,
} from "../shared";
import { tags } from "../tags";
import { randomExplosion } from "../util";
import { enemyOnDeath, onEnemyHit } from "./enemyShared";
import type { Vec2 } from "kaplay";
import { timescale } from "../comp/timescale";

export function spawnAssasin(pos: Vec2, am: number, hp: number, scale: number) {
	const hb = 12 * scale;
	const m = k.add([
		k.pos(pos),
		k.sprite("enemy_ship1"),
		k.rotate(0),
		k.anchor("center"),
		k.health(hp),
		k.animate(),
		timescale(),
		k.scale(scale),
		k.offscreen({ destroy: true }),
		{
			speed: k.rand(100, 130),
			hb,
			targetPos: k.rand(k.vec2(k.width(), k.height())),
		},
		k.state("retreat", ["attack", "retreat"]),
		tags.enemy,
		tags.unit,
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
				spawnEnemyBlaster(m.pos, k.Vec2.fromAngle(m.angle - 90), m.angle, 2);
			}
		}
	});

	registerHitAnimation(m);

	m.onUpdate(() => {
		const { lerp } = lerpAngleBetweenPos(
			m.angle,
			m.pos,
			m.targetPos,
			0.01 * timeScale * m.getTimescale(),
			-90
		);

		lerpMoveRotateAndScale(m, lerp, m.speed * m.getTimescale());
		checkProjectileIntersection(m.pos, m.hb, tags.friendly, (p) => {
			onEnemyHit(m, p);
		});
	});

	m.onDeath(() => {
		audioService.playSound(randomExplosion(), { volume: subSoundVolume });
		enemyOnDeath(m.pos, am, 1);
		k.destroy(m);
	});

	m.onHurt(() => {
		audioService.playSound("hit1", { volume: mainSoundVolume });
		m.animation.seek(0);
	});
}
