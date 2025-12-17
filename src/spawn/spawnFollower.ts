import { GameObj, PosComp, Vec2 } from "kaplay";
import {
	checkProjectileIntersection,
	clearGame,
	createExplosion,
	playerObj,
} from "../game";
import { k, mainSoundVolume, subSoundVolume, timeScale } from "../main";
import { audioService } from "../services/audioService";
import { debreeRocketEmitter, sparkEmitter, starsEmitter } from "../particles";
import {
	lerpAngleBetweenPos,
	lerpMoveRotateAndScale,
	registerHitAnimation,
} from "../shared";
import { tags } from "../tags";
import { randomExplosion } from "../util";
import { player } from "../player";
import {
	spawnBasicBlaster,
	spawnHomingRocket,
} from "../services/projectileHelpers";
import { timescale } from "../comp/timescale";
import { target } from "../comp/target";

interface Props {
	pos: Vec2;
	hp: number;
	blasterDmg: number;
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
		timescale(),
		k.animate(),
		k.offscreen({ destroy: true }),
		{
			speed: props.speed,
			hb,
			dmg: props.blasterDmg,
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
			0.015 * timeScale * m.getTimescale(),
			-90
		);

		lerpMoveRotateAndScale(m, lerp, m.speed * m.getTimescale());

		checkProjectileIntersection(m.pos, m.hb, tags.enemy, (p) => {
			if (p.tags.includes(tags.blaster)) {
				m.hurt(p.dmg);
			}
		});

		if (player.followerCanUseMissiles && m.hasTarget()) {
			if (Math.floor(k.rand(0, 300)) == 1) {
				spawnHomingRocket(
					m.pos,
					k.Vec2.fromAngle(m.angle - 90),
					m.angle,
					player.rocketImpactDmg * player.rocketDmgMultiplier,
					player.rocketSplashDmg * player.rocketDmgMultiplier,
					player.rocketSplashSize * player.rocketSplashSizeMultiplier,
					true,
					[tags.friendly, tags.rocket]
				);
			}
		}

		if (Math.floor(k.rand(0, 150)) == 1) {
			if (m.pickTarget(m.pos, 400, tags.enemy)) {
				spawnBasicBlaster(
					m.pos,
					k.Vec2.fromAngle(m.targetAngle()),
					m.targetAngle() + 90,
					m.dmg,
					2,
					[tags.friendly, tags.blaster]
				);
			}
		}
	});

	m.onDeath(() => {
		starsEmitter.emitter.position = m.pos;
		starsEmitter.emit(20);

		audioService.playSound(randomExplosion(), { volume: subSoundVolume });
		k.destroy(m);
	});

	m.onHurt(() => {
		audioService.playSound("hit1", { volume: mainSoundVolume });
		m.animation.seek(0);
	});
}
