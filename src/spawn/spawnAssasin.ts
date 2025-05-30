import { checkProjectileIntersection, playerObj } from "../game";
import { k, mainSoundVolume, subSoundVolume } from "../main";
import { shootBlaster } from "../projectiles/blaster";
import {
	lerpAngleBetweenPos,
	lerpMoveRotateAndScale,
	registerHitAnimation,
} from "../shared";
import { tags } from "../tags";
import { randomExplosion } from "../util";
import { enemyOnDeath, onEnemyHit } from "./enemyShared";

export function spawnAssasin(pos, am, hp, scale) {
	const hb = 12 * scale;
	const m = k.add([
		k.pos(pos),
		k.sprite("enemy_ship1"),
		k.rotate(0),
		k.anchor("center"),
		k.health(hp),
		k.animate(),
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
				shootBlaster(
					m.pos,
					k.Vec2.fromAngle(m.angle - 90),
					m.angle,
					2,
					1,
					[tags.enemy, tags.blaster],
					true
				);
			}
		}
	});

	registerHitAnimation(m);

	m.onUpdate(() => {
		const { lerp } = lerpAngleBetweenPos(
			m.angle,
			m.pos,
			m.targetPos,
			0.01,
			-90
		);

		lerpMoveRotateAndScale(m, lerp, m.speed);

		checkProjectileIntersection(m.pos, m.hb, tags.friendly, (p) => {
			k.destroy(p);

			onEnemyHit(m, p);
		});
	});

	m.onDeath(() => {
		k.play(randomExplosion(), { volume: subSoundVolume });
		enemyOnDeath(m.pos, am, 1);
		k.destroy(m);
	});

	m.onHurt(() => {
		k.play("hit1", { volume: mainSoundVolume });
		m.animation.seek(0);
	});
}
