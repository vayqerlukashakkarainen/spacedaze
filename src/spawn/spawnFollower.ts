import { GameObj, PosComp } from "kaplay";
import { checkProjectileIntersection } from "../game";
import {
	k,
	mainSoundVolume,
	subSoundVolume,
	timeScale,
	velocityScale,
} from "../main";
import { audioService } from "../services/audioService";
import { starsEmitter } from "../particles";
import {
	lerpAngleBetweenPos,
	lerpMoveRotateAndScale,
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
import { applyProjectileDamage } from "../services/projectileService";

interface Props {
	hp: number;
	blasterDmg: number;
	speed: number;
	follow: GameObj<PosComp>;
}

const deploymentDuration = 0.7;
const deploymentReleaseProgress = 0.62;
const deploymentDistance = 48;
const deploymentAngleStep = 137.5;
const deploymentScreenMargin = 36;

export function spawnFollower(props: Props) {
	const hb = 12;
	const followerIndex = k.get(tags.follower).length;
	const deploymentAngle = -90 + followerIndex * deploymentAngleStep;
	const formationOffset = k.Vec2.fromAngle(deploymentAngle).scale(
		deploymentDistance
	);
	const deploymentTarget = props.follow.pos.add(formationOffset);
	const entersFromLeft = followerIndex % 2 === 0;
	const deploymentScreenY = k.clamp(
		k.height() / 2 + k.rand(-k.height() * 0.25, k.height() * 0.25),
		deploymentScreenMargin,
		k.height() - deploymentScreenMargin
	);
	const deploymentStart = k.toWorld(
		k.vec2(
			entersFromLeft
				? -deploymentScreenMargin
				: k.width() + deploymentScreenMargin,
			deploymentScreenY
		)
	);
	const deploymentDirection = deploymentTarget.sub(deploymentStart);
	const deploymentFacingAngle = k.Vec2.toAngle(deploymentDirection) + 90;
	const m = k.add([
		k.pos(deploymentStart),
		k.sprite("follower"),
		k.rotate(deploymentFacingAngle),
		k.anchor("center"),
		k.scale(1.35, 0.72),
		k.opacity(1),
		k.health(props.hp),
		target(),
		timescale(),
		k.animate(),
		{
			speed: props.speed,
			hb,
			dmg: props.blasterDmg,
			deployed: false,
			deploymentElapsed: 0,
			deploymentTrailElapsed: 0,
			deploymentStart,
			lastDeploymentPos: deploymentStart.clone(),
			entryVelocity: k.vec2(0),
			formationOffset,
			deploymentFacingAngle,
		},
		tags.friendly,
		tags.follower,
		tags.unit,
		tags.gameLoop,
	]);

	audioService.playSound("collect1", { volume: mainSoundVolume });

	m.onUpdate(() => {
		if (!m.deployed) {
			m.deploymentElapsed += k.dt();
			m.deploymentTrailElapsed += k.dt();
			const progress = k.clamp(
				m.deploymentElapsed / deploymentDuration,
				0,
				1
			);
			const easedProgress = 1 - Math.pow(1 - progress, 3);
			const currentTarget = props.follow.pos.add(m.formationOffset);
			const nextPos = m.deploymentStart.lerp(currentTarget, easedProgress);
			const frameDuration = Math.max(k.dt(), 0.001);
			m.entryVelocity = nextPos
				.sub(m.lastDeploymentPos)
				.scale(1 / frameDuration);
			m.pos = nextPos;
			m.lastDeploymentPos = nextPos.clone();
			m.angle = m.deploymentFacingAngle;
			m.scale = k.vec2(
				k.lerp(1.35, 1, easedProgress),
				k.lerp(0.72, 1, easedProgress)
			);

			if (m.deploymentTrailElapsed >= 0.045) {
				m.deploymentTrailElapsed = 0;
				starsEmitter.emitter.position = m.pos;
				starsEmitter.emit(2);
			}

			if (progress >= deploymentReleaseProgress) {
				m.scale = k.vec2(1);
				m.deployed = true;
				starsEmitter.emitter.position = m.pos;
				starsEmitter.emit(10);
			}
			return;
		}

		if (m.entryVelocity.len() > 1) {
			m.move(
				m.entryVelocity.scale(velocityScale() * m.getTimescale())
			);
			m.entryVelocity = m.entryVelocity.lerp(
				k.vec2(0),
				1 - Math.exp(-8 * k.dt())
			);
		}
		const { lerp, correctedDesiredRot } = lerpAngleBetweenPos(
			m.angle,
			m.pos,
			props.follow.pos,
			0.015 * timeScale * m.getTimescale(),
			-90
		);

		lerpMoveRotateAndScale(
			m,
			lerp,
			m.speed * m.getTimescale(),
			correctedDesiredRot
		);

		checkProjectileIntersection(m.pos, m.hb, tags.enemy, (p) => {
			const shouldDestroy = applyProjectileDamage(m, p);
			if (shouldDestroy) k.destroy(p);
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
					[tags.friendly, tags.rocket],
					player.followerProjectileLink !== undefined
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
					[tags.friendly, tags.blaster],
					player.followerProjectileLink !== undefined
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
		m.animate("opacity", [0, 1, 0, 1], {
			duration: 0.14,
			loops: 1,
		});
	});
}
