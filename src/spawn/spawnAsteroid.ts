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
import { isPlayerDamageInvulnerable } from "../services/playerDamageState";
import {
	createEnemySpawnProfile,
	ENEMY_THREAT_RANK,
	type EnemySpawnOptions,
} from "../services/threatService";
import { gridRegistry } from "../grid/gridRegistry";
import { registerBatchedEntityUpdate } from "../services/entityUpdateService";

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

	registerHitAnimation(m);

	registerBatchedEntityUpdate("enemies", m, () => {
		const moveVelocity = m.vel.scale(
			m.speed * velocityScale() * m.getTimescale()
		);
		if (!bounceOffGridCell(m, moveVelocity)) {
			m.move(moveVelocity);
		}
		m.angle += m.rotVel * dtScaled() * m.getTimescale();

		checkProjectileIntersection(m.pos, m.hb, tags.friendly, (p) => {
			onEnemyHit(m, p);
		});

		if (
			!isPlayerDamageInvulnerable() &&
			playerObj.pos.dist(m.pos) < m.hb
		) {
			applyDamage(playerObj, m.damage, {
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
			(props.powerupMultiplier ?? 1) * profile.rewardMultiplier
		);
		audioService.playSound(randomExplosion(), { volume: subSoundVolume });
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
}

function bounceOffGridCell(
	meteorite: {
		pos: Vec2;
		vel: Vec2;
		hb: number;
		bounceGridKey?: string;
	},
	moveVelocity: Vec2
) {
	if (!meteorite.bounceGridKey || moveVelocity.len() <= 0) return false;
	const grid = gridRegistry.get(meteorite.bounceGridKey);
	if (!grid) return false;

	const movement = moveVelocity.scale(k.dt());
	const direction = movement.unit();
	const probePos = meteorite.pos
		.add(movement)
		.add(direction.scale(meteorite.hb));
	const blockedCoord = grid.screenToHex(probePos);
	if (grid.inBounds(blockedCoord) && grid.isWalkable(blockedCoord)) {
		return false;
	}

	const blockedCenter = grid.hexToScreen(blockedCoord);
	const awayFromCell = meteorite.pos.sub(blockedCenter);
	const normal = awayFromCell.len() > 0
		? awayFromCell.unit()
		: direction.scale(-1);
	const reflected = meteorite.vel.sub(
		normal.scale(2 * meteorite.vel.dot(normal))
	);
	meteorite.vel = reflected.len() > 0
		? reflected.unit()
		: direction.scale(-1);
	return true;
}
