import { Vec2 } from "kaplay";
import { checkProjectileIntersection, playerObj } from "../game";
import { dtScaled, k, subSoundVolume, velocityScale } from "../main";
import { audioService } from "../services/audioService";
import { registerHitAnimation } from "../shared";
import { tags } from "../tags";
import { randomExplosion } from "../util";
import { enemyOnDeath, onEnemyHit } from "./enemyShared";
import { timescale } from "../comp/timescale";
import { mass } from "../comp/mass";
import { ASTEROID_SPRITES } from "../asteroidSprites";
import { applyDamage } from "../services/damageService";
import {
	createEnemySpawnProfile,
	type EnemySpawnOptions,
} from "../services/threatService";

interface Props {
	pos: Vec2;
	dir: Vec2;
	scoreOnKill: number;
	hp: number;
	speed: number;
	splitOnDeath: number;
	destroyOffscreen?: boolean;
	powerupMultiplier?: number;
	tags?: string[];
	enemyOptions?: EnemySpawnOptions;
}

export function spawnMeteorite(props: Props) {
	const baseScale = k.rand(1, 2);
	const profile = createEnemySpawnProfile(
		props.hp,
		1,
		baseScale,
		props.enemyOptions
	);
	const initScale = profile.scale;
	const hb = 12 * profile.scale;
	const spriteName =
		ASTEROID_SPRITES[
			Math.floor(k.rand(0, ASTEROID_SPRITES.length))
		];
	const m = k.add([
		k.pos(props.pos),
		k.sprite(spriteName),
		k.color(...profile.tint),
		k.rotate(0),
		k.anchor("center"),
		k.scale(profile.scale),
		k.health(profile.hp),
		k.animate(),
		timescale(),
		mass(1),
		...(props.destroyOffscreen === false
			? []
			: [k.offscreen({ destroy: true })]),
		{
			vel: props.dir,
			rotVel: k.rand(-4, 4),
			speed: props.speed,
			initScale,
			hb,
			elite: profile.elite,
			damage: profile.damage,
		},
		tags.enemy,
		tags.unit,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(props.tags ?? []),
	]);

	registerHitAnimation(m);

	m.onUpdate(() => {
		m.move(m.vel.scale(m.speed * velocityScale() * m.getTimescale()));
		m.angle += m.rotVel * dtScaled() * m.getTimescale();

		checkProjectileIntersection(m.pos, m.hb, tags.friendly, (p) => {
			onEnemyHit(m, p);
		});

		if (playerObj.pos.dist(m.pos) < m.hb) {
			applyDamage(playerObj, m.damage);
			applyDamage(m, profile.hp);
		}
	});

	m.onDeath(() => {
		enemyOnDeath(
			m.pos,
			props.scoreOnKill * profile.rewardMultiplier,
			(props.powerupMultiplier ?? 1) * profile.rewardMultiplier
		);
		audioService.playSound(randomExplosion(), { volume: subSoundVolume });
		k.destroy(m);

		if (props.splitOnDeath) {
			for (let i = 0; i < props.splitOnDeath; i++) {
				spawnMeteorite({
					pos: m.pos,
					dir: k.rand(k.vec2(-1, -1), k.vec2(1, 1)),
					scoreOnKill: props.scoreOnKill / 2,
					hp: props.hp / 2,
					speed: props.speed * 2,
					splitOnDeath: 0,
					destroyOffscreen: props.destroyOffscreen,
					tags: props.tags,
					enemyOptions: {
						...props.enemyOptions,
						elite: profile.elite,
					},
				});
			}
		}
	});

	m.onHurt(() => {
		m.animation.seek(0);
	});
}
