import { Vec2 } from "kaplay";
import { checkProjectileIntersection, playerObj } from "../game";
import { dtScaled, k, velocityScale } from "../main";
import { registerHitAnimation } from "../shared";
import { tags } from "../tags";
import { enemyOnDeath, onEnemyHit } from "./enemyShared";
import { timescale } from "../comp/timescale";
import { mass } from "../comp/mass";
import { ASTEROID_SPRITES } from "../asteroidSprites";
import { applyDamage } from "../services/combat/damageService";
import { isPlayerDamageInvulnerable } from "../services/player/playerDamageState";
import { isEnemyEmpDisrupted } from "../services/enemies/enemyEmpService"
import {
	createEnemySpawnProfile,
	ENEMY_THREAT_RANK,
	type EnemySpawnOptions,
} from "../services/enemies/threatService";
import { registerBatchedEntityUpdate } from "../services/core/entityUpdateService";
import { setHitSoundProfile } from "../services/audio/hitSoundService";
import { getEnemyVisual } from "../visuals/enemyVisualCatalog";
import { gridRegistry } from "../grid/gridRegistry";
import { bounceMovingTerrainOffGrid } from "../services/world/movingTerrainService";

const ASTEROID_VISUAL = getEnemyVisual("asteroid");

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
	bounceGridKey?: string;
	onDeath?: (pos: Vec2) => void;
}

export function spawnMeteorite(props: Props) {
	const baseScale = ASTEROID_VISUAL.worldScale * k.rand(0.7, 1.5);
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
		k.color(k.WHITE),
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
			enemyDamageMaterial: "rock",
			vel: props.dir,
			rotVel: k.rand(-4, 4),
			speed: props.speed * profile.speedMultiplier,
			initScale,
			hb,
			elite: profile.elite,
			damage: profile.damage,
			threatRank: ENEMY_THREAT_RANK.asteroid,
			bounceGridKey: props.bounceGridKey,
		},
		tags.enemy,
		tags.enemyRoleTerrain,
		tags.unit,
		...(profile.elite ? [tags.elite] : []),
		tags.gameLoop,
		...(props.tags ?? []),
	]);
	setHitSoundProfile(m, "stone");

	registerHitAnimation(m);

	registerBatchedEntityUpdate("enemies", m, () => {
		const moveVelocity = m.vel.scale(
			m.speed * velocityScale() * m.getTimescale()
		);
		const grid = m.bounceGridKey
			? gridRegistry.get(m.bounceGridKey)
			: undefined;
		if (!bounceMovingTerrainOffGrid(m, moveVelocity, grid)) {
			m.move(moveVelocity);
		}
		m.angle += m.rotVel * dtScaled() * m.getTimescale();

		checkProjectileIntersection(m.pos, m.hb, tags.friendly, (p) => {
			onEnemyHit(m, p);
		});

		if (
			!isEnemyEmpDisrupted(m) &&
			!isPlayerDamageInvulnerable() &&
			playerObj.pos.dist(m.pos) < m.hb
		) {
			applyDamage(playerObj, m.damage, {
				position: m.pos,
				source: {
					name: profile.elite ? "ELITE ASTEROID" : "ASTEROID",
					sprite: spriteName,
				},
			});
			applyDamage(m, profile.hp);
		}
	});

	m.onDeath(() => {
		const deathPos = m.pos.clone();
			enemyOnDeath(
				deathPos,
				props.scoreOnKill * profile.rewardMultiplier,
				(props.powerupMultiplier ?? 1) * profile.rewardMultiplier,
				"enemy",
				true,
				{
					tier: profile.elite ? "elite" : "normal",
					material: "rock",
				},
				m
			);
		k.destroy(m);
		props.onDeath?.(deathPos);

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
					bounceGridKey: props.bounceGridKey,
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

	return m;
}
