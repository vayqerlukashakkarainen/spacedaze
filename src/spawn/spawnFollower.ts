import { GameObj, PosComp, Vec2 } from "kaplay";
import {
	checkProjectileIntersection,
	clearGame,
	createExplosion,
	playerObj,
} from "../game";
import { k } from "../main";
import { debreeRocketEmitter, sparkEmitter, starsEmitter } from "../particles";
import {
	lerpAngleBetweenPos,
	lerpMoveRotateAndScale,
	registerHitAnimation,
} from "../shared";
import { tags } from "../tags";
import { randomExplosion } from "../util";
import { shootBlaster } from "../projectiles/blaster";
import { target } from "../comp/target";
import { shootRocket } from "../projectiles/rocket";
import { player } from "../player";

interface Props {
	pos: Vec2;
	hp: number;
	blasterDmg: number;
	canUseMissiles: boolean;
	speed: number;
	follow: GameObj<PosComp>;
}

export function spawnFollower(props: Props) {
	const hb = 12;
	const m = k.add([
		k.pos(props.pos),
		k.sprite("follower"),
		k.rotate(0),
		k.anchor("center"),
		k.scale(0.4),
		k.health(props.hp),
		target(),
		k.animate(),
		k.offscreen({ destroy: true }),
		{
			speed: props.speed,
			hb,
			dmg: props.blasterDmg,
			missiles: props.canUseMissiles,
		},
		tags.friendly,
		tags.unit,
	]);

	registerHitAnimation(m);

	m.onUpdate(() => {
		const { dir, lerp } = lerpAngleBetweenPos(
			m.angle,
			m.pos,
			props.follow.pos,
			0.015,
			-90
		);

		lerpMoveRotateAndScale(m, lerp, m.speed);

		checkProjectileIntersection(m.pos, m.hb, tags.enemy, (p) => {
			k.destroy(p);

			if (p.tags.includes(tags.blaster)) {
				m.hurt(p.dmg);
			}
		});

		if (m.missiles && m.hasTarget()) {
			if (Math.floor(k.rand(0, 300)) == 1) {
				shootRocket(
					m.pos,
					k.Vec2.fromAngle(m.angle - 90),
					m.angle,
					player.rocketImpactDmg * player.rocketDmgMultiplier,
					player.rocketSplashDmg * player.rocketDmgMultiplier,
					player.rocketSplashSize * player.rocketSplashSizeMultiplier,
					player.rocketSplashDmgFallDistanceValue,
					player.rocketSplashDmgFallOverDistance,
					0.8,
					[tags.friendly, tags.rocket],
					true
				);
			}
		}

		if (Math.floor(k.rand(0, 110)) == 1) {
			if (m.pickTarget(m.pos, 400, tags.enemy)) {
				shootBlaster(
					m.pos,
					k.Vec2.fromAngle(m.targetAngle()),
					m.targetAngle() + 90,
					m.dmg,
					2,
					[tags.friendly, tags.blaster],
					true
				);
			}
		}
	});

	m.onDeath(() => {
		starsEmitter.emitter.position = m.pos;
		starsEmitter.emit(20);

		k.play(randomExplosion(), { volume: 0.6 });
		k.destroy(m);
	});

	m.onHurt(() => {
		k.play("hit1", { volume: 0.6 });
		m.animation.seek(0);
	});
}
